import { and, eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { events, experimentAssignments } from "@/db/schema";
import {
  addArm,
  createExperiment,
  getExperimentResults,
  listExperiments,
  selectWinner,
  startExperiment,
  stopExperiment,
  updateTrafficSplit,
} from "@/server/analytics/experiments";
import { getFunnelAnalytics } from "@/server/analytics/reports";
import { recordBrowserEvent, recordCheckoutSubmitted, recordOrderPaid, signViewToken, verifyViewToken } from "@/server/analytics/tracking";
import { NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel } from "@/server/funnels";
import { createPage, createVariant, getPage, updateSection, updateTheme } from "@/server/pages";
import { publishPage, resolvePublishedPage } from "@/server/publishing";
import { db, makeUser } from "./db";

beforeAll(() => {
  process.env.ANALYTICS_SECRET = "x".repeat(40);
});

async function setup(variants = 4) {
  const u = await makeUser();
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Test AB" });
  const a = await createPage(db, { userId: u.userId }, funnel.id, { name: "Accueil", kind: "landing" });
  const pagesList = [a];
  for (let i = 1; i < variants; i++) {
    const v = await createVariant(db, { userId: u.userId }, a.id);
    await updateSection(db, { userId: u.userId }, v.id, 1, "hero", { headline: `Accroche ${v.variantLabel}` });
    pagesList.push(v);
  }
  await publishPage(db, u.userId, a.id, { path: "", reviewConfirmed: true });
  return { ...u, funnel, pages: pagesList, site: { subdomain: "test-ab" } };
}

const arms = (ps: { id: string }[]) => ps.map((p) => ({ pageId: p.id }));

describe("experiment lifecycle (scenarios 26.6)", () => {
  it("creates experiments with 2, 3 and 4 variants and refuses a fifth explicitly", async () => {
    const s = await setup(4);
    for (const n of [2, 3, 4]) {
      const exp = await createExperiment(db, s.userId, s.funnel.id, { name: `${n} variantes`, goal: "cta_click", arms: arms(s.pages.slice(0, n)) });
      expect(exp.status).toBe("draft");
    }
    await expect(createExperiment(db, s.userId, s.funnel.id, { name: "1", goal: "cta_click", arms: arms(s.pages.slice(0, 1)) })).rejects.toThrow("au moins 2");
    const four = (await listExperiments(db, s.userId, s.funnel.id)).find((e) => e.name === "4 variantes")!;
    // A 5th page in the group is impossible (4 variants max per page), and a 5th arm is refused anyway.
    const err = await addArm(db, s.userId, four.id, { pageId: s.pages[0].id }).catch((e) => e);
    expect(err.message).toContain("4 variantes actives maximum");
  });

  it("only starts where the group is live, after checks and human review", async () => {
    const u = await makeUser();
    const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "Brouillon" });
    const a = await createPage(db, { userId: u.userId }, funnel.id, { name: "P", kind: "landing" });
    const b = await createVariant(db, { userId: u.userId }, a.id);
    const exp = await createExperiment(db, u.userId, funnel.id, { name: "T", goal: "cta_click", arms: arms([a, b]) });
    await expect(startExperiment(db, u.userId, exp.id, { reviewConfirmed: true })).rejects.toThrow("Publiez d’abord");
    await publishPage(db, u.userId, a.id, { path: "", reviewConfirmed: true });
    await updateTheme(db, { userId: u.userId }, b.id, 1, { accent: "#777777" });
    await expect(startExperiment(db, u.userId, exp.id, { reviewConfirmed: true })).rejects.toThrow("B : Contraste");
    await updateTheme(db, { userId: u.userId }, b.id, 2, { accent: "#123456" });
    await expect(startExperiment(db, u.userId, exp.id, { reviewConfirmed: false })).rejects.toThrow("revue humaine");
    expect((await startExperiment(db, u.userId, exp.id, { reviewConfirmed: true })).status).toBe("running");
  });

  it("serves frozen arms with a stable assignment per visitor, following the weights", async () => {
    const s = await setup(2);
    const exp = await createExperiment(db, s.userId, s.funnel.id, { name: "T", goal: "cta_click", arms: arms(s.pages) });
    await startExperiment(db, s.userId, exp.id, { reviewConfirmed: true });

    // Editing a variant after the start does not change what visitors see (frozen version).
    await updateSection(db, { userId: s.userId }, s.pages[1].id, 2, "hero", { headline: "Brouillon non publié" });

    const seen = new Map<string, string>();
    for (let i = 0; i < 200; i++) {
      const r = (await resolvePublishedPage(db, s.site, "", `visitor-${i}`))!;
      seen.set(`visitor-${i}`, r.variantLabel);
      expect(r.experimentId).toBe(exp.id);
      if (r.variantLabel === "B") expect((r.content.sections[0] as { headline: string }).headline).toBe("Accroche B");
    }
    const share = [...seen.values()].filter((v) => v === "B").length / 200;
    expect(share).toBeGreaterThan(0.35);
    expect(share).toBeLessThan(0.65);
    // Same visitor, same arm, even after the weights change.
    await updateTrafficSplit(db, s.userId, exp.id, { [s.pages[0].id]: 10, [s.pages[1].id]: 90 });
    for (let i = 0; i < 20; i++) expect((await resolvePublishedPage(db, s.site, "", `visitor-${i}`))!.variantLabel).toBe(seen.get(`visitor-${i}`));
    // Visitors who refuse tracking are served but never stored.
    await resolvePublishedPage(db, s.site, "", null);
    expect(await db.select().from(experimentAssignments).where(eq(experimentAssignments.experimentId, exp.id))).toHaveLength(200);
    // Concurrent first requests of one visitor (page + metadata) agree on the arm.
    for (let i = 0; i < 10; i++) {
      const served = await Promise.all(Array.from({ length: 4 }, () => resolvePublishedPage(db, s.site, "", `racer-${i}`)));
      expect(new Set(served.map((r) => r!.pageId)).size).toBe(1);
    }
  });

  it("measures conversions and confirmed payments per arm, warns on small samples, keeps results after the winner", async () => {
    const s = await setup(2);
    const exp = await createExperiment(db, s.userId, s.funnel.id, { name: "Paiement", goal: "order_paid", arms: arms(s.pages) });
    await startExperiment(db, s.userId, exp.id, { reviewConfirmed: true });

    let orderNo = 0;
    for (let i = 0; i < 30; i++) {
      const visitorId = `v${i}`;
      const page = (await resolvePublishedPage(db, s.site, "", visitorId))!;
      const ctx = { workspaceId: s.workspaceId, funnelId: s.funnel.id, pageId: page.pageId, variantLabel: page.variantLabel, experimentId: exp.id, visitorId, sessionId: `s${i}` };
      const token = signViewToken(ctx)!;
      expect(await recordBrowserEvent(db, { token, type: "page_view", visitorCookie: visitorId })).toBe(true);
      expect(await recordBrowserEvent(db, { token, type: "page_view", visitorCookie: visitorId })).toBe(false); // deduplicated
      if (i % 5 === 0) {
        const order = { id: crypto.randomUUID(), workspaceId: s.workspaceId, funnelId: s.funnel.id, pageId: page.pageId, variantLabel: page.variantLabel, experimentId: exp.id, visitorId, amount: 5000, currency: "XOF" };
        // Orders must exist for the foreign key: record against a real order row.
        const { orders } = await import("@/db/schema");
        await db.insert(orders).values({ ...order, productName: "E-book", merchantTransactionId: `T${++orderNo}${Date.now()}`.slice(0, 30), customerFirstName: "A", customerLastName: "B", customerEmail: "a@b.co" });
        await recordCheckoutSubmitted(db, order);
        if (i % 10 === 0) {
          await recordOrderPaid(db, order);
          await recordOrderPaid(db, order); // replay: counted once
        }
      }
    }
    const results = await getExperimentResults(db, s.userId, exp.id);
    const totalVisitors = results.arms.reduce((n, a) => n + a.visitors, 0);
    const totalPaid = results.arms.reduce((n, a) => n + a.conversions, 0);
    expect(totalVisitors).toBe(30);
    expect(totalPaid).toBe(3);
    expect(results.arms.reduce((n, a) => n + a.revenue, 0)).toBe(15000);
    expect(results.verdict.kind).toBe("insufficient");
    expect(results.method).toContain("Wilson");

    const analytics = await getFunnelAnalytics(db, s.userId, s.funnel.id, { period: "7" });
    expect(analytics.totals).toMatchObject({ visitors: 30, pageViews: 30, checkouts: 6, payments: 3 });
    expect(analytics.revenue).toEqual([{ currency: "XOF", total: 15000, orders: 3, averageOrder: 5000 }]);
    expect(analytics.totals.conversionRate).toBeCloseTo(0.1);

    await stopExperiment(db, s.userId, exp.id);
    // After stopping, the path serves the live publication again.
    expect((await resolvePublishedPage(db, s.site, "", "v1"))!.experimentId).toBeNull();
    await expect(selectWinner(db, s.userId, exp.id, { pageId: s.pages[1].id, reviewConfirmed: false })).rejects.toThrow("revue");
    const done = await selectWinner(db, s.userId, exp.id, { pageId: s.pages[1].id, reviewConfirmed: true });
    expect(done.winnerPageId).toBe(s.pages[1].id);
    expect((await resolvePublishedPage(db, s.site, ""))!.variantLabel).toBe("B");
    // Results and the other variant are kept.
    expect((await getExperimentResults(db, s.userId, exp.id)).arms.reduce((n, a) => n + a.visitors, 0)).toBe(30);
    expect((await getPage(db, { userId: s.userId }, s.pages[0].id)).page.id).toBe(s.pages[0].id);
  });

  it("adds a variant to a running test and isolates workspaces", async () => {
    const s = await setup(3);
    const exp = await createExperiment(db, s.userId, s.funnel.id, { name: "T", goal: "cta_click", arms: arms(s.pages.slice(0, 2)) });
    await startExperiment(db, s.userId, exp.id, { reviewConfirmed: true });
    await expect(addArm(db, s.userId, exp.id, { pageId: s.pages[2].id })).rejects.toThrow("revue");
    const after = await addArm(db, s.userId, exp.id, { pageId: s.pages[2].id, reviewConfirmed: true });
    expect(after.map((a) => [a.variantLabel, a.version !== null])).toEqual([["A", true], ["B", true], ["C", true]]);

    const intruder = await makeUser("Intrus");
    await expect(getExperimentResults(db, intruder.userId, exp.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(stopExperiment(db, intruder.userId, exp.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getFunnelAnalytics(db, intruder.userId, s.funnel.id)).rejects.toBeInstanceOf(NotFoundError);
    const other = await createFunnel(db, intruder.userId, intruder.workspaceId, { name: "X" });
    await expect(createExperiment(db, intruder.userId, other.id, { name: "T", goal: "cta_click", arms: arms(s.pages.slice(0, 2)) })).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("browser events", () => {
  it("rejects forged, tampered, expired and cross-visitor tokens", async () => {
    const s = await setup(1);
    const ctx = { workspaceId: s.workspaceId, funnelId: s.funnel.id, pageId: s.pages[0].id, variantLabel: "A", experimentId: null, visitorId: "vis", sessionId: "ses" };
    const token = signViewToken(ctx)!;
    expect(verifyViewToken(token)).toEqual(ctx);
    const [data, mac] = token.split(".");
    const tampered = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(data, "base64url").toString()), pageId: crypto.randomUUID() })).toString("base64url");
    expect(verifyViewToken(`${tampered}.${mac}`)).toBeNull();
    expect(verifyViewToken(signViewToken(ctx, Date.now() - 25 * 3600 * 1000)!)).toBeNull();
    expect(await recordBrowserEvent(db, { token, type: "page_view", visitorCookie: "someone-else" })).toBe(false);
    expect(await recordBrowserEvent(db, { token, type: "order_paid" })).toBe(false);
    expect(await recordBrowserEvent(db, { token, type: "cta_click", target: "Je commence" })).toBe(true);
    const rows = await db.select().from(events).where(and(eq(events.funnelId, s.funnel.id)));
    expect(rows.map((r) => r.type)).toEqual(["cta_click"]);
  });
});
