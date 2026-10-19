import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { saspayWebhookEndpoints, saspayWebhookEvents } from "@/db/schema";
import { NotFoundError, ValidationError } from "../errors";
import { encryptSecret } from "../secrets";
import { siteConfig } from "../site-config";
import { requireMembership } from "../workspaces";
import { confirmOrderPaidManually } from "./service";

/*
 * SasPay notifications configured by each seller in their own SasPay dashboard.
 *
 * Status: RECEPTION ONLY. The SasPay signature scheme (headers, signed string, encoding,
 * tolerance) and the exact transaction.success payload could not be read from the official
 * documentation from this environment (docs.saspay.me unreachable). Until they are confirmed,
 * every notification is stored raw and marked "scheme_unconfirmed": it is never trusted, never
 * marks an order paid, never triggers a delivery or a Meta Purchase. The seller can reconcile
 * it by hand after checking their SasPay dashboard (audited).
 */
export const SIGNATURE_SCHEME_CONFIRMED = false;

const MAX_BODY_BYTES = 256 * 1024;

/** Owners and admins only: payment settings and the reconciliation queue hold personal data. */
async function requirePaymentsAdmin(db: Db, userId: string, workspaceId: string) {
  return requireMembership(db, userId, workspaceId, "delete");
}

export function webhookUrl(token: string) {
  const base = siteConfig().appUrl;
  return base ? `${base.origin}/api/webhooks/saspay/${token}` : null;
}

export async function getWebhookSetup(db: Db, userId: string, workspaceId: string) {
  await requirePaymentsAdmin(db, userId, workspaceId);
  let [endpoint] = await db.select().from(saspayWebhookEndpoints).where(eq(saspayWebhookEndpoints.workspaceId, workspaceId));
  if (!endpoint) {
    [endpoint] = await db
      .insert(saspayWebhookEndpoints)
      .values({ workspaceId, token: randomBytes(24).toString("base64url") })
      .onConflictDoNothing({ target: saspayWebhookEndpoints.workspaceId })
      .returning();
    endpoint ??= (await db.select().from(saspayWebhookEndpoints).where(eq(saspayWebhookEndpoints.workspaceId, workspaceId)))[0];
  }
  const [{ toReconcile }] = await db
    .select({ toReconcile: sql<number>`count(*)::int` })
    .from(saspayWebhookEvents)
    .where(and(eq(saspayWebhookEvents.workspaceId, workspaceId), eq(saspayWebhookEvents.status, "to_reconcile")));
  const hasSecret = Boolean(endpoint.signingSecret);
  // Honest states, in the order the seller goes through them.
  const state = !hasSecret
    ? "secret_missing"
    : !endpoint.lastEventAt
      ? "waiting_for_test"
      : SIGNATURE_SCHEME_CONFIRMED
        ? "verified"
        : "received_unverified";
  return {
    url: webhookUrl(endpoint.token),
    hasSecret,
    secretUpdatedAt: endpoint.secretUpdatedAt,
    lastEventAt: endpoint.lastEventAt,
    toReconcile,
    state,
    automaticProcessing: false as const,
  };
}

/** The webhook signing secret, pasted once by the seller; stored encrypted, never shown again. */
export async function setSigningSecret(db: Db, userId: string, workspaceId: string, secret: unknown) {
  await getWebhookSetup(db, userId, workspaceId);
  const parsed = z.string().trim().min(16, "Secret trop court : collez le secret de signature complet.").max(500).safeParse(secret);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { secret: parsed.error.issues[0].message });
  if (/^sk_(live|test)_/i.test(parsed.data)) {
    const message = "Ceci ressemble à une clé API SasPay. Ne la donnez jamais : collez uniquement le secret de signature du webhook.";
    throw new ValidationError(message, { secret: message });
  }
  await db
    .update(saspayWebhookEndpoints)
    .set({ signingSecret: encryptSecret(parsed.data), secretUpdatedAt: sql`now()` })
    .where(eq(saspayWebhookEndpoints.workspaceId, workspaceId));
}

export async function clearSigningSecret(db: Db, userId: string, workspaceId: string) {
  await requirePaymentsAdmin(db, userId, workspaceId);
  await db.update(saspayWebhookEndpoints).set({ signingSecret: null, secretUpdatedAt: sql`now()` }).where(eq(saspayWebhookEndpoints.workspaceId, workspaceId));
}

/** New URL: the old one stops working at once (to use if it leaked). */
export async function rotateWebhookUrl(db: Db, userId: string, workspaceId: string) {
  await getWebhookSetup(db, userId, workspaceId);
  await db.update(saspayWebhookEndpoints).set({ token: randomBytes(24).toString("base64url") }).where(eq(saspayWebhookEndpoints.workspaceId, workspaceId));
}

const short = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : typeof v === "number" ? String(v) : null);

/**
 * Public endpoint. Stores the notification as received (raw body, signature-related headers)
 * and returns. Duplicates (provider retries) are stored once. Nothing else happens.
 */
export async function receiveSasPayWebhook(db: Db, token: string, rawBody: string, headers: Headers) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return { found: false as const };
  const [endpoint] = await db.select().from(saspayWebhookEndpoints).where(eq(saspayWebhookEndpoints.token, token));
  if (!endpoint) return { found: false as const };
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) return { found: true as const, stored: false, reason: "too_large" };

  const signatureHeaders: Record<string, string> = {};
  headers.forEach((value, name) => {
    if (/signature|timestamp/i.test(name)) signatureHeaders[name.toLowerCase()] = value.slice(0, 500);
  });
  let parsed: Record<string, unknown> = {};
  try {
    const j = JSON.parse(rawBody);
    if (j && typeof j === "object") parsed = j as Record<string, unknown>;
  } catch {
    // Not JSON: kept raw for the seller to look at.
  }
  const data = parsed.data && typeof parsed.data === "object" ? (parsed.data as Record<string, unknown>) : {};
  const [row] = await db
    .insert(saspayWebhookEvents)
    .values({
      workspaceId: endpoint.workspaceId,
      bodySha256: createHash("sha256").update(rawBody).digest("hex"),
      rawBody,
      signatureHeaders,
      verification: endpoint.signingSecret ? "scheme_unconfirmed" : "no_secret",
      // Display hints only, read from an unverified body.
      eventType: short(parsed.event ?? parsed.type, 60),
      transactionRef: short(data.id ?? data.reference ?? parsed.id, 80),
    })
    .onConflictDoNothing({ target: [saspayWebhookEvents.workspaceId, saspayWebhookEvents.bodySha256] })
    .returning({ id: saspayWebhookEvents.id });
  await db.update(saspayWebhookEndpoints).set({ lastEventAt: sql`now()` }).where(eq(saspayWebhookEndpoints.id, endpoint.id));
  return { found: true as const, stored: Boolean(row), duplicate: !row };
}

export async function listWebhookEvents(db: Db, userId: string, workspaceId: string, limit = 50) {
  await requirePaymentsAdmin(db, userId, workspaceId);
  return db
    .select()
    .from(saspayWebhookEvents)
    .where(eq(saspayWebhookEvents.workspaceId, workspaceId))
    .orderBy(desc(saspayWebhookEvents.receivedAt))
    .limit(Math.min(limit, 200));
}

async function requireEvent(db: Db, userId: string, eventId: number) {
  const [event] = await db.select().from(saspayWebhookEvents).where(eq(saspayWebhookEvents.id, eventId));
  if (!event) throw new NotFoundError();
  await requirePaymentsAdmin(db, userId, event.workspaceId);
  if (event.status !== "to_reconcile") throw new ValidationError("Cette notification est déjà traitée.");
  return event;
}

/**
 * The seller ties a stored notification to one pending order, after checking in their SasPay
 * dashboard that the transaction succeeded and is this buyer's. Manual, audited, no Meta event.
 */
export async function reconcileWebhookEvent(db: Db, userId: string, eventId: number, input: { orderId: string; attested: unknown; note?: unknown }) {
  const event = await requireEvent(db, userId, eventId);
  const order = await confirmOrderPaidManually(db, userId, input.orderId, { attested: input.attested, note: `notification n° ${event.id}${typeof input.note === "string" && input.note ? ` — ${input.note}` : ""}` });
  if (order.workspaceId !== event.workspaceId) throw new NotFoundError();
  await db
    .update(saspayWebhookEvents)
    .set({ status: "matched", matchedOrderId: order.id, resolvedBy: userId, resolvedAt: sql`now()`, note: typeof input.note === "string" ? input.note.slice(0, 300) : null })
    .where(eq(saspayWebhookEvents.id, event.id));
  return order;
}

export async function ignoreWebhookEvent(db: Db, userId: string, eventId: number, note: unknown) {
  const event = await requireEvent(db, userId, eventId);
  await db
    .update(saspayWebhookEvents)
    .set({ status: "ignored", resolvedBy: userId, resolvedAt: sql`now()`, note: typeof note === "string" ? note.slice(0, 300) : null })
    .where(eq(saspayWebhookEvents.id, event.id));
}
