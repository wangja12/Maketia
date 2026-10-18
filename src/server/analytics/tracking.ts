import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "@/db";
import { events, type Order } from "@/db/schema";

/*
 * First-party measurement, stored in Postgres. It stands in for PostHog, which could not be
 * configured (no account, closed network); `forwardEvent` is where a PostHog sink would plug in.
 *
 * Trust model:
 * - page_view / cta_click come from the browser, but only with a view token the server signed
 *   when it rendered the page: the browser cannot invent a page, variant or experiment.
 * - checkout_submitted / order_paid are written by the server from the order itself.
 * - One unique index deduplicates everything (per visitor, per page, per session or order).
 */

export const VISITOR_COOKIE = "tia_v";
export const SESSION_COOKIE = "tia_s";
/** The visitor id cookie of a request (set by the proxy on published sites), if well-formed. */
export function visitorCookieOf(request: Request) {
  const match = (request.headers.get("cookie") ?? "").match(new RegExp(`(?:^|;\\s*)${VISITOR_COOKIE}=([A-Za-z0-9_-]{8,64})`));
  return match?.[1] ?? null;
}

const TOKEN_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ViewContext = {
  workspaceId: string;
  funnelId: string;
  pageId: string;
  variantLabel: string;
  experimentId: string | null;
  visitorId: string;
  sessionId: string;
};

function secret() {
  const s = process.env.ANALYTICS_SECRET;
  return s && s.length >= 32 ? s : null;
}

/** Measurement is off unless ANALYTICS_SECRET (≥ 32 characters) is configured. */
export function trackingEnabled() {
  return secret() !== null;
}

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (data: string, key: string) => createHmac("sha256", key).update(data).digest("base64url");

export function signViewToken(ctx: ViewContext, now = Date.now()): string | null {
  const key = secret();
  if (!key) return null;
  const data = b64(JSON.stringify({ ...ctx, ts: now }));
  return `${data}.${sign(data, key)}`;
}

export function verifyViewToken(token: string, now = Date.now()): ViewContext | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 2000) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;
  const expected = Buffer.from(sign(data, key));
  const received = Buffer.from(mac);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString()) as ViewContext & { ts: number };
    if (typeof payload.ts !== "number" || now - payload.ts > TOKEN_MAX_AGE_MS || payload.ts - now > 60_000) return null;
    const { workspaceId, funnelId, pageId, variantLabel, experimentId, visitorId, sessionId } = payload;
    return { workspaceId, funnelId, pageId, variantLabel, experimentId, visitorId, sessionId };
  } catch {
    return null;
  }
}

/** Referrer host or utm_source, shortened; null when unknown. */
export function normalizeSource(input: { referrer?: unknown; utmSource?: unknown }, ownHost?: string) {
  if (typeof input.utmSource === "string" && input.utmSource.trim()) return input.utmSource.trim().toLowerCase().slice(0, 60);
  if (typeof input.referrer === "string" && URL.canParse(input.referrer)) {
    const host = new URL(input.referrer).hostname.replace(/^www\./, "");
    if (host && host !== ownHost) return host.slice(0, 60);
  }
  return null;
}

type EventRow = typeof events.$inferInsert;

/** Insert once; a duplicate (same visitor, page, type, dedup key) is silently ignored. */
async function insertEvent(db: Db, row: EventRow) {
  const inserted = await db.insert(events).values(row).onConflictDoNothing().returning({ id: events.id });
  if (inserted.length) await forwardEvent(row);
  return inserted.length > 0;
}

/** Extension point for an external analytics sink (PostHog). Nothing is sent today. */
async function forwardEvent(_row: EventRow) {}

export async function recordBrowserEvent(
  db: Db,
  input: { token: unknown; type: unknown; target?: unknown; source?: string | null; visitorCookie?: string | null },
) {
  if (input.type !== "page_view" && input.type !== "cta_click") return false;
  const ctx = verifyViewToken(String(input.token ?? ""));
  // The token is bound to the visitor it was issued for.
  if (!ctx || (input.visitorCookie && input.visitorCookie !== ctx.visitorId)) return false;
  const target = typeof input.target === "string" ? input.target.slice(0, 80) : "";
  return insertEvent(db, {
    workspaceId: ctx.workspaceId,
    funnelId: ctx.funnelId,
    pageId: ctx.pageId,
    variantLabel: ctx.variantLabel,
    experimentId: ctx.experimentId,
    type: input.type,
    visitorId: ctx.visitorId,
    sessionId: ctx.sessionId,
    // One view per page per session; one click per call to action per session.
    dedupKey: input.type === "page_view" ? `${ctx.pageId}:${ctx.sessionId}` : `${ctx.pageId}:${ctx.sessionId}:${target}`,
    source: input.source ?? null,
  });
}

type OrderForEvent = Pick<Order, "id" | "workspaceId" | "funnelId" | "pageId" | "variantLabel" | "experimentId" | "visitorId" | "amount" | "currency">;

/** Written by the server when an order is created from a checkout form. */
export async function recordCheckoutSubmitted(db: Db, order: OrderForEvent) {
  if (!order.funnelId || !order.visitorId) return false;
  return insertEvent(db, {
    workspaceId: order.workspaceId,
    funnelId: order.funnelId,
    pageId: order.pageId,
    variantLabel: order.variantLabel,
    experimentId: order.experimentId,
    type: "checkout_submitted",
    visitorId: order.visitorId,
    dedupKey: order.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
}

/** Written only when the provider has confirmed the payment. */
export async function recordOrderPaid(db: Db, order: OrderForEvent) {
  if (!order.funnelId) return false;
  return insertEvent(db, {
    workspaceId: order.workspaceId,
    funnelId: order.funnelId,
    pageId: order.pageId,
    variantLabel: order.variantLabel,
    experimentId: order.experimentId,
    type: "order_paid",
    // Buyers who refused tracking still count as a sale, under an order-scoped id.
    visitorId: order.visitorId ?? `order:${order.id}`,
    dedupKey: order.id,
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
  });
}
