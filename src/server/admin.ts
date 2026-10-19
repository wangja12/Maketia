import { and, asc, avg, count, desc, eq, gte, ilike, inArray, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import {
  adminAuditLog,
  domains,
  funnels,
  mcpAuditLog,
  mcpTokens,
  orders,
  paymentEvents,
  plans,
  platformSettings,
  publications,
  sessions,
  users,
  workspaceMembers,
  workspaces,
  type PlanLimits,
} from "@/db/schema";
import { planOf, usageOf } from "./billing/plans";
import { NotFoundError, ValidationError } from "./errors";
import { fieldErrorsOf } from "./validation";
import { isUuid } from "./workspaces";

/*
 * Platform administration. Every function checks the caller is a platform admin (granted
 * only from the command line, never from the UI) and writes to the admin audit log when it
 * changes something. Non-admins get NotFound: the area's existence is not confirmed.
 */

export async function requirePlatformAdmin(db: Db, userId: string) {
  const [u] = await db.select({ isPlatformAdmin: users.isPlatformAdmin, suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, userId));
  if (!u || !u.isPlatformAdmin || u.suspendedAt) throw new NotFoundError();
}

async function audit(db: Db, adminUserId: string, action: string, targetType: string, targetId: string | null, detail?: string) {
  await db.insert(adminAuditLog).values({ adminUserId, action, targetType, targetId, detail: detail?.slice(0, 500) ?? null });
}

const day = sql`now() - interval '1 day'`;

export async function adminOverview(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  const [[u], [s], [w], [f], [p], [o], [mcp]] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(users).where(sql`${users.suspendedAt} is not null`),
    db.select({ n: count() }).from(workspaces),
    db.select({ n: count() }).from(funnels),
    db.select({ n: count() }).from(publications).where(isNull(publications.unpublishedAt)),
    db.select({ n: count() }).from(orders).where(and(eq(orders.status, "paid"), gte(orders.paidAt, sql`now() - interval '30 days'`))),
    db
      .select({ calls: count(), errors: sql<number>`count(*) filter (where not ${mcpAuditLog.ok})::int` })
      .from(mcpAuditLog)
      .where(gte(mcpAuditLog.createdAt, day)),
  ]);
  return { users: u.n, suspended: s.n, workspaces: w.n, funnels: f.n, livePages: p.n, paidOrders30d: o.n, mcpCalls24h: mcp.calls, mcpErrors24h: mcp.errors };
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function adminListUsers(db: Db, adminId: string, q = "", limit = 50) {
  await requirePlatformAdmin(db, adminId);
  const term = q.trim().slice(0, 100).replace(/[\\%_]/g, (c) => `\\${c}`);
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      isPlatformAdmin: users.isPlatformAdmin,
      suspendedAt: users.suspendedAt,
      createdAt: users.createdAt,
      workspaces: sql<number>`(select count(*)::int from ${workspaceMembers} where ${workspaceMembers.userId} = ${users.id})`,
    })
    .from(users)
    .where(term ? or(ilike(users.email, `%${term}%`), ilike(users.name, `%${term}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(Math.min(limit, 200));
}

export async function adminGetUser(db: Db, adminId: string, userId: string) {
  await requirePlatformAdmin(db, adminId);
  if (!isUuid(userId)) throw new NotFoundError();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, isPlatformAdmin: users.isPlatformAdmin, suspendedAt: users.suspendedAt, suspendedReason: users.suspendedReason, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new NotFoundError();
  const memberships = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaceMembers.createdAt));
  const detailed = await Promise.all(
    memberships.map(async (m) => {
      const [plan, usage, [tokens]] = await Promise.all([
        planOf(db, m.id),
        usageOf(db, m.id),
        db.select({ n: count() }).from(mcpTokens).where(and(eq(mcpTokens.workspaceId, m.id), isNull(mcpTokens.revokedAt))),
      ]);
      return { ...m, plan: { id: plan.id, name: plan.name, limits: plan.limits }, usage, activeTokens: tokens.n };
    }),
  );
  return { user, workspaces: detailed };
}

const reasonSchema = z.string().trim().min(5, "Motif : 5 caractères minimum").max(300);

/**
 * Suspension ends every session at once and stops the user's MCP tokens; the data is kept.
 * Published pages stay online (they belong to workspaces, which may have other members).
 */
export async function suspendUser(db: Db, adminId: string, userId: string, reason: unknown) {
  await requirePlatformAdmin(db, adminId);
  const parsed = reasonSchema.safeParse(reason);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { reason: parsed.error.issues[0].message });
  if (userId === adminId) throw new ValidationError("Vous ne pouvez pas suspendre votre propre compte.");
  const { user } = await adminGetUser(db, adminId, userId);
  if (user.isPlatformAdmin) throw new ValidationError("Un compte administrateur ne se suspend pas depuis l’interface.");
  await db.transaction(async (tx) => {
    await tx.update(users).set({ suspendedAt: sql`now()`, suspendedReason: parsed.data }).where(eq(users.id, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
  });
  await audit(db, adminId, "user.suspend", "user", userId, parsed.data);
}

export async function reactivateUser(db: Db, adminId: string, userId: string) {
  await requirePlatformAdmin(db, adminId);
  await adminGetUser(db, adminId, userId);
  await db.update(users).set({ suspendedAt: null, suspendedReason: null }).where(eq(users.id, userId));
  await audit(db, adminId, "user.reactivate", "user", userId);
}

// ── Plans ─────────────────────────────────────────────────────────────────────

const limit = z.union([z.literal(""), z.null(), z.coerce.number().int("Nombre entier").min(0, "0 minimum")]).transform((v) => (v === "" || v === null ? null : v));

const planSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9-]{2,30}$/, "Code : 2 à 30 lettres, chiffres ou tirets"),
    name: z.string().trim().min(2, "Nom : 2 caractères minimum").max(60),
    priceMonthly: limit,
    currency: z.string().trim().toUpperCase().regex(/^([A-Z]{3})?$/, "Devise : code ISO à 3 lettres (XOF, XAF…)"),
    funnels: limit,
    variantsPerPage: limit.refine((v) => v === null || (v >= 1 && v <= 4), "Variantes : 1 à 4"),
    customDomains: limit,
    mcpWritesPerMonth: limit,
    analyticsEventsPerMonth: limit,
  })
  .refine((p) => p.priceMonthly === null || p.priceMonthly === 0 || p.currency !== "", { message: "Indiquez la devise du prix", path: ["currency"] });

function parsePlan(input: Record<string, unknown>) {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, fieldErrorsOf(parsed.error));
  const p = parsed.data;
  const limits: PlanLimits = {
    funnels: p.funnels,
    variantsPerPage: p.variantsPerPage,
    customDomains: p.customDomains,
    mcpWritesPerMonth: p.mcpWritesPerMonth,
    analyticsEventsPerMonth: p.analyticsEventsPerMonth,
  };
  return { code: p.code, name: p.name, priceMonthly: p.priceMonthly, currency: p.currency || null, limits };
}

export async function adminListPlans(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  return db
    .select({ plan: plans, workspaces: sql<number>`(select count(*)::int from ${workspaces} where ${workspaces.planId} = ${plans.id})` })
    .from(plans)
    .orderBy(asc(plans.createdAt));
}

export async function createPlan(db: Db, adminId: string, input: Record<string, unknown>) {
  await requirePlatformAdmin(db, adminId);
  const values = parsePlan(input);
  const [row] = await db.insert(plans).values(values).onConflictDoNothing({ target: plans.code }).returning();
  if (!row) throw new ValidationError("Ce code de plan existe déjà.", { code: "Code déjà utilisé" });
  await audit(db, adminId, "plan.create", "plan", row.id, JSON.stringify(values));
  return row;
}

export async function updatePlan(db: Db, adminId: string, planId: string, input: Record<string, unknown> & { active?: boolean; isDefault?: boolean }) {
  await requirePlatformAdmin(db, adminId);
  if (!isUuid(planId)) throw new NotFoundError();
  const [current] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!current) throw new NotFoundError("Plan introuvable");
  const values = parsePlan(input);
  const active = input.active ?? current.active;
  const isDefault = input.isDefault ?? current.isDefault;
  if (isDefault && !active) throw new ValidationError("Le plan par défaut doit rester actif.");
  if (current.isDefault && !isDefault) throw new ValidationError("Choisissez un autre plan par défaut plutôt que de retirer celui-ci.");
  if (values.code !== current.code) {
    const [clash] = await db.select({ id: plans.id }).from(plans).where(and(eq(plans.code, values.code), ne(plans.id, planId)));
    if (clash) throw new ValidationError("Ce code de plan existe déjà.", { code: "Code déjà utilisé" });
  }
  const row = await db.transaction(async (tx) => {
    if (isDefault && !current.isDefault) await tx.update(plans).set({ isDefault: false }).where(eq(plans.isDefault, true));
    const [updated] = await tx.update(plans).set({ ...values, active, isDefault }).where(eq(plans.id, planId)).returning();
    return updated;
  });
  await audit(db, adminId, "plan.update", "plan", planId, JSON.stringify({ ...values, active, isDefault }));
  return row;
}

/** Assigns any active plan to a workspace (how paid plans are given until subscriptions exist). */
export async function setWorkspacePlan(db: Db, adminId: string, workspaceId: string, planId: string) {
  await requirePlatformAdmin(db, adminId);
  if (!isUuid(workspaceId) || !isUuid(planId)) throw new NotFoundError();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.active, true)));
  if (!plan) throw new NotFoundError("Plan introuvable ou inactif");
  const [ws] = await db.update(workspaces).set({ planId }).where(eq(workspaces.id, workspaceId)).returning({ id: workspaces.id });
  if (!ws) throw new NotFoundError("Espace introuvable");
  await audit(db, adminId, "workspace.plan", "workspace", workspaceId, plan.code);
}

// ── Monitoring ────────────────────────────────────────────────────────────────

/** MCP usage by external agents: volume, errors, slow tools, recent failures. */
export async function adminMcpUsage(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  const week = sql`now() - interval '7 days'`;
  const [daily, tools, recentErrors, byWorkspace] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${mcpAuditLog.createdAt} at time zone 'utc'), 'YYYY-MM-DD')`,
        calls: count(),
        errors: sql<number>`count(*) filter (where not ${mcpAuditLog.ok})::int`,
        writes: sql<number>`count(*) filter (where ${mcpAuditLog.ok} and ${mcpAuditLog.kind} <> 'read')::int`,
      })
      .from(mcpAuditLog)
      .where(gte(mcpAuditLog.createdAt, sql`now() - interval '14 days'`))
      .groupBy(sql`1`)
      .orderBy(desc(sql`1`)),
    db
      .select({
        tool: mcpAuditLog.tool,
        calls: count(),
        errors: sql<number>`count(*) filter (where not ${mcpAuditLog.ok})::int`,
        avgMs: avg(mcpAuditLog.durationMs),
      })
      .from(mcpAuditLog)
      .where(gte(mcpAuditLog.createdAt, week))
      .groupBy(mcpAuditLog.tool)
      .orderBy(desc(count()))
      .limit(40),
    db
      .select({ id: mcpAuditLog.id, tool: mcpAuditLog.tool, error: mcpAuditLog.error, createdAt: mcpAuditLog.createdAt, workspace: workspaces.name, workspaceId: workspaces.id })
      .from(mcpAuditLog)
      .innerJoin(workspaces, eq(workspaces.id, mcpAuditLog.workspaceId))
      .where(eq(mcpAuditLog.ok, false))
      .orderBy(desc(mcpAuditLog.createdAt))
      .limit(50),
    db
      .select({ workspaceId: workspaces.id, workspace: workspaces.name, calls: count(), errors: sql<number>`count(*) filter (where not ${mcpAuditLog.ok})::int` })
      .from(mcpAuditLog)
      .innerJoin(workspaces, eq(workspaces.id, mcpAuditLog.workspaceId))
      .where(gte(mcpAuditLog.createdAt, week))
      .groupBy(workspaces.id, workspaces.name)
      .orderBy(desc(count()))
      .limit(20),
  ]);
  return { daily, tools: tools.map((t) => ({ ...t, avgMs: t.avgMs === null ? null : Math.round(Number(t.avgMs)) })), recentErrors, byWorkspace };
}

/** Publication problems: domains not verified (with the DNS error), recent publications, payment errors. */
export async function adminDiagnostics(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  const [badDomains, recentPublications, paymentErrors] = await Promise.all([
    db
      .select({ id: domains.id, hostname: domains.hostname, status: domains.status, lastError: domains.lastError, lastCheckedAt: domains.lastCheckedAt, funnel: funnels.name, workspace: workspaces.name })
      .from(domains)
      .innerJoin(funnels, eq(funnels.id, domains.funnelId))
      .innerJoin(workspaces, eq(workspaces.id, domains.workspaceId))
      .where(inArray(domains.status, ["pending", "misconfigured"]))
      .orderBy(desc(domains.createdAt))
      .limit(50),
    db
      .select({ id: publications.id, path: publications.path, version: publications.version, createdAt: publications.createdAt, unpublishedAt: publications.unpublishedAt, funnel: funnels.name, subdomain: funnels.subdomain })
      .from(publications)
      .innerJoin(funnels, eq(funnels.id, publications.funnelId))
      .orderBy(desc(publications.createdAt))
      .limit(30),
    db
      .select({ id: paymentEvents.id, detail: paymentEvents.detail, providerStatus: paymentEvents.providerStatus, createdAt: paymentEvents.createdAt, reference: orders.merchantTransactionId, workspace: workspaces.name })
      .from(paymentEvents)
      .innerJoin(orders, eq(orders.id, paymentEvents.orderId))
      .innerJoin(workspaces, eq(workspaces.id, orders.workspaceId))
      .where(eq(paymentEvents.kind, "error"))
      .orderBy(desc(paymentEvents.createdAt))
      .limit(30),
  ]);
  return { badDomains, recentPublications, paymentErrors };
}

export async function adminAuditTrail(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  return db
    .select({ id: adminAuditLog.id, action: adminAuditLog.action, targetType: adminAuditLog.targetType, targetId: adminAuditLog.targetId, detail: adminAuditLog.detail, createdAt: adminAuditLog.createdAt, admin: users.email })
    .from(adminAuditLog)
    .leftJoin(users, eq(users.id, adminAuditLog.adminUserId))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(100);
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function getPlatformSettings(db: Db, adminId: string) {
  await requirePlatformAdmin(db, adminId);
  const [row] = await db.select().from(platformSettings);
  return row ?? { id: 1, signupsOpen: true, updatedAt: new Date() };
}

export async function updatePlatformSettings(db: Db, adminId: string, input: { signupsOpen: boolean }) {
  await requirePlatformAdmin(db, adminId);
  await db
    .insert(platformSettings)
    .values({ id: 1, signupsOpen: input.signupsOpen })
    .onConflictDoUpdate({ target: platformSettings.id, set: { signupsOpen: input.signupsOpen, updatedAt: sql`now()` } });
  await audit(db, adminId, "settings.update", "platform", null, `signupsOpen=${input.signupsOpen}`);
}

/** Command-line only (scripts/grant-admin.mts): there is no UI path to become an admin. */
export async function grantPlatformAdmin(db: Db, email: string) {
  const [row] = await db.update(users).set({ isPlatformAdmin: true }).where(eq(users.email, email.trim().toLowerCase())).returning({ id: users.id });
  if (!row) throw new NotFoundError(`Aucun compte pour ${email}`);
  await db.insert(adminAuditLog).values({ adminUserId: null, action: "admin.grant", targetType: "user", targetId: row.id, detail: "ligne de commande" });
  return row.id;
}
