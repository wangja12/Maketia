import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { domains, events, funnels, mcpAuditLog, plans, productFiles, workspaces, type Plan, type PlanLimits } from "@/db/schema";
import { money } from "@/lib/format";
import { NotFoundError, ValidationError } from "../errors";
import { requireMembership } from "../workspaces";

/*
 * Plans and quotas, enforced on the server where each resource is created. Limits live in
 * the database (edited from the admin area); null means unlimited. Nothing here takes a
 * payment: SaaS subscriptions are not connected to a provider yet.
 */

export type QuotaKey = keyof PlanLimits;
type CountedKey = Exclude<QuotaKey, "variantsPerPage">;

export const QUOTA_LABELS: Record<QuotaKey, string> = {
  funnels: "Tunnels",
  variantsPerPage: "Variantes par page",
  customDomains: "Domaines personnalisés",
  mcpWritesPerMonth: "Modifications par agent IA (MCP) ce mois-ci",
  analyticsEventsPerMonth: "Événements mesurés ce mois-ci",
  storageMb: "Stockage des fichiers (Mo)",
};

export class QuotaExceededError extends ValidationError {
  constructor(
    readonly key: QuotaKey,
    readonly limit: number,
    planName: string,
  ) {
    super(`Limite du plan « ${planName} » atteinte : ${QUOTA_LABELS[key].toLowerCase()}, ${limit} maximum. Changez de plan ou libérez de la place.`);
    this.name = "QuotaExceededError";
  }
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
type Executor = Db | Tx;

/** The workspace's plan, or the default plan. */
export async function planOf(db: Executor, workspaceId: string): Promise<Plan> {
  const [row] = await db.select({ plan: plans }).from(workspaces).leftJoin(plans, eq(plans.id, workspaces.planId)).where(eq(workspaces.id, workspaceId));
  if (!row) throw new NotFoundError();
  if (row.plan) return row.plan;
  const [fallback] = await db.select().from(plans).where(eq(plans.isDefault, true));
  if (!fallback) throw new Error("No default plan configured");
  return fallback;
}

const monthStart = sql`date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;

/** Current consumption of every counted quota. */
export async function usageOf(db: Executor, workspaceId: string): Promise<Record<CountedKey, number>> {
  const [[f], [d], [m], [e], [st]] = await Promise.all([
    db.select({ n: count() }).from(funnels).where(eq(funnels.workspaceId, workspaceId)),
    db.select({ n: count() }).from(domains).where(eq(domains.workspaceId, workspaceId)),
    db
      .select({ n: count() })
      .from(mcpAuditLog)
      .where(and(eq(mcpAuditLog.workspaceId, workspaceId), eq(mcpAuditLog.ok, true), inArray(mcpAuditLog.kind, ["write", "design"]), gte(mcpAuditLog.createdAt, monthStart))),
    db
      .select({ n: count() })
      .from(events)
      .where(and(eq(events.workspaceId, workspaceId), inArray(events.type, ["page_view", "cta_click"]), gte(events.createdAt, monthStart))),
    db.select({ bytes: sql<number>`coalesce(sum(${productFiles.sizeBytes}), 0)::bigint` }).from(productFiles).where(eq(productFiles.workspaceId, workspaceId)),
  ]);
  return { funnels: f.n, customDomains: d.n, mcpWritesPerMonth: m.n, analyticsEventsPerMonth: e.n, storageMb: Math.ceil(Number(st.bytes) / (1024 * 1024)) };
}

async function usageFor(db: Executor, workspaceId: string, key: CountedKey) {
  return (await usageOf(db, workspaceId))[key];
}

/**
 * Throws when adding one more would exceed the plan. Call it inside the transaction that
 * creates the resource, after lockQuota, so two concurrent requests cannot both pass.
 */
export async function assertQuota(db: Executor, workspaceId: string, key: CountedKey) {
  const plan = await planOf(db, workspaceId);
  const limit = plan.limits[key];
  if (limit === null || limit === undefined) return;
  if ((await usageFor(db, workspaceId, key)) >= limit) throw new QuotaExceededError(key, limit, plan.name);
}

/** Same check, as a boolean (for measurement that must never fail a visitor's page). */
export async function withinQuota(db: Executor, workspaceId: string, key: CountedKey) {
  const plan = await planOf(db, workspaceId);
  const limit = plan.limits[key];
  return limit === null || limit === undefined || (await usageFor(db, workspaceId, key)) < limit;
}

export async function lockQuota(tx: Tx, workspaceId: string, key: CountedKey) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`quota:${key}:${workspaceId}`}))`);
}

/** Variants allowed per page: the plan's limit, never above the product maximum. */
export async function variantLimit(db: Executor, workspaceId: string, productMax: number) {
  const plan = await planOf(db, workspaceId);
  const limit = plan.limits.variantsPerPage;
  return { limit: limit === null || limit === undefined ? productMax : Math.min(limit, productMax), plan };
}

/** Plan, limits and consumption, for the workspace's subscription page and MCP. */
export async function getUsageAndLimits(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  const [plan, usage] = await Promise.all([planOf(db, workspaceId), usageOf(db, workspaceId)]);
  const keys = Object.keys(QUOTA_LABELS) as QuotaKey[];
  return {
    plan: { id: plan.id, code: plan.code, name: plan.name, priceMonthly: plan.priceMonthly, currency: plan.currency },
    quotas: keys.map((key) => {
      const limit = plan.limits[key] ?? null;
      const used = key === "variantsPerPage" ? null : usage[key];
      return { key, label: QUOTA_LABELS[key], limit, used, exceeded: limit !== null && used !== null && used > limit, reached: limit !== null && used !== null && used >= limit };
    }),
    period: "Mois civil en cours (UTC) pour les quotas mensuels.",
  };
}

/** Monthly price as shown to people; null means the administrator has not set it yet. */
export function planPrice(p: { priceMonthly: number | null; currency: string | null }) {
  return p.priceMonthly === null ? "Tarif à définir" : p.priceMonthly === 0 ? "Gratuit" : `${money(p.priceMonthly, p.currency ?? "XOF")} / mois`;
}

export async function listActivePlans(db: Db) {
  return db.select().from(plans).where(eq(plans.active, true)).orderBy(plans.createdAt);
}

/**
 * A workspace owner may move to a free plan (price 0) on their own. Paid plans need a
 * subscription payment, which is not available yet: an administrator assigns them.
 * Moving down is allowed even above the new limits: existing resources stay, new ones are refused.
 */
export async function choosePlan(db: Db, userId: string, workspaceId: string, planId: string) {
  const member = await requireMembership(db, userId, workspaceId, "delete");
  if (member.role !== "owner") throw new ValidationError("Seul le propriétaire de l’espace peut changer de plan.");
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.active, true)));
  if (!plan) throw new NotFoundError("Plan introuvable");
  if (plan.priceMonthly !== 0) {
    throw new ValidationError("Le paiement des abonnements n’est pas encore disponible : ce plan est attribué par l’administrateur de la plateforme.");
  }
  await db.update(workspaces).set({ planId: plan.id }).where(eq(workspaces.id, workspaceId));
  return plan;
}
