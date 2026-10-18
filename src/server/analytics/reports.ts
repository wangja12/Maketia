import { and, count, countDistinct, desc, eq, gte, sql, sum, type SQL } from "drizzle-orm";
import type { Db } from "@/db";
import { events, pages } from "@/db/schema";
import { requireFunnel } from "../funnels";
import { isUuid } from "../workspaces";

/*
 * Funnel analytics, computed from the events table only (nothing estimated).
 * "Commandes commencées" are checkout forms submitted; "paiements" are confirmed by the provider.
 */

export const PERIODS = { "7": 7, "30": 30, "90": 90 } as const;
export type Period = keyof typeof PERIODS;

export type AnalyticsFilters = { period?: string; pageId?: string; variant?: string; source?: string };

export function normalizeFilters(f: AnalyticsFilters) {
  return {
    period: (f.period && f.period in PERIODS ? f.period : "30") as Period,
    pageId: f.pageId && isUuid(f.pageId) ? f.pageId : undefined,
    variant: f.variant && /^[A-D]$/.test(f.variant) ? f.variant : undefined,
    source: f.source && f.source.length <= 60 ? f.source : undefined,
  };
}

export async function getFunnelAnalytics(db: Db, userId: string, funnelId: string, filters: AnalyticsFilters = {}) {
  const funnel = await requireFunnel(db, userId, funnelId, "read");
  const f = normalizeFilters(filters);
  const since = sql`now() - make_interval(days => ${PERIODS[f.period]})`;
  const where: SQL[] = [eq(events.funnelId, funnel.id), gte(events.createdAt, since)];
  if (f.pageId) where.push(eq(events.pageId, f.pageId));
  if (f.variant) where.push(eq(events.variantLabel, f.variant));
  if (f.source) where.push(f.source === "(direct)" ? sql`${events.source} is null` : eq(events.source, f.source));
  const base = and(...where);

  const [totals] = await db
    .select({
      visitors: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.type} = 'page_view')::int`,
      sessions: sql<number>`count(distinct ${events.sessionId}) filter (where ${events.type} = 'page_view')::int`,
      pageViews: sql<number>`count(*) filter (where ${events.type} = 'page_view')::int`,
      ctaClicks: sql<number>`count(*) filter (where ${events.type} = 'cta_click')::int`,
      checkouts: sql<number>`count(*) filter (where ${events.type} = 'checkout_submitted')::int`,
      payments: sql<number>`count(*) filter (where ${events.type} = 'order_paid')::int`,
      buyers: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.type} = 'order_paid')::int`,
    })
    .from(events)
    .where(base);

  // Revenue per currency: amounts in different currencies are never added together.
  const revenue = await db
    .select({ currency: events.currency, total: sum(events.amount), orders: count() })
    .from(events)
    .where(and(base, eq(events.type, "order_paid")))
    .groupBy(events.currency);

  const byPage = await db
    .select({
      pageId: events.pageId,
      name: pages.name,
      variant: events.variantLabel,
      visitors: sql<number>`count(distinct ${events.visitorId}) filter (where ${events.type} = 'page_view')::int`,
      ctaClicks: sql<number>`count(*) filter (where ${events.type} = 'cta_click')::int`,
      checkouts: sql<number>`count(*) filter (where ${events.type} = 'checkout_submitted')::int`,
      payments: sql<number>`count(*) filter (where ${events.type} = 'order_paid')::int`,
    })
    .from(events)
    .leftJoin(pages, eq(pages.id, events.pageId))
    .where(base)
    .groupBy(events.pageId, pages.name, events.variantLabel)
    .orderBy(desc(sql`4`));

  const bySource = await db
    .select({ source: events.source, visitors: countDistinct(events.visitorId) })
    .from(events)
    .where(and(base, eq(events.type, "page_view")))
    .groupBy(events.source)
    .orderBy(desc(countDistinct(events.visitorId)))
    .limit(20);

  const conversionRate = totals.visitors ? totals.buyers / totals.visitors : null;
  return {
    filters: f,
    totals: { ...totals, conversionRate },
    revenue: revenue.map((r) => ({
      currency: r.currency ?? "?",
      total: Number(r.total ?? 0),
      orders: Number(r.orders),
      averageOrder: r.orders ? Number(r.total ?? 0) / Number(r.orders) : null,
    })),
    byPage,
    bySource: bySource.map((s) => ({ source: s.source ?? "(direct)", visitors: Number(s.visitors) })),
    limits: [
      "Les visiteurs ayant refusé le suivi (Do Not Track / GPC) ou bloquant JavaScript ne sont pas comptés dans les visites ni les clics ; leurs paiements confirmés le sont.",
      "Un visiteur est un navigateur (cookie) : le même client sur deux appareils compte deux fois.",
      "Les paiements sont attribués à la page et à la variante où la commande a été passée.",
    ],
  };
}
