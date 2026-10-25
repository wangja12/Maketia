import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { adminAuditLog, mcpAuditLog, users, workspaces } from "@/db/schema";
import { signUp, verifyCredentials } from "@/server/accounts";
import {
  adminDiagnostics,
  adminGetUser,
  adminListPlans,
  adminListUsers,
  adminMcpUsage,
  adminOverview,
  createPlan,
  grantPlatformAdmin,
  reactivateUser,
  setWorkspacePlan,
  suspendUser,
  updatePlan,
  updatePlatformSettings,
} from "@/server/admin";
import { recordBrowserEvent, signViewToken } from "@/server/analytics/tracking";
import { choosePlan, getUsageAndLimits, QuotaExceededError } from "@/server/billing/plans";
import { addDomain } from "@/server/domains";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel } from "@/server/funnels";
import { authenticateMcpToken, createMcpToken } from "@/server/mcp-tokens";
import { createPage, createVariant } from "@/server/pages";
import { createSession, validateSessionToken } from "@/server/sessions";
import { db, makeUser } from "./db";

beforeAll(() => {
  process.env.ANALYTICS_SECRET = "y".repeat(40);
});

const unlimited = { funnels: "", variantsPerPage: "", customDomains: "", mcpWritesPerMonth: "", analyticsEventsPerMonth: "" };

async function makeAdmin() {
  const a = await makeUser("Admin");
  const [u] = await db.select().from(users).where(eq(users.id, a.userId));
  await grantPlatformAdmin(db, u.email);
  return a;
}

describe("plans and quotas", () => {
  it("enforces every limit of the workspace's plan on the server, with an explicit message", async () => {
    const admin = await makeAdmin();
    const small = await createPlan(db, admin.userId, {
      code: "essai", name: "Essai", priceMonthly: "0", currency: "",
      funnels: "1", variantsPerPage: "2", customDomains: "1", mcpWritesPerMonth: "1", analyticsEventsPerMonth: "1",
    });
    const u = await makeUser();
    await setWorkspacePlan(db, admin.userId, u.workspaceId, small.id);

    const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Un" });
    const err = await createFunnel(db, u.userId, u.workspaceId, { name: "Deux" }).catch((e) => e);
    expect(err).toBeInstanceOf(QuotaExceededError);
    expect(err.message).toBe("Limite du plan « Essai » atteinte : offres, 1 maximum. Change de plan ou libère de la place.");

    const page = await createPage(db, { userId: u.userId }, funnel.id, { name: "P", kind: "landing" });
    await createVariant(db, { userId: u.userId }, page.id);
    await expect(createVariant(db, { userId: u.userId }, page.id)).rejects.toThrow("variantes par page, 2 maximum");

    await addDomain(db, u.userId, funnel.id, "un.exemple.com");
    await expect(addDomain(db, u.userId, funnel.id, "deux.exemple.com")).rejects.toBeInstanceOf(QuotaExceededError);

    // Browser events stop being stored past the monthly volume.
    const token = (visitor: string) =>
      signViewToken({ workspaceId: u.workspaceId, funnelId: funnel.id, pageId: page.id, variantLabel: "A", experimentId: null, visitorId: visitor, sessionId: `s-${visitor}` })!;
    expect(await recordBrowserEvent(db, { token: token("v1"), type: "page_view" })).toBe(true);
    expect(await recordBrowserEvent(db, { token: token("v2"), type: "page_view" })).toBe(false);

    const usage = await getUsageAndLimits(db, u.userId, u.workspaceId);
    expect(usage.plan.name).toBe("Essai");
    expect(usage.quotas.find((q) => q.key === "funnels")).toMatchObject({ used: 1, limit: 1, reached: true, exceeded: false });
    expect(usage.quotas.find((q) => q.key === "analyticsEventsPerMonth")).toMatchObject({ used: 1, limit: 1 });
  });

  it("serializes concurrent creations so a limit cannot be overshot", async () => {
    const admin = await makeAdmin();
    const plan = await createPlan(db, admin.userId, { ...unlimited, code: "trois", name: "Trois", priceMonthly: "", currency: "", funnels: "3" });
    const u = await makeUser();
    await setWorkspacePlan(db, admin.userId, u.workspaceId, plan.id);
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => createFunnel(db, u.userId, u.workspaceId, { name: `T${i}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });

  it("lets owners pick only free plans themselves; paid plans are assigned by an administrator", async () => {
    const admin = await makeAdmin();
    const free = await createPlan(db, admin.userId, { ...unlimited, code: "gratuit", name: "Gratuit", priceMonthly: "0", currency: "" });
    const paid = await createPlan(db, admin.userId, { ...unlimited, code: "pro", name: "Pro", priceMonthly: "9000", currency: "xof" });
    expect(paid).toMatchObject({ priceMonthly: 9000, currency: "XOF" });
    const unpriced = await createPlan(db, admin.userId, { ...unlimited, code: "a-definir", name: "À définir", priceMonthly: "", currency: "" });
    const u = await makeUser();
    await choosePlan(db, u.userId, u.workspaceId, free.id);
    await expect(choosePlan(db, u.userId, u.workspaceId, paid.id)).rejects.toThrow("paiement des abonnements n’est pas encore disponible");
    await expect(choosePlan(db, u.userId, u.workspaceId, unpriced.id)).rejects.toBeInstanceOf(ValidationError);
    const [ws] = await db.select().from(workspaces).where(eq(workspaces.id, u.workspaceId));
    expect(ws.planId).toBe(free.id);
  });

  it("counts successful MCP writes, not reads", async () => {
    const u = await makeUser();
    const { token } = await createMcpToken(db, u.userId, u.workspaceId, { name: "Claude", access: "write" });
    const ctx = (await authenticateMcpToken(db, token))!;
    await db.insert(mcpAuditLog).values([
      { tokenId: ctx.tokenId, workspaceId: u.workspaceId, userId: u.userId, tool: "get_page", kind: "read", ok: true },
      { tokenId: ctx.tokenId, workspaceId: u.workspaceId, userId: u.userId, tool: "create_page", kind: "design", ok: true },
      { tokenId: ctx.tokenId, workspaceId: u.workspaceId, userId: u.userId, tool: "create_page", kind: "design", ok: false },
    ]);
    const usage = await getUsageAndLimits(db, u.userId, u.workspaceId);
    expect(usage.quotas.find((q) => q.key === "mcpWritesPerMonth")?.used).toBe(1);
  });
});

describe("platform administration", () => {
  it("is invisible to standard users", async () => {
    const u = await makeUser();
    await expect(adminOverview(db, u.userId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(adminListUsers(db, u.userId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createPlan(db, u.userId, { ...unlimited, code: "x", name: "Xx", priceMonthly: "", currency: "" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(suspendUser(db, u.userId, u.userId, "abus de la plateforme")).rejects.toBeInstanceOf(NotFoundError);
    await expect(updatePlatformSettings(db, u.userId, { signupsOpen: false })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("suspends an account: sign-in refused, sessions and MCP tokens stop; reactivation restores access", async () => {
    const admin = await makeAdmin();
    const u = await signUp(db, { name: "Kofi", email: "kofi@exemple.test", password: "motdepasse-solide" });
    const { token: session } = await createSession(db, u.userId);
    const { token: mcp } = await createMcpToken(db, u.userId, u.workspaceId, { name: "Agent", access: "write" });

    await expect(suspendUser(db, admin.userId, u.userId, "x")).rejects.toBeInstanceOf(ValidationError);
    await suspendUser(db, admin.userId, u.userId, "Paiements frauduleux signalés");
    expect(await validateSessionToken(db, session)).toBeNull();
    expect(await authenticateMcpToken(db, mcp)).toBeNull();
    await expect(verifyCredentials(db, "kofi@exemple.test", "motdepasse-solide")).rejects.toBeInstanceOf(ForbiddenError);
    expect(await verifyCredentials(db, "kofi@exemple.test", "mauvais-mot")).toBeNull();

    await expect(suspendUser(db, admin.userId, admin.userId, "moi-même")).rejects.toBeInstanceOf(ValidationError);
    await reactivateUser(db, admin.userId, u.userId);
    expect(await verifyCredentials(db, "kofi@exemple.test", "motdepasse-solide")).toBe(u.userId);
    expect(await authenticateMcpToken(db, mcp)).not.toBeNull();

    const actions = (await db.select().from(adminAuditLog)).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["admin.grant", "user.suspend", "user.reactivate"]));
  });

  it("edits plans without code changes and keeps exactly one default", async () => {
    const admin = await makeAdmin();
    await expect(createPlan(db, admin.userId, { ...unlimited, code: "p", name: "Pro", priceMonthly: "5000", currency: "" })).rejects.toBeInstanceOf(ValidationError);
    await expect(createPlan(db, admin.userId, { ...unlimited, code: "pro", name: "Pro", priceMonthly: "", currency: "", variantsPerPage: "5" })).rejects.toThrow("1 à 4");
    const pro = await createPlan(db, admin.userId, { ...unlimited, code: "pro", name: "Pro", priceMonthly: "", currency: "" });
    await expect(createPlan(db, admin.userId, { ...unlimited, code: "pro", name: "Pro 2", priceMonthly: "", currency: "" })).rejects.toThrow("existe déjà");
    await updatePlan(db, admin.userId, pro.id, { ...unlimited, code: "pro", name: "Pro", priceMonthly: "12000", currency: "XAF", funnels: "10", isDefault: true });
    const listed = await adminListPlans(db, admin.userId);
    expect(listed.filter((p) => p.plan.isDefault).map((p) => p.plan.code)).toEqual(["pro"]);
    expect(listed.find((p) => p.plan.code === "pro")?.plan).toMatchObject({ priceMonthly: 12000, currency: "XAF", limits: { funnels: 10, customDomains: null } });
    await expect(updatePlan(db, admin.userId, pro.id, { ...unlimited, code: "pro", name: "Pro", priceMonthly: "", currency: "", active: false })).rejects.toBeInstanceOf(ValidationError);
    // New workspaces without a plan use the new default.
    const u = await makeUser();
    expect((await getUsageAndLimits(db, u.userId, u.workspaceId)).plan.code).toBe("pro");
  });

  it("closes sign-ups from the settings", async () => {
    const admin = await makeAdmin();
    await updatePlatformSettings(db, admin.userId, { signupsOpen: false });
    await expect(signUp(db, { name: "Nouveau", email: "nouveau@exemple.test", password: "motdepasse-solide" })).rejects.toThrow("inscriptions sont fermées");
  });

  it("monitors MCP usage, errors and publication problems across workspaces", async () => {
    const admin = await makeAdmin();
    const u = await makeUser();
    const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Boutique" });
    await addDomain(db, u.userId, funnel.id, "boutique.exemple.com");
    await db.insert(mcpAuditLog).values([
      { workspaceId: u.workspaceId, userId: u.userId, tool: "update_page_section", kind: "design", ok: false, error: "Conflit de version", durationMs: 40 },
      { workspaceId: u.workspaceId, userId: u.userId, tool: "get_page", kind: "read", ok: true, durationMs: 10 },
    ]);
    const usage = await adminMcpUsage(db, admin.userId);
    expect(usage.recentErrors[0]).toMatchObject({ tool: "update_page_section", error: "Conflit de version" });
    expect(usage.tools.find((t) => t.tool === "get_page")).toMatchObject({ calls: 1, errors: 0, avgMs: 10 });
    expect(usage.daily[0]).toMatchObject({ calls: 2, errors: 1, writes: 0 });
    const diag = await adminDiagnostics(db, admin.userId);
    expect(diag.badDomains.map((d) => d.hostname)).toEqual(["boutique.exemple.com"]);
    const overview = await adminOverview(db, admin.userId);
    expect(overview).toMatchObject({ mcpCalls24h: 2, mcpErrors24h: 1 });
    const detail = await adminGetUser(db, admin.userId, u.userId);
    expect(detail.workspaces[0]).toMatchObject({ role: "owner", usage: { funnels: 1, customDomains: 1 } });
  });
});
