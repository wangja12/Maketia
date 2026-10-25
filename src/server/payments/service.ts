import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { funnels, orders, pages, paymentEvents, products, type Order } from "@/db/schema";
import { recordCheckoutSubmitted, recordOrderPaid } from "../analytics/tracking";
import { recordContact, recordContactPurchase } from "../crm/contacts";
import { NotFoundError, ValidationError } from "../errors";
import { resolvePublishedPage, type PublicSite } from "../publishing";
import { fieldErrorsOf } from "../validation";
import { isUuid, requireMembership } from "../workspaces";
import { allowedLinkHosts, checkPaymentLink, linkStatus } from "./links";
export { linkStatus } from "./links";
export { checkoutProblems, productsForContent } from "./checks";

/*
 * Seller sales through manual SasPay payment links.
 * - The seller creates the link (fixed amount, currency) in their own SasPay account and pastes
 *   its public URL on the product. No SasPay API key is asked for and no SasPay API is called.
 * - The buyer leaves their details on the published page; a "pending" order is created, then
 *   they are sent to the link stored on the product (never a URL taken from the request).
 * - An order becomes "paid" only from an authenticated, unambiguously matched notification
 *   (not available yet, see saspay-webhooks.ts) or from the seller's audited manual confirmation.
 *   A browser return, a click or a pixel never marks it paid.
 */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function logEvent(db: Pick<Db, "insert">, orderId: string, kind: string, detail?: string | null) {
  await db.insert(paymentEvents).values({ orderId, kind, detail: detail?.slice(0, 1000) ?? null });
}

// ── Products ────────────────────────────────────────────────────────────────

export const PRODUCT_KINDS = {
  digital_file: "Fichier numérique",
  service: "Service",
  booking: "Réservation",
  no_delivery: "Sans livraison numérique",
} as const;

const productSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  price: z.coerce.number({ error: "Prix invalide" }).int("Prix en unités entières (sans centimes)").positive("Prix supérieur à 0").max(100_000_000),
  currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Devise : code à 3 lettres (XOF, XAF…)"),
  kind: z.enum(Object.keys(PRODUCT_KINDS) as [keyof typeof PRODUCT_KINDS, ...(keyof typeof PRODUCT_KINDS)[]]).default("no_delivery"),
});

export async function createProduct(db: Db, userId: string, workspaceId: string, input: unknown) {
  await requireMembership(db, userId, workspaceId, "edit");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Vérifie les champs", fieldErrorsOf(parsed.error));
  const [row] = await db.insert(products).values({ workspaceId, ...parsed.data }).returning();
  return row;
}

export async function listProducts(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return db.select().from(products).where(eq(products.workspaceId, workspaceId)).orderBy(desc(products.createdAt));
}

async function requireProduct(db: Db, userId: string, productId: string) {
  if (!isUuid(productId)) throw new NotFoundError();
  const [row] = await db.select().from(products).where(eq(products.id, productId));
  if (!row) throw new NotFoundError();
  await requireMembership(db, userId, row.workspaceId, "edit");
  return row;
}

export async function setProductActive(db: Db, userId: string, productId: string, active: boolean) {
  const row = await requireProduct(db, userId, productId);
  const [updated] = await db.update(products).set({ active }).where(eq(products.id, row.id)).returning();
  return updated;
}

/**
 * Saves the seller's SasPay link and expected price. The seller must confirm that price and
 * currency are those fixed on the SasPay link: the platform cannot check it (no API by design).
 * Any change of link, price or currency clears a previous confirmation.
 */
export async function setProductPaymentLink(
  db: Db,
  userId: string,
  productId: string,
  input: { url: unknown; price: unknown; currency: unknown; phoneRequired?: unknown; confirmed: unknown },
) {
  const row = await requireProduct(db, userId, productId);
  const fields = productSchema.pick({ price: true, currency: true }).safeParse({ price: input.price, currency: input.currency });
  if (!fields.success) throw new ValidationError("Vérifie les champs", fieldErrorsOf(fields.error));
  const link = checkPaymentLink(String(input.url ?? ""), await allowedLinkHosts(db));
  if (!link.ok) throw new ValidationError(link.reason, { url: link.reason });
  if (input.confirmed !== true) {
    const message = "Confirme que le prix et la devise sont exactement ceux de ton lien SasPay.";
    throw new ValidationError(message, { confirmed: message });
  }
  const [updated] = await db
    .update(products)
    .set({ saspayLinkUrl: link.url, price: fields.data.price, currency: fields.data.currency, phoneRequired: input.phoneRequired === true, priceConfirmedAt: sql`now()` })
    .where(eq(products.id, row.id))
    .returning();
  return updated;
}

export async function removeProductPaymentLink(db: Db, userId: string, productId: string) {
  const row = await requireProduct(db, userId, productId);
  const [updated] = await db.update(products).set({ saspayLinkUrl: null, priceConfirmedAt: null }).where(eq(products.id, row.id)).returning();
  return updated;
}

// ── Checkout (public) ───────────────────────────────────────────────────────

export class CheckoutError extends Error {
  constructor(readonly code: "invalid" | "unavailable" | "rate_limited", message: string, readonly fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "CheckoutError";
  }
}

const phone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s.-]/g, ""))
  .refine((v) => v === "" || /^\+[1-9][0-9]{7,14}$/.test(v), "Téléphone au format international, ex. +2250700000000");

const customerSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom : 2 caractères minimum").max(80),
  lastName: z.string().trim().min(2, "Nom : 2 caractères minimum").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  phone: phone.optional(),
});

export const CHECKOUT_LIMIT_PER_10_MIN = 10;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

/** Only the five UTM parameters, short strings: no personal data in attribution. */
export function attributionFrom(input: Record<string, unknown>) {
  const out: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = input[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 100);
  }
  return Object.keys(out).length ? out : null;
}

/**
 * Records the order (pending) and returns the seller's SasPay link to send the buyer to.
 * Product, price, link and workspace all come from the live publication, never from the form.
 */
export async function startCheckout(
  db: Db,
  input: { site: PublicSite; path: string; sectionId: string; customer: unknown; ip: string | null; visitorId?: string | null; attribution?: Record<string, unknown> },
) {
  // With the visitor id, the same A/B arm the buyer saw is resolved again.
  const page = await resolvePublishedPage(db, input.site, input.path, input.visitorId ?? null);
  const section = page?.content.sections.find((s) => s.id === input.sectionId && s.type === "checkout");
  if (!page || !section || section.type !== "checkout") throw new CheckoutError("unavailable", "Ce formulaire de commande n’est plus en ligne.");

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, section.productId), eq(products.workspaceId, page.workspaceId), eq(products.active, true)));
  if (!product) throw new CheckoutError("unavailable", "Ce produit n’est plus disponible.");
  if (!linkStatus(product, await allowedLinkHosts(db)).ready) throw new CheckoutError("unavailable", "Le paiement en ligne n’est pas disponible pour le moment.");

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) throw new CheckoutError("invalid", "Vérifiez vos informations.", fieldErrorsOf(customer.error));
  const c = customer.data;
  if (product.phoneRequired && !c.phone) throw new CheckoutError("invalid", "Vérifiez vos informations.", { phone: "Indiquez votre téléphone" });

  const ipHash = input.ip ? sha256(`tunnels-ia:${input.ip}`) : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.ipHash, ipHash), gt(orders.createdAt, sql`now() - interval '10 minutes'`)));
    if (n >= CHECKOUT_LIMIT_PER_10_MIN) throw new CheckoutError("rate_limited", "Trop de tentatives. Réessayez dans quelques minutes.");
  }

  const orderId = crypto.randomUUID();
  // The buyer becomes (or stays) a contact of the workspace's CRM.
  const contactId = await recordContact(
    db,
    {
      workspaceId: page.workspaceId,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone || null,
      funnelId: page.funnelId,
      pageId: page.pageId,
      variantLabel: page.variantLabel,
      visitorId: input.visitorId,
    },
    { kind: "order_started", detail: `${product.name} · ${product.price} ${product.currency}`, orderId },
  );
  const [order] = await db
    .insert(orders)
    .values({
      id: orderId,
      contactId,
      workspaceId: page.workspaceId,
      funnelId: page.funnelId,
      pageId: page.pageId,
      variantLabel: page.variantLabel,
      productId: product.id,
      productName: product.name,
      amount: product.price,
      currency: product.currency,
      status: "pending",
      paymentMethod: "saspay_link",
      // Our own order reference; SasPay never receives it (no API call).
      merchantTransactionId: `TIA${randomBytes(9).toString("hex").toUpperCase()}`,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone || null,
      ipHash,
      visitorId: input.visitorId ?? null,
      experimentId: page.experimentId,
      attribution: attributionFrom(input.attribution ?? {}),
      paymentUrl: product.saspayLinkUrl,
    })
    .returning();
  await logEvent(db, order.id, "order_created", `${product.price} ${product.currency} · redirection vers le lien SasPay du vendeur`);
  await recordCheckoutSubmitted(db, order);
  return { orderId: order.id, paymentUrl: product.saspayLinkUrl! };
}

// ── Manual confirmation by the seller ───────────────────────────────────────

/**
 * The seller attests, after checking their own SasPay dashboard, that this order was paid.
 * Owners and admins only; audited. It never sends a Meta Purchase event (that requires an
 * authenticated notification) and never changes an already settled order.
 */
export async function confirmOrderPaidManually(db: Db, userId: string, orderId: string, input: { attested: unknown; note?: unknown; webhookEventId?: number | null }) {
  const { order } = await getOrderForUser(db, userId, orderId);
  await requireMembership(db, userId, order.workspaceId, "delete");
  if (input.attested !== true) throw new ValidationError("Coche la confirmation : tu as vérifié ce paiement dans ton tableau de bord SasPay.");
  if (order.paymentMethod !== "saspay_link") throw new ValidationError("Seules les commandes par lien SasPay se confirment ici.");
  if (!["pending", "payment_unmatched"].includes(order.status)) throw new ValidationError("Cette commande n’est plus en attente de paiement.");
  const note = typeof input.note === "string" ? input.note.trim().slice(0, 300) : "";
  const paid = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, order.id)).for("update");
    if (!["pending", "payment_unmatched"].includes(locked.status)) throw new ValidationError("Cette commande n’est plus en attente de paiement.");
    const [updated] = await tx
      .update(orders)
      .set({ status: "paid", paidVia: "manual", paidAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(orders.id, order.id))
      .returning();
    await logEvent(tx, order.id, "manual_confirmation", `Confirmé par le vendeur (utilisateur ${userId})${note ? ` : ${note}` : ""}`);
    await recordContactPurchase(tx, updated);
    return updated;
  });
  await recordOrderPaid(db, paid);
  return paid;
}

export async function cancelOrder(db: Db, userId: string, orderId: string) {
  const { order } = await getOrderForUser(db, userId, orderId);
  await requireMembership(db, userId, order.workspaceId, "delete");
  if (order.status !== "pending") throw new ValidationError("Seule une commande en attente peut être annulée.");
  const [updated] = await db.update(orders).set({ status: "cancelled", updatedAt: sql`now()` }).where(and(eq(orders.id, order.id), eq(orders.status, "pending"))).returning();
  await logEvent(db, order.id, "cancelled", `Annulée par l’utilisateur ${userId}`);
  return updated;
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function listOrders(db: Db, userId: string, workspaceId: string, limit = 100, statuses?: Order["status"][]) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select({ order: orders, funnelName: funnels.name, pageName: pages.name })
    .from(orders)
    .leftJoin(funnels, eq(funnels.id, orders.funnelId))
    .leftJoin(pages, eq(pages.id, orders.pageId))
    .where(and(eq(orders.workspaceId, workspaceId), statuses?.length ? inArray(orders.status, statuses) : undefined))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

/** Orders waiting for the creator to check SasPay and confirm (shown as a badge in the nav). */
export async function countOrdersToConfirm(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  const [row] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.workspaceId, workspaceId), eq(orders.paymentMethod, "saspay_link"), eq(orders.status, "pending")));
  return row?.n ?? 0;
}

export async function getOrderForUser(db: Db, userId: string, orderId: string) {
  if (!isUuid(orderId)) throw new NotFoundError();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new NotFoundError();
  await requireMembership(db, userId, order.workspaceId, "read");
  const events = await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, order.id)).orderBy(paymentEvents.createdAt);
  return { order, events };
}

/** Public return page: a buyer may see their order's stored state, never its personal data. */
export async function publicOrderStatus(db: Db, orderId: string) {
  if (!isUuid(orderId)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  return { status: order.status, productName: order.productName, amount: order.amount, currency: order.currency, reference: order.merchantTransactionId };
}
