import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { mcpAuditLog, workspaceMembers } from "@/db/schema";
import {
  DESIGN_SKILL_URI,
  DESIGN_SKILL_VERSION,
  loadDesignSkill,
  SKILL_PATH,
  SkillUnavailableError,
  type SkillLoader,
} from "@/server/design-skill";
import { createFunnel } from "@/server/funnels";
import { buildMcpServer } from "@/server/mcp/server";
import { authenticateMcpToken, createMcpToken, revokeMcpToken, RATE_LIMIT_PER_MINUTE } from "@/server/mcp-tokens";
import { createExperiment, startExperiment } from "@/server/analytics/experiments";
import { createPage, createVariant, getPage } from "@/server/pages";
import { publishPage } from "@/server/publishing";
import { db, makeUser } from "./db";

async function connect(token: string, loadSkill: SkillLoader = loadDesignSkill) {
  const ctx = await authenticateMcpToken(db, token);
  if (!ctx) throw new Error("token rejected");
  const server = buildMcpServer({ db, ctx, loadSkill });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const client = new Client({ name: "test-agent", version: "1.0.0" });
  await client.connect(b);
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = (await client.callTool({ name, arguments: args })) as CallToolResult;
    const text = r.content[0]?.type === "text" ? r.content[0].text : "";
    return { isError: Boolean(r.isError), text, data: r.isError ? null : JSON.parse(text) };
  };
  return { client, call, ctx };
}

async function setupAgent(access: "read" | "write" = "write") {
  const u = await makeUser();
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Coaching" });
  const { token } = await createMcpToken(db, u.userId, u.workspaceId, { name: "Claude", access });
  return { ...u, funnel, token, ...(await connect(token)) };
}

describe("MCP server", () => {
  it("advertises only implemented tools, the skill resource and instructions", async () => {
    const { client } = await setupAgent();
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "add_page_section", "create_funnel", "create_page", "create_page_variant", "duplicate_page",
        "get_design_engineering_skill", "get_funnel", "get_integrations_status", "get_page", "get_page_schema", "get_publication_status", "preview_page", "list_products", "list_orders", "get_payment_status",
        "get_funnel_analytics", "get_page_analytics", "compare_page_variants", "list_ab_experiments", "get_ab_experiment_results", "create_ab_experiment", "update_ab_traffic_split",
        "list_funnels", "list_page_variants", "list_page_versions", "list_pages", "list_workspaces",
        "remove_page_section", "reorder_page_sections", "restore_page_version", "update_funnel",
        "update_page_content", "update_page_section", "update_page_theme", "validate_page",
      ].sort(),
    );
    // Every tool that changes a page carries the design reminder and requires skill_version.
    for (const t of tools.filter((t) => /page/.test(t.name) && !t.annotations?.readOnlyHint)) {
      expect(t.description).toContain("get_design_engineering_skill");
      expect(t.inputSchema.required).toContain("skill_version");
    }
    expect(client.getInstructions()).toContain(DESIGN_SKILL_URI);
    const { resources } = await client.listResources();
    expect(resources.map((r) => r.uri)).toContain(DESIGN_SKILL_URI);
  });

  it("serves the versioned skill as a tool and a resource", async () => {
    const { client, call } = await setupAgent("read");
    const fileText = await readFile(SKILL_PATH, "utf8");
    const viaTool = await call("get_design_engineering_skill");
    expect(viaTool.data.version).toBe(DESIGN_SKILL_VERSION);
    expect(viaTool.data.skill).toBe(fileText);
    const viaResource = await client.readResource({ uri: DESIGN_SKILL_URI });
    expect(viaResource.contents[0]).toMatchObject({ text: fileText });
    expect(fileText).toMatch(new RegExp(`^version: ${DESIGN_SKILL_VERSION.replace(/\./g, "\\.")}$`, "m"));
  });

  it("lets an agent create and edit a page, attributed to the agent", async () => {
    const { call, funnel, userId } = await setupAgent();
    const created = await call("create_page", {
      funnel_id: funnel.id, name: "Landing", kind: "landing", skill_version: DESIGN_SKILL_VERSION,
    });
    expect(created.isError).toBe(false);
    const pageId = created.data.id;

    const edited = await call("update_page_section", {
      page_id: pageId, base_version: 1, section_id: "hero",
      changes: { headline: "Devenez autonome sur Excel en 7 jours" },
      skill_version: DESIGN_SKILL_VERSION, note: "Accroche plus concrète",
    });
    expect(edited.data).toEqual({ pageId, version: 2 });

    const page = await call("get_page", { page_id: pageId });
    expect(page.data.content.sections[0].headline).toBe("Devenez autonome sur Excel en 7 jours");

    const versions = await call("list_page_versions", { page_id: pageId });
    expect(versions.data[0]).toMatchObject({ version: 2, authorKind: "agent", note: "Accroche plus concrète" });

    // Visible to the web app through the same services.
    const fromWeb = await getPage(db, { userId }, pageId);
    expect(fromWeb.version.authorKind).toBe("agent");
  });

  it("refuses page writes without the current skill version", async () => {
    const { call, funnel } = await setupAgent();
    const missing = await call("create_page", { funnel_id: funnel.id, name: "X", kind: "landing", skill_version: "" });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain("get_design_engineering_skill");
    const stale = await call("create_page", { funnel_id: funnel.id, name: "X", kind: "landing", skill_version: "0.9.0" });
    expect(stale.isError).toBe(true);
  });

  it("reports a missing skill instead of silently proceeding", async () => {
    const u = await makeUser();
    const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "T" });
    const { token } = await createMcpToken(db, u.userId, u.workspaceId, { name: "A", access: "write" });
    const broken: SkillLoader = async () => {
      throw new SkillUnavailableError(new Error("ENOENT"));
    };
    const { call } = await connect(token, broken);
    const read = await call("get_design_engineering_skill");
    expect(read.isError).toBe(true);
    expect(read.text).toContain("introuvable");
    const write = await call("create_page", { funnel_id: funnel.id, name: "X", kind: "landing", skill_version: DESIGN_SKILL_VERSION });
    expect(write.isError).toBe(true);
    expect(write.text).toContain("introuvable");
  });

  it("returns validation errors and conflicts as tool errors", async () => {
    const { call, funnel } = await setupAgent();
    const v = DESIGN_SKILL_VERSION;
    const { data: page } = await call("create_page", { funnel_id: funnel.id, name: "P", kind: "landing", skill_version: v });
    const bad = await call("update_page_section", {
      page_id: page.id, base_version: 1, section_id: "hero", changes: { cta: { label: "x", href: "javascript:alert(1)" } }, skill_version: v,
    });
    expect(bad.isError).toBe(true);
    expect(bad.text).toContain("Lien invalide");
    await call("update_page_theme", { page_id: page.id, base_version: 1, accent: "#0a3d62", skill_version: v });
    const stale = await call("update_page_theme", { page_id: page.id, base_version: 1, accent: "#000000", skill_version: v });
    expect(stale.isError).toBe(true);
    expect(stale.text).toContain("current_version=2");
  });

  it("creates variants up to four and says so on the fifth", async () => {
    const { call, funnel } = await setupAgent();
    const v = DESIGN_SKILL_VERSION;
    const { data: page } = await call("create_page", { funnel_id: funnel.id, name: "P", kind: "sales", skill_version: v });
    for (let i = 0; i < 3; i++) expect((await call("create_page_variant", { page_id: page.id, skill_version: v })).isError).toBe(false);
    const fifth = await call("create_page_variant", { page_id: page.id, skill_version: v });
    expect(fifth.isError).toBe(true);
    expect(fifth.text).toContain("4 variantes maximum");
    expect((await call("list_page_variants", { page_id: page.id })).data.map((p: { variantLabel: string }) => p.variantLabel)).toEqual(["A", "B", "C", "D"]);
  });

  it("reads publication state and preview links, but cannot publish", async () => {
    const { call, client, funnel, userId } = await setupAgent();
    const { data: page } = await call("create_page", { funnel_id: funnel.id, name: "P", kind: "landing", skill_version: DESIGN_SKILL_VERSION });
    await publishPage(db, userId, page.id, { path: "", reviewConfirmed: true });
    const status = await call("get_publication_status", { funnel_id: funnel.id });
    expect(status.data.live).toEqual([expect.objectContaining({ pageId: page.id, version: 1, path: "" })]);
    expect(status.data.subdomain).toBe("coaching");
    const preview = await call("preview_page", { page_id: page.id });
    expect(preview.data).toMatchObject({ version: 1, requiresLogin: true });
    expect(preview.data.url).toContain(`/preview/${page.id}?v=1`);
    const { tools } = await client.listTools();
    expect(tools.some((t) => /publish/.test(t.name) && !t.annotations?.readOnlyHint)).toBe(false);
  });

  it("validate_page returns blocking errors and a manual review list", async () => {
    const { call, funnel } = await setupAgent();
    const { data: page } = await call("create_page", { funnel_id: funnel.id, name: "P", kind: "landing", skill_version: DESIGN_SKILL_VERSION });
    const report = await call("validate_page", { page_id: page.id });
    expect(report.data).toMatchObject({ pageId: page.id, version: 1, errors: [] });
    expect(report.data.review.length).toBeGreaterThan(0);
  });
});

describe("MCP security", () => {
  it("read-only tokens cannot write", async () => {
    const { call, funnel } = await setupAgent("read");
    const r = await call("create_page", { funnel_id: funnel.id, name: "X", kind: "landing", skill_version: DESIGN_SKILL_VERSION });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("lecture seule");
    expect((await call("list_funnels")).data).toHaveLength(1);
  });

  it("a token is bound to its workspace, even for a user with several", async () => {
    const alice = await makeUser("Alice");
    const bob = await makeUser("Bob");
    const bobFunnel = await createFunnel(db, bob.userId, bob.workspaceId, { name: "Bob" });
    // Alice is also a member of Bob's workspace, but her token is for her own.
    await db.insert(workspaceMembers).values({ workspaceId: bob.workspaceId, userId: alice.userId, role: "editor" });
    const { token } = await createMcpToken(db, alice.userId, alice.workspaceId, { name: "A", access: "write" });
    const { call } = await connect(token);
    const r = await call("get_funnel", { funnel_id: bobFunnel.id });
    expect(r.isError).toBe(true);
    expect(r.text).toBe("Ressource introuvable");
    expect((await call("list_funnels")).data).toEqual([]);
  });

  it("caps the token by the user's current role, and revocation is immediate", async () => {
    const owner = await makeUser("Owner");
    const member = await makeUser("Member");
    await db.insert(workspaceMembers).values({ workspaceId: owner.workspaceId, userId: member.userId, role: "editor" });
    const { token, row } = await createMcpToken(db, member.userId, owner.workspaceId, { name: "M", access: "write" });
    expect((await authenticateMcpToken(db, token))?.canWrite).toBe(true);

    await db.update(workspaceMembers).set({ role: "viewer" }).where(eq(workspaceMembers.userId, member.userId));
    expect((await authenticateMcpToken(db, token))?.canWrite).toBe(false);

    await revokeMcpToken(db, member.userId, row.id);
    expect(await authenticateMcpToken(db, token)).toBeNull();
    expect(await authenticateMcpToken(db, "tia_inconnu")).toBeNull();
  });

  it("audits every call with tool, resource and outcome", async () => {
    const { call, funnel, ctx } = await setupAgent();
    await call("get_funnel", { funnel_id: funnel.id });
    await call("get_page", { page_id: "00000000-0000-0000-0000-000000000000" });
    const rows = await db.select().from(mcpAuditLog).where(eq(mcpAuditLog.tokenId, ctx.tokenId));
    expect(rows.map((r) => [r.tool, r.ok])).toEqual([["get_funnel", true], ["get_page", false]]);
    expect(rows[0]).toMatchObject({ resourceId: funnel.id, userId: ctx.userId, workspaceId: ctx.workspaceId });
  });

  it("rate-limits per token", async () => {
    const { call, ctx } = await setupAgent("read");
    await db.insert(mcpAuditLog).values(
      Array.from({ length: RATE_LIMIT_PER_MINUTE }, () => ({ tokenId: ctx.tokenId, workspaceId: ctx.workspaceId, userId: ctx.userId, tool: "list_funnels", ok: true })),
    );
    const r = await call("list_funnels");
    expect(r.isError).toBe(true);
    expect(r.text).toContain("Limite atteinte");
  });
});

describe("MCP analytics and A/B tools", () => {
  it("reads analytics and prepares drafts, but never starts a test", async () => {
    const { client, call, funnel, userId } = await setupAgent();
    const a = await createPage(db, { userId }, funnel.id, { name: "Accueil", kind: "landing" });
    const b = await createVariant(db, { userId }, a.id);
    await publishPage(db, userId, a.id, { path: "", reviewConfirmed: true });

    const stats = await call("get_funnel_analytics", { funnel_id: funnel.id, period: "7" });
    expect(stats.data.totals.visitors).toBe(0);
    expect(stats.data.limits.length).toBeGreaterThan(0);
    const compared = await call("compare_page_variants", { page_id: a.id });
    expect(compared.data.variants.map((v: { variant: string }) => v.variant)).toEqual(["A", "B"]);

    const created = await call("create_ab_experiment", {
      funnel_id: funnel.id, name: "Accroche", goal: "cta_click", variants: [{ page_id: a.id }, { page_id: b.id }],
    });
    expect(created.data.status).toBe("draft");
    const split = await call("update_ab_traffic_split", { experiment_id: created.data.id, weights: { [a.id]: 70, [b.id]: 30 } });
    expect(split.data.map((x: { weight: number }) => x.weight)).toEqual([70, 30]);
    const results = await call("get_ab_experiment_results", { experiment_id: created.data.id });
    expect(results.data.verdict.kind).toBe("insufficient");

    // No MCP tool starts, stops or picks a winner.
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).filter((n) => /start|stop|winner|publish_page/.test(n))).toEqual([]);

    // Once a person started it, the agent can no longer change the split.
    await startExperiment(db, userId, created.data.id, { reviewConfirmed: true });
    const refused = await call("update_ab_traffic_split", { experiment_id: created.data.id, weights: { [a.id]: 50 } });
    expect(refused.isError).toBe(true);
    expect(refused.text).toContain("Seul un brouillon");
  });

  it("keeps experiments of another workspace out of reach", async () => {
    const owner = await setupAgent();
    const a = await createPage(db, { userId: owner.userId }, owner.funnel.id, { name: "P", kind: "landing" });
    const b = await createVariant(db, { userId: owner.userId }, a.id);
    const exp = await createExperiment(db, owner.userId, owner.funnel.id, { name: "X", goal: "cta_click", arms: [{ pageId: a.id }, { pageId: b.id }] });

    const other = await setupAgent();
    expect((await other.call("get_ab_experiment_results", { experiment_id: exp.id })).isError).toBe(true);
    expect((await other.call("get_funnel_analytics", { funnel_id: owner.funnel.id })).isError).toBe(true);
    expect((await other.call("update_ab_traffic_split", { experiment_id: exp.id, weights: { [a.id]: 10 } })).isError).toBe(true);
  });
});
