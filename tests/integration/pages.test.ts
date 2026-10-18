import { describe, expect, it } from "vitest";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors";
import { createFunnel, updateFunnelBrief, getFunnel } from "@/server/funnels";
import {
  addSection,
  createPage,
  createVariant,
  getPage,
  listVariants,
  listVersions,
  removeSection,
  reorderSections,
  restoreVersion,
  updatePageContent,
  updateSection,
  updateTheme,
  validatePage,
} from "@/server/pages";
import { templateFor } from "@/server/page-templates";
import { db, makeUser } from "./db";

async function setup() {
  const u = await makeUser();
  const funnel = await createFunnel(db, u.userId, u.workspaceId, { name: "E-book" });
  const actor = { userId: u.userId };
  const page = await createPage(db, actor, funnel.id, { name: "Vente", kind: "sales" });
  return { ...u, actor, funnel, page };
}

describe("pages and versions", () => {
  it("creates a page from the kind's template at version 1", async () => {
    const { actor, page } = await setup();
    const p = await getPage(db, actor, page.id);
    expect(p.page.currentVersion).toBe(1);
    expect(p.version.authorKind).toBe("user");
    expect(p.version.content).toEqual(templateFor("sales"));
  });

  it("appends versions and never overwrites", async () => {
    const { actor, page } = await setup();
    await updateSection(db, actor, page.id, 1, "hero", { headline: "Apprenez Excel en 7 jours" });
    await updateTheme(db, actor, page.id, 2, { accent: "#123456" });
    const v1 = await getPage(db, actor, page.id, 1);
    const v3 = await getPage(db, actor, page.id);
    expect(v3.page.currentVersion).toBe(3);
    expect(v1.version.content.sections[0]).toMatchObject({ headline: "Votre promesse principale, en une phrase" });
    expect(v3.version.content.sections[0]).toMatchObject({ headline: "Apprenez Excel en 7 jours" });
    expect(v3.version.content.theme.accent).toBe("#123456");
    expect((await listVersions(db, actor, page.id)).map((v) => v.version)).toEqual([3, 2, 1]);
  });

  it("rejects a stale base version with ConflictError", async () => {
    const { actor, page } = await setup();
    await updateSection(db, actor, page.id, 1, "hero", { headline: "Première" });
    const err = await updateSection(db, actor, page.id, 1, "hero", { headline: "Seconde" }).catch((e) => e);
    expect(err).toBeInstanceOf(ConflictError);
    expect(err.currentVersion).toBe(2);
    expect((await getPage(db, actor, page.id)).version.content.sections[0]).toMatchObject({ headline: "Première" });
  });

  it("serializes concurrent writers: exactly one wins", async () => {
    const { actor, page } = await setup();
    const results = await Promise.allSettled(
      ["A", "B", "C"].map((h) => updateSection(db, actor, page.id, 1, "hero", { headline: h })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected" && r.reason instanceof ConflictError)).toHaveLength(2);
  });

  it("adds, removes, reorders sections and restores an old version", async () => {
    const { actor, page } = await setup();
    await addSection(db, actor, page.id, 1, { id: "garantie", type: "text", body: "Satisfait ou remboursé 30 jours." }, 1);
    let c = (await getPage(db, actor, page.id)).version.content;
    expect(c.sections.map((s) => s.id)).toEqual(["hero", "garantie", "probleme", "contenu", "offre", "questions"]);

    await reorderSections(db, actor, page.id, 2, ["offre", "hero", "garantie", "probleme", "contenu", "questions"]);
    await removeSection(db, actor, page.id, 3, "garantie");
    c = (await getPage(db, actor, page.id)).version.content;
    expect(c.sections.map((s) => s.id)).toEqual(["offre", "hero", "probleme", "contenu", "questions"]);

    await restoreVersion(db, actor, page.id, 4, 1);
    const restored = await getPage(db, actor, page.id);
    expect(restored.page.currentVersion).toBe(5);
    expect(restored.version.content).toEqual(templateFor("sales"));
  });

  it("validates content strictly", async () => {
    const { actor, page } = await setup();
    const bad = async (edit: Record<string, unknown>, sectionId = "hero") =>
      updateSection(db, actor, page.id, 1, sectionId, edit).catch((e) => e);
    expect(await bad({ cta: { label: "Go", href: "javascript:alert(1)" } })).toBeInstanceOf(ValidationError);
    expect(await bad({ headline: "" })).toBeInstanceOf(ValidationError);
    expect(await bad({ image: { url: "http://insecure.test/x.png", alt: "x" } })).toBeInstanceOf(ValidationError);
    expect(await bad({ id: "autre" })).toBeInstanceOf(ValidationError);
    expect(
      await addSection(db, actor, page.id, 1, { id: "avis", type: "testimonials", items: [{ quote: "Top", author: "Inventé" }] }).catch((e) => e),
    ).toBeInstanceOf(ValidationError);
    expect(
      await addSection(db, actor, page.id, 1, { id: "hero", type: "text", body: "Doublon" }).catch((e) => e),
    ).toBeInstanceOf(ValidationError);
    expect((await getPage(db, actor, page.id)).page.currentVersion).toBe(1);
  });
});

describe("variants", () => {
  it("allows 2, 3 or 4 pages per group and refuses a fifth explicitly", async () => {
    const { actor, page } = await setup();
    const b = await createVariant(db, actor, page.id);
    expect(b.variantLabel).toBe("B");
    expect((await listVariants(db, actor, page.id)).map((p) => p.variantLabel)).toEqual(["A", "B"]);
    await createVariant(db, actor, page.id);
    await createVariant(db, actor, b.id);
    const err = await createVariant(db, actor, page.id).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toContain("4 variantes maximum");
    expect(await listVariants(db, actor, page.id)).toHaveLength(4);
  });

  it("keeps variants independent", async () => {
    const { actor, page } = await setup();
    const b = await createVariant(db, actor, page.id);
    await updateSection(db, actor, b.id, 1, "hero", { headline: "Angle B" });
    expect((await getPage(db, actor, page.id)).version.content.sections[0]).toMatchObject({
      headline: "Votre promesse principale, en une phrase",
    });
    expect((await getPage(db, actor, b.id)).version.content.sections[0]).toMatchObject({ headline: "Angle B" });
  });

  it("never lets two concurrent calls take the last slot", async () => {
    const { actor, page } = await setup();
    await createVariant(db, actor, page.id);
    await createVariant(db, actor, page.id);
    const results = await Promise.allSettled([createVariant(db, actor, page.id), createVariant(db, actor, page.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await listVariants(db, actor, page.id)).toHaveLength(4);
  });
});

describe("validation report", () => {
  it("blocks low-contrast accents and lists the manual review", async () => {
    const { actor, page } = await setup();
    await updateTheme(db, actor, page.id, 1, { accent: "#777777" });
    const report = await validatePage(db, actor, page.id);
    expect(report.errors.map((e) => e.code)).toContain("contrast-button");
    expect(report.review.length).toBeGreaterThan(3);
    expect(report.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(["zero-price", "placeholder-link"]));
  });
});

describe("isolation and brief", () => {
  it("hides pages of other workspaces", async () => {
    const { page } = await setup();
    const other = await makeUser("Intrus");
    const intruder = { userId: other.userId };
    await expect(getPage(db, intruder, page.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(updateSection(db, intruder, page.id, 1, "hero", { headline: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(createVariant(db, intruder, page.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("stores a validated brief", async () => {
    const { userId, funnel } = await setup();
    await updateFunnelBrief(db, userId, funnel.id, { productName: "Excel facile", currency: "xof", productType: "ebook" });
    const f = await getFunnel(db, userId, funnel.id);
    expect(f.brief).toMatchObject({ productName: "Excel facile", currency: "XOF", productType: "ebook", audience: "" });
    await expect(updateFunnelBrief(db, userId, funnel.id, { currency: "EURO" })).rejects.toBeInstanceOf(ValidationError);
  });
});

it("updatePageContent rejects a full replacement that breaks the schema", async () => {
  const { actor, page } = await setup();
  await expect(
    updatePageContent(db, actor, page.id, { baseVersion: 1, content: { schemaVersion: 2, theme: {}, sections: [] } }),
  ).rejects.toBeInstanceOf(ValidationError);
});
