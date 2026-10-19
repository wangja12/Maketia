import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { funnels, orders, pages, paymentEvents, paymentProviders, products, type Order } from "@/db/schema";
import { NotFoundError, ValidationError } from "../errors";
import { encryptSecret } from "../secrets";
import { siteConfig } from "../site-config";
import { fieldErrorsOf } from "../validation";
import { isUuid, requireMembership } from "../workspaces";
import { CINETPAY_COUNTRIES, CinetPayError, parseWebhook, type CinetPayCountry } from "./cinetpay";
import { defaultGatewayFactory, type GatewayFactory } from "./gateway";
import { resolvePublishedPage, type PublicSite } from "../publishing";
export { checkoutProblems, productsForContent } from "./checks";
import { recordCheckoutSubmitted, recordOrderPaid } from "../analytics/tracking";
import { recordContact, recordContactPurchase } from "../crm/contacts";

/*
 * Payments for orders placed on published funnels.
 * Rules: amounts come from the product row; an order becomes "paid" only from the provider's
 * status API; webhooks are authenticated by the notify token and only trigger that check;
 * every step is recorded in payment_events.
 */

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

function errorMessage(e: unknown) {
  if (e instanceof CinetPayError) return `${e.message}${e.apiStatus ? ` (${e.apiStatus})` : ""}`;
  return e instanceof Error ? e.message : "Erreur inconnue";
}

async function logEvent(db: Db, orderId: string, kind: string, providerStatus?: string | null, detail?: string | null) {
  await db.insert(paymentEvents).values({ orderId, kind, providerStatus: providerStatus ?? null, detail: detail?.slice(0, 1000) ?? null });
}

// ── Provider accounts ───────────────────────────────────────────────────────

const providerSchema = z.object({
  country: z.enum(Object.keys(CINETPAY_COUNTRIES) as [CinetPayCountry, ...CinetPayCountry[]], { error: "Choisissez un pays" }),
  environment: z.enum(["sandbox", "production"]),
  apiKey: z.string().trim().min(1, "Clé API requise").max(500),
  apiPassword: z.string().trim().min(1, "Mot de passe API requis").max(500),
});

/** Payment settings are restricted to owners and admins. */
async function requirePaymentsAdmin(db: Db, userId: string, workspaceId: string) {
  return requireMembership(db, userId, workspaceId, "delete");
}

export async function saveProvider(db: Db, userId: string, workspaceId: string, input: unknown) {
  await requirePaymentsAdmin(db, userId, workspaceId);
  const parsed = providerSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  const { country, environment, apiKey, apiPassword } = parsed.data;
  const credentials = encryptSecret(JSON.stringify({ apiKey, apiPassword }));
  const [row] = await db
    .insert(paymentProviders)
    .values({ workspaceId, provider: "cinetpay", environment, country, credentials })
    .onConflictDoUpdate({
      target: [paymentProviders.workspaceId, paymentProviders.provider, paymentProviders.country],
      set: { environment, credentials, status: "unverified", lastError: null, lastCheckedAt: null },
    })
    .returning();
  return row;
}

export async function listProviders(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select({
      id: paymentProviders.id,
      provider: paymentProviders.provider,
      environment: paymentProviders.environment,
      country: paymentProviders.country,
      status: paymentProviders.status,
      lastError: paymentProviders.lastError,
      lastCheckedAt: paymentProviders.lastCheckedAt,
    })
    .from(paymentProviders)
    .where(eq(paymentProviders.workspaceId, workspaceId));
}

async function requireProvider(db: Db, userId: string, providerId: string) {
  if (!isUuid(providerId)) throw new NotFoundError();
  const [row] = await db.select().from(paymentProviders).where(eq(paymentProviders.id, providerId));
  if (!row) throw new NotFoundError();
  await requirePaymentsAdmin(db, userId, row.workspaceId);
  return row;
}

/** Real check: authenticates against the provider with the stored credentials. */
export async function verifyProvider(db: Db, userId: string, providerId: string, factory: GatewayFactory = defaultGatewayFactory) {
  const row = await requireProvider(db, userId, providerId);
  let status: "verified" | "failed" = "verified";
  let lastError: string | null = null;
  try {
    await factory(row).verifyConnection();
  } catch (e) {
    status = "failed";
    lastError = errorMessage(e);
  }
  const [updated] = await db
    .update(paymentProviders)
    .set({ status, lastError, lastCheckedAt: sql`now()` })
    .where(eq(paymentProviders.id, row.id))
    .returning();
  return updated;
}

export async function removeProvider(db: Db, userId: string, providerId: string) {
  const row = await requireProvider(db, userId, providerId);
  await db.delete(paymentProviders).where(eq(paymentProviders.id, row.id));
}

// ── Products ────────────────────────────────────────────────────────────────

const currencies = [...new Set(Object.values(CINETPAY_COUNTRIES).map((c) => c.currency))] as [string, ...string[]];

const productSchema = z.object({
  name: z.string().trim().min(1, "Nom requis").max(120),
  price: z.coerce.number({ error: "Prix invalide" }).int("Prix en unités entières (sans centimes)").positive("Prix supérieur à 0").max(100_000_000),
  currency: z.enum(currencies, { error: `Devise : ${currencies.join(", ")}` }),
});

export async function createProduct(db: Db, userId: string, workspaceId: string, input: unknown) {
  await requireMembership(db, userId, workspaceId, "edit");
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  const [row] = await db.insert(products).values({ workspaceId, ...parsed.data }).returning();
  return row;
}

export async function listProducts(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return db.select().from(products).where(eq(products.workspaceId, workspaceId)).orderBy(desc(products.createdAt));
}

export async function setProductActive(db: Db, userId: string, productId: string, active: boolean) {
  if (!isUuid(productId)) throw new NotFoundError();
  const [row] = await db.select().from(products).where(eq(products.id, productId));
  if (!row) throw new NotFoundError();
  await requireMembership(db, userId, row.workspaceId, "edit");
  const [updated] = await db.update(products).set({ active }).where(eq(products.id, row.id)).returning();
  return updated;
}

// ── Checkout (public) ───────────────────────────────────────────────────────

export class CheckoutError extends Error {
  constructor(readonly code: "invalid" | "unavailable" | "rate_limited" | "provider", message: string, readonly fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "CheckoutError";
  }
}

const customerSchema = z.object({
  firstName: z.string().trim().min(2, "Prénom : 2 caractères minimum").max(80),
  lastName: z.string().trim().min(2, "Nom : 2 caractères minimum").max(80),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s.-]/g, ""))
    .refine((v) => v === "" || /^\+[1-9][0-9]{7,14}$/.test(v), "Téléphone au format international, ex. +2250700000000")
    .optional(),
});

export const CHECKOUT_LIMIT_PER_10_MIN = 10;

export function appBaseUrl() {
  const url = siteConfig().appUrl;
  if (!url) throw new CheckoutError("unavailable", "Paiement indisponible : l’adresse publique de l’application (APP_URL) n’est pas configurée.");
  return url.origin;
}

/**
 * Creates the order and the provider payment, and returns where to send the buyer.
 * Everything that matters is resolved server side from the live publication: product, price, workspace.
 */
export async function startCheckout(
  db: Db,
  input: { site: PublicSite; path: string; sectionId: string; customer: unknown; ip: string | null; visitorId?: string | null },
  factory: GatewayFactory = defaultGatewayFactory,
) {
  // With the visitor id, the same A/B arm the buyer saw is resolved again.
  const page = await resolvePublishedPage(db, input.site, input.path, input.visitorId ?? null);
  const section = page?.content.sections.find((s) => s.id === input.sectionId && s.type === "checkout");
  if (!page || !section || section.type !== "checkout") throw new CheckoutError("unavailable", "Ce formulaire de commande n’est plus en ligne.");

  const customer = customerSchema.safeParse(input.customer);
  if (!customer.success) throw new CheckoutError("invalid", "Vérifiez vos informations.", fieldErrorsOf(customer.error));

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, section.productId), eq(products.workspaceId, page.workspaceId), eq(products.active, true)));
  if (!product) throw new CheckoutError("unavailable", "Ce produit n’est plus disponible.");

  const candidates = await db
    .select()
    .from(paymentProviders)
    .where(and(eq(paymentProviders.workspaceId, page.workspaceId), eq(paymentProviders.status, "verified")));
  const provider = candidates
    .filter((p) => CINETPAY_COUNTRIES[p.country as CinetPayCountry]?.currency === product.currency)
    .sort((a, b) => (a.environment === "production" ? -1 : 1) - (b.environment === "production" ? -1 : 1))[0];
  if (!provider) throw new CheckoutError("unavailable", "Le paiement en ligne n’est pas disponible pour le moment.");

  const ipHash = input.ip ? sha256(`tunnels-ia:${input.ip}`) : null;
  if (ipHash) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.ipHash, ipHash), gt(orders.createdAt, sql`now() - interval '10 minutes'`)));
    if (n >= CHECKOUT_LIMIT_PER_10_MIN) throw new CheckoutError("rate_limited", "Trop de tentatives. Réessayez dans quelques minutes.");
  }

  const base = appBaseUrl();
  const c = customer.data;
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
      providerId: provider.id,
      merchantTransactionId: `TIA${randomBytes(12).toString("hex").toUpperCase()}`,
      customerFirstName: c.firstName,
      customerLastName: c.lastName,
      customerEmail: c.email,
      customerPhone: c.phone || null,
      ipHash,
      visitorId: input.visitorId ?? null,
      experimentId: page.experimentId,
    })
    .returning();
  await logEvent(db, order.id, "order_created", null, `${product.price} ${product.currency}`);
  await recordCheckoutSubmitted(db, order);

  try {
    const result = await factory(provider).createPayment({
      merchantTransactionId: order.merchantTransactionId,
      amount: order.amount,
      currency: order.currency,
      designation: product.name.slice(0, 100),
      customer: { firstName: c.firstName, lastName: c.lastName, email: c.email, phone: c.phone || undefined },
      successUrl: `${base}/paiement/retour?commande=${order.id}`,
      failedUrl: `${base}/paiement/retour?commande=${order.id}&issue=echec`,
      notifyUrl: `${base}/api/webhooks/cinetpay`,
    });
    if (!result.paymentUrl || !result.notifyToken) throw new Error("Réponse du prestataire incomplète (payment_url ou notify_token manquant).");
    await db
      .update(orders)
      .set({
        status: "pending",
        providerTransactionId: result.providerTransactionId,
        notifyTokenHash: sha256(result.notifyToken),
        paymentUrl: result.paymentUrl,
        providerStatus: result.status,
        updatedAt: sql`now()`,
      })
      .where(eq(orders.id, order.id));
    await logEvent(db, order.id, "payment_initiated", result.status);
    return { orderId: order.id, paymentUrl: result.paymentUrl };
  } catch (e) {
    await db.update(orders).set({ status: "failed", providerStatus: "INIT_ERROR", updatedAt: sql`now()` }).where(eq(orders.id, order.id));
    await logEvent(db, order.id, "error", null, `Initialisation : ${errorMessage(e)}`);
    throw new CheckoutError("provider", "Le paiement n’a pas pu démarrer. Aucun montant n’a été débité. Réessayez plus tard.");
  }
}

// ── Status (webhooks, return page, dashboard) ───────────────────────────────

/**
 * Asks the provider for the canonical status and applies it. Idempotent; "paid" is final
 * and never downgraded.
 */
export async function refreshOrderStatus(db: Db, orderId: string, factory: GatewayFactory = defaultGatewayFactory, origin = "status_check"): Promise<Order> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new NotFoundError();
  if (order.status === "paid" || !order.providerId || !order.providerTransactionId) return order;
  const [provider] = await db.select().from(paymentProviders).where(eq(paymentProviders.id, order.providerId));
  if (!provider) {
    await logEvent(db, order.id, "error", null, "Prestataire supprimé : statut non vérifiable.");
    return order;
  }

  let status;
  try {
    status = await factory(provider).findPayment(order.merchantTransactionId);
  } catch (e) {
    await logEvent(db, order.id, "error", null, `Vérification (${origin}) : ${errorMessage(e)}`);
    return order;
  }
  if (status.merchantTransactionId !== order.merchantTransactionId || status.providerTransactionId !== order.providerTransactionId) {
    await logEvent(db, order.id, "error", status.status, "Identifiants de la réponse différents de la commande : statut ignoré.");
    return order;
  }

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    const next = status.outcome === "pending" ? "pending" : status.outcome;
    if (locked.status === "paid" || (locked.status === next && locked.providerStatus === status.status)) {
      await tx.insert(paymentEvents).values({ orderId, kind: `${origin}_unchanged`, providerStatus: status.status });
      return locked;
    }
    const [updated] = await tx
      .update(orders)
      .set({ status: next, providerStatus: status.status, paidAt: next === "paid" ? sql`now()` : null, updatedAt: sql`now()` })
      .where(eq(orders.id, orderId))
      .returning();
    await tx.insert(paymentEvents).values({ orderId, kind: "status_changed", providerStatus: status.status, detail: `${locked.status} → ${next} (${origin})` });
    if (next === "paid") await recordContactPurchase(tx, updated);
    return updated;
  });
  // Deduplicated by order id, so a replay cannot count the sale twice.
  if (result.status === "paid") await recordOrderPaid(db, result);
  return result;
}

export class WebhookRejected extends Error {
  constructor(readonly httpStatus: 400 | 401 | 404, message: string) {
    super(message);
  }
}

/** CinetPay notification: authenticate by notify token, then verify through the status API. */
export async function handleCinetPayWebhook(db: Db, body: unknown, factory: GatewayFactory = defaultGatewayFactory) {
  let n;
  try {
    n = parseWebhook(body);
  } catch (e) {
    throw new WebhookRejected(400, errorMessage(e));
  }
  const [order] = await db.select().from(orders).where(eq(orders.merchantTransactionId, n.merchantTransactionId));
  if (!order) throw new WebhookRejected(404, "Commande inconnue");
  const expected = order.notifyTokenHash ? Buffer.from(order.notifyTokenHash, "hex") : Buffer.alloc(0);
  const received = Buffer.from(sha256(n.notifyToken), "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    await logEvent(db, order.id, "webhook_rejected", null, "notify_token invalide");
    throw new WebhookRejected(401, "Jeton de notification invalide");
  }
  await logEvent(db, order.id, "webhook_received", null, `transaction_id=${n.transactionId}`);
  return refreshOrderStatus(db, order.id, factory, "webhook");
}

// ── Dashboard ───────────────────────────────────────────────────────────────

export async function listOrders(db: Db, userId: string, workspaceId: string, limit = 100) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select({
      order: orders,
      funnelName: funnels.name,
      pageName: pages.name,
    })
    .from(orders)
    .leftJoin(funnels, eq(funnels.id, orders.funnelId))
    .leftJoin(pages, eq(pages.id, orders.pageId))
    .where(eq(orders.workspaceId, workspaceId))
    .orderBy(desc(orders.createdAt))
    .limit(limit);
}

export async function getOrderForUser(db: Db, userId: string, orderId: string) {
  if (!isUuid(orderId)) throw new NotFoundError();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) throw new NotFoundError();
  await requireMembership(db, userId, order.workspaceId, "read");
  const events = await db.select().from(paymentEvents).where(eq(paymentEvents.orderId, order.id)).orderBy(paymentEvents.createdAt);
  return { order, events };
}

export async function refreshOrderForUser(db: Db, userId: string, orderId: string, factory: GatewayFactory = defaultGatewayFactory) {
  const { order } = await getOrderForUser(db, userId, orderId);
  return refreshOrderStatus(db, order.id, factory, "manual_check");
}

/** Public return page: a buyer may see their order's state, never its personal data. */
export async function publicOrderStatus(db: Db, orderId: string, factory: GatewayFactory = defaultGatewayFactory) {
  if (!isUuid(orderId)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId));
  if (!order) return null;
  const fresh = order.status === "pending" ? await refreshOrderStatus(db, order.id, factory, "return_page") : order;
  return { status: fresh.status, productName: fresh.productName, amount: fresh.amount, currency: fresh.currency, reference: fresh.merchantTransactionId };
}


