import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { contactEvents, contacts, events, funnels, orders, pages, segments, type Contact, type ContactStatus } from "@/db/schema";
import { NotFoundError, ValidationError } from "../errors";
import { fieldErrorsOf } from "../validation";
import { isUuid, requireMembership, type Permission } from "../workspaces";

/*
 * Light CRM. Contacts are created only by people themselves, on a published page (lead form
 * or order form): never imported, enriched or guessed. There is no e-mailing of any kind.
 * Reads: every member. Status and tags: editors. Export and deletion: owners and admins.
 */

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

export const STATUS_LABELS: Record<ContactStatus, string> = { lead: "Prospect", customer: "Client", lost: "Perdu" };

export const EVENT_LABELS: Record<string, string> = {
  lead_submitted: "Inscription via un formulaire",
  order_started: "Commande commencée",
  order_paid: "Paiement confirmé",
  status_changed: "Statut modifié",
  tags_changed: "Tags modifiés",
};

/** Where an anonymous visitor first came from, if measured. */
async function firstSource(db: Executor, funnelId: string | null, visitorId: string | null | undefined) {
  if (!funnelId || !visitorId) return null;
  const [row] = await db
    .select({ source: events.source })
    .from(events)
    .where(and(eq(events.funnelId, funnelId), eq(events.visitorId, visitorId), eq(events.type, "page_view")))
    .orderBy(asc(events.createdAt))
    .limit(1);
  return row?.source ?? null;
}

/**
 * Creates the contact or updates the existing one (same e-mail in the workspace), then
 * appends the event. The first origin (funnel, page, variant, source) is kept.
 */
export async function recordContact(
  db: Executor,
  input: {
    workspaceId: string;
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string | null;
    funnelId: string | null;
    pageId: string | null;
    variantLabel: string | null;
    visitorId?: string | null;
    consent?: boolean;
  },
  event: { kind: "lead_submitted" | "order_started"; detail?: string; orderId?: string; ipHash?: string | null },
) {
  const source = await firstSource(db, input.funnelId, input.visitorId);
  const [row] = await db
    .insert(contacts)
    .values({
      workspaceId: input.workspaceId,
      firstName: input.firstName,
      lastName: input.lastName ?? "",
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      source,
      funnelId: input.funnelId,
      pageId: input.pageId,
      variantLabel: input.variantLabel,
      consentAt: input.consent ? sql`now()` : null,
    })
    .onConflictDoUpdate({
      target: [contacts.workspaceId, contacts.email],
      set: {
        phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
        lastName: sql`case when ${contacts.lastName} = '' then excluded.last_name else ${contacts.lastName} end`,
        consentAt: sql`coalesce(${contacts.consentAt}, excluded.consent_at)`,
        lastActivityAt: sql`now()`,
      },
    })
    .returning({ id: contacts.id });
  await db.insert(contactEvents).values({ contactId: row.id, kind: event.kind, detail: event.detail ?? null, orderId: event.orderId ?? null, ipHash: event.ipHash ?? null });
  return row.id;
}

/** Called once, in the transaction where an order becomes paid. */
export async function recordContactPurchase(db: Executor, order: { id: string; contactId: string | null; productName: string; amount: number; currency: string }) {
  if (!order.contactId) return;
  await db.update(contacts).set({ status: "customer", lastActivityAt: sql`now()` }).where(eq(contacts.id, order.contactId));
  await db.insert(contactEvents).values({
    contactId: order.contactId,
    kind: "order_paid",
    detail: `${order.productName} · ${order.amount} ${order.currency}`,
    orderId: order.id,
  });
}

// ── Reading ───────────────────────────────────────────────────────────────────

export const filtersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["lead", "customer", "lost"]).optional(),
  tag: z.string().trim().max(30).optional(),
  funnelId: z.string().refine(isUuid).optional(),
  source: z.string().trim().max(60).optional(),
  buyer: z.enum(["yes", "no"]).optional(),
});
export type ContactFilters = z.infer<typeof filtersSchema>;

/** Unknown or malformed filters are dropped, never applied loosely. */
export function normalizeFilters(raw: Record<string, unknown>): ContactFilters {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string" && v !== "") out[k] = v;
  const parsed = filtersSchema.safeParse(out);
  if (parsed.success) return parsed.data;
  const bad = new Set(parsed.error.issues.map((i) => String(i.path[0])));
  return filtersSchema.parse(Object.fromEntries(Object.entries(out).filter(([k]) => !bad.has(k) && k in filtersSchema.shape)));
}

const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);
const paid = sql`exists (select 1 from ${orders} where ${orders.contactId} = ${contacts.id} and ${orders.status} = 'paid')`;

function whereOf(workspaceId: string, f: ContactFilters) {
  const where: SQL[] = [eq(contacts.workspaceId, workspaceId)];
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.push(or(ilike(contacts.firstName, like), ilike(contacts.lastName, like), ilike(contacts.email, like), ilike(contacts.phone, like))!);
  }
  if (f.status) where.push(eq(contacts.status, f.status));
  if (f.tag) where.push(sql`${f.tag.toLowerCase()} = any(${contacts.tags})`);
  if (f.funnelId) where.push(eq(contacts.funnelId, f.funnelId));
  if (f.source) where.push(f.source === "(direct)" ? isNull(contacts.source) : eq(contacts.source, f.source));
  if (f.buyer === "yes") where.push(paid);
  if (f.buyer === "no") where.push(sql`not ${paid}`);
  return and(...where);
}

export async function listContacts(db: Db, userId: string, workspaceId: string, rawFilters: Record<string, unknown> = {}, opts: { limit?: number; offset?: number } = {}) {
  await requireMembership(db, userId, workspaceId, "read");
  const f = normalizeFilters(rawFilters);
  const where = whereOf(workspaceId, f);
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        contact: contacts,
        funnelName: funnels.name,
        paidOrders: sql<number>`(select count(*)::int from ${orders} where ${orders.contactId} = ${contacts.id} and ${orders.status} = 'paid')`,
      })
      .from(contacts)
      .leftJoin(funnels, eq(funnels.id, contacts.funnelId))
      .where(where)
      .orderBy(desc(contacts.lastActivityAt))
      .limit(limit)
      .offset(Math.max(opts.offset ?? 0, 0)),
    db.select({ total: count() }).from(contacts).where(where),
  ]);
  return { filters: f, total, rows };
}

async function requireContact(db: Db, userId: string, contactId: string, permission: Permission) {
  if (!isUuid(contactId)) throw new NotFoundError("Contact introuvable");
  const [contact] = await db.select().from(contacts).where(eq(contacts.id, contactId));
  if (!contact) throw new NotFoundError("Contact introuvable");
  await requireMembership(db, userId, contact.workspaceId, permission);
  return contact;
}

export async function getContact(db: Db, userId: string, contactId: string) {
  const contact = await requireContact(db, userId, contactId, "read");
  const [orderRows, history, origin] = await Promise.all([
    db
      .select({ id: orders.id, productName: orders.productName, amount: orders.amount, currency: orders.currency, status: orders.status, createdAt: orders.createdAt, paidAt: orders.paidAt })
      .from(orders)
      .where(eq(orders.contactId, contact.id))
      .orderBy(desc(orders.createdAt)),
    db.select().from(contactEvents).where(eq(contactEvents.contactId, contact.id)).orderBy(desc(contactEvents.createdAt)).limit(200),
    db
      .select({ funnelName: funnels.name, pageName: pages.name })
      .from(contacts)
      .leftJoin(funnels, eq(funnels.id, contacts.funnelId))
      .leftJoin(pages, eq(pages.id, contacts.pageId))
      .where(eq(contacts.id, contact.id)),
  ]);
  return { contact, orders: orderRows, history, origin: origin[0] ?? { funnelName: null, pageName: null } };
}

// ── Changes ───────────────────────────────────────────────────────────────────

export async function setContactStatus(db: Db, userId: string, contactId: string, status: unknown) {
  const contact = await requireContact(db, userId, contactId, "edit");
  const parsed = z.enum(["lead", "customer", "lost"]).safeParse(status);
  if (!parsed.success) throw new ValidationError("Statut inconnu.");
  if (parsed.data === contact.status) return contact;
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(contacts).set({ status: parsed.data }).where(eq(contacts.id, contact.id)).returning();
    await tx.insert(contactEvents).values({ contactId: contact.id, kind: "status_changed", detail: `${STATUS_LABELS[contact.status]} → ${STATUS_LABELS[parsed.data]}`, userId });
    return updated;
  });
}

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Tag vide")
  .max(30, "30 caractères maximum")
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} _-]*$/u, "Lettres, chiffres, espaces, - et _ uniquement");
export const MAX_TAGS = 20;

export async function setContactTags(db: Db, userId: string, contactId: string, change: { add?: unknown; remove?: unknown }) {
  const contact = await requireContact(db, userId, contactId, "edit");
  let tags = [...contact.tags];
  if (change.add !== undefined) {
    const parsed = tagSchema.safeParse(change.add);
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { tag: parsed.error.issues[0].message });
    if (!tags.includes(parsed.data)) tags.push(parsed.data);
  }
  if (typeof change.remove === "string") tags = tags.filter((t) => t !== change.remove);
  if (tags.length > MAX_TAGS) throw new ValidationError(`${MAX_TAGS} tags maximum par contact.`, { tag: `${MAX_TAGS} tags maximum` });
  if (tags.join("\n") === contact.tags.join("\n")) return contact;
  return db.transaction(async (tx) => {
    const [updated] = await tx.update(contacts).set({ tags }).where(eq(contacts.id, contact.id)).returning();
    await tx.insert(contactEvents).values({ contactId: contact.id, kind: "tags_changed", detail: tags.join(", ") || "(aucun)", userId });
    return updated;
  });
}

/**
 * Erases a person on request. Their orders stay (accounting) but lose every personal field;
 * measured events never held personal data. Cannot be undone.
 */
export async function deleteContact(db: Db, userId: string, contactId: string) {
  const contact = await requireContact(db, userId, contactId, "delete");
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({ customerFirstName: "Contact supprimé", customerLastName: "", customerEmail: "", customerPhone: null, contactId: null, updatedAt: sql`now()` })
      .where(and(eq(orders.workspaceId, contact.workspaceId), or(eq(orders.contactId, contact.id), eq(orders.customerEmail, contact.email))));
    await tx.delete(contacts).where(eq(contacts.id, contact.id));
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

/** Spreadsheet formula injection: a cell starting with = + - @ is shown as text. */
function csvCell(value: unknown) {
  let s = value === null || value === undefined ? "" : value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function exportContactsCsv(db: Db, userId: string, workspaceId: string, rawFilters: Record<string, unknown> = {}) {
  await requireMembership(db, userId, workspaceId, "delete");
  const where = whereOf(workspaceId, normalizeFilters(rawFilters));
  const rows = await db
    .select({ c: contacts, funnelName: funnels.name })
    .from(contacts)
    .leftJoin(funnels, eq(funnels.id, contacts.funnelId))
    .where(where)
    .orderBy(asc(contacts.createdAt));
  const head = ["prenom", "nom", "email", "telephone", "statut", "tags", "source", "tunnel", "variante", "consentement", "cree_le", "derniere_activite"];
  const lines = rows.map(({ c, funnelName }) =>
    [c.firstName, c.lastName, c.email, c.phone, STATUS_LABELS[c.status], c.tags.join(" "), c.source ?? "(direct)", funnelName, c.variantLabel, c.consentAt, c.createdAt, c.lastActivityAt]
      .map(csvCell)
      .join(","),
  );
  // BOM so spreadsheet software reads the accents as UTF-8.
  return { csv: `﻿${[head.join(","), ...lines].join("\r\n")}\r\n`, count: rows.length };
}

// ── Segments (saved filters) ─────────────────────────────────────────────────

export async function createSegment(db: Db, userId: string, workspaceId: string, input: { name: unknown; filters: Record<string, unknown> }) {
  await requireMembership(db, userId, workspaceId, "edit");
  const name = z.string().trim().min(1, "Nommez le segment").max(60).safeParse(input.name);
  if (!name.success) throw new ValidationError(name.error.issues[0].message, fieldErrorsOf(name.error));
  const filters = normalizeFilters(input.filters);
  if (Object.keys(filters).length === 0) throw new ValidationError("Choisissez au moins un filtre avant d’enregistrer un segment.");
  const [row] = await db.insert(segments).values({ workspaceId, name: name.data, filters }).returning();
  return row;
}

/** Each segment with its current size (recomputed on every read). */
export async function listSegments(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  const rows = await db.select().from(segments).where(eq(segments.workspaceId, workspaceId)).orderBy(asc(segments.name));
  return Promise.all(
    rows.map(async (s) => {
      const [{ n }] = await db.select({ n: count() }).from(contacts).where(whereOf(workspaceId, normalizeFilters(s.filters)));
      return { ...s, size: n };
    }),
  );
}

export async function deleteSegment(db: Db, userId: string, segmentId: string) {
  if (!isUuid(segmentId)) throw new NotFoundError();
  const [s] = await db.select().from(segments).where(eq(segments.id, segmentId));
  if (!s) throw new NotFoundError();
  await requireMembership(db, userId, s.workspaceId, "edit");
  await db.delete(segments).where(eq(segments.id, s.id));
}

/** Tags and sources in use, for filter menus. */
export async function contactFacets(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  const [tags, sources] = await Promise.all([
    db.execute<{ tag: string }>(sql`select distinct unnest(${contacts.tags}) as tag from ${contacts} where ${contacts.workspaceId} = ${workspaceId} order by 1 limit 100`),
    db.selectDistinct({ source: contacts.source }).from(contacts).where(and(eq(contacts.workspaceId, workspaceId), isNotNull(contacts.source))).limit(50),
  ]);
  return { tags: [...tags].map((r) => r.tag), sources: sources.map((r) => r.source!) };
}

export type { Contact };
