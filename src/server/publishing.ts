import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { domains, funnels, pages, pageVersions, publications, users } from "@/db/schema";
import { isUniqueViolation, ValidationError } from "./errors";
import { requireFunnel, slugify } from "./funnels";
import type { PageContent } from "./page-schema";
import { validatePageContent } from "./page-validation";
import { getPage } from "./pages";
import { checkoutProblems } from "./payments/checks";
import { assignArm, runningExperimentAt } from "./analytics/assignment";

/*
 * Publication: a page version becomes public at a path of the funnel's site.
 * Only people publish (never an MCP agent), only after deterministic checks pass and
 * the human review list is confirmed. Publications are snapshots: later edits to the
 * page do not change what is live until it is published again.
 */

export const RESERVED_SUBDOMAINS = new Set([
  "www", "app", "api", "admin", "mail", "smtp", "ftp", "cname", "dns", "static", "assets", "cdn",
  "status", "support", "help", "docs", "blog", "mcp", "preview", "dashboard", "login", "auth",
]);

const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/, "3 à 32 caractères : lettres minuscules, chiffres, tirets (pas en début ni en fin)")
  .refine((s) => !RESERVED_SUBDOMAINS.has(s), "Ce sous-domaine est réservé");

const pathSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^([a-z0-9][a-z0-9-]{0,47})?$/, "Adresse : vide pour l’accueil, ou un mot en minuscules (lettres, chiffres, tirets)");

/** Gives the funnel a platform-unique subdomain derived from its slug, if it has none. */
async function ensureSubdomain(db: Db, funnelId: string) {
  const [funnel] = await db.select({ subdomain: funnels.subdomain, slug: funnels.slug }).from(funnels).where(eq(funnels.id, funnelId));
  if (funnel.subdomain) return funnel.subdomain;
  const base = slugify(funnel.slug).slice(0, 28).replace(/-+$/, "").padEnd(3, "0");
  for (let n = 1; n < 50; n++) {
    const candidate = n === 1 && !RESERVED_SUBDOMAINS.has(base) ? base : `${base}-${n}`;
    try {
      const [row] = await db.update(funnels).set({ subdomain: candidate }).where(and(eq(funnels.id, funnelId), isNull(funnels.subdomain))).returning({ subdomain: funnels.subdomain });
      if (row) return row.subdomain!;
      const [again] = await db.select({ subdomain: funnels.subdomain }).from(funnels).where(eq(funnels.id, funnelId));
      return again.subdomain!;
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
    }
  }
  throw new Error("Could not allocate a subdomain");
}

export async function setSubdomain(db: Db, userId: string, funnelId: string, input: unknown) {
  const funnel = await requireFunnel(db, userId, funnelId, "edit");
  const parsed = subdomainSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { subdomain: parsed.error.issues[0].message });
  try {
    const [updated] = await db.update(funnels).set({ subdomain: parsed.data, updatedAt: sql`now()` }).where(eq(funnels.id, funnel.id)).returning();
    return updated;
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("Ce sous-domaine est déjà pris", { subdomain: "Ce sous-domaine est déjà pris" });
    throw e;
  }
}

export async function publishPage(
  db: Db,
  userId: string,
  pageId: string,
  input: { path: unknown; version?: number; reviewConfirmed: unknown },
) {
  const { page, version } = await getPage(db, { userId }, pageId, input.version);
  const funnel = await requireFunnel(db, userId, page.funnelId, "edit");

  const path = pathSchema.safeParse(input.path ?? "");
  if (!path.success) throw new ValidationError(path.error.issues[0].message, { path: path.error.issues[0].message });
  const report = validatePageContent(page.kind, version.content);
  if (report.errors.length > 0) {
    throw new ValidationError(`Publication bloquée par les contrôles : ${report.errors.map((e) => e.message).join(" ")}`);
  }
  const paymentProblems = await checkoutProblems(db, funnel.workspaceId, version.content);
  if (paymentProblems.length > 0) {
    throw new ValidationError(`Publication bloquée : ${paymentProblems.join(" ")}`);
  }
  if (input.reviewConfirmed !== true) {
    throw new ValidationError("Confirme la revue humaine avant de publier.", { review: "Coche chaque point de la revue" });
  }

  await ensureSubdomain(db, page.funnelId);
  return db.transaction(async (tx) => {
    // One publisher at a time per funnel, so the live-path index is never raced.
    await tx.select({ id: funnels.id }).from(funnels).where(eq(funnels.id, page.funnelId)).for("update");
    const group = await tx.select({ id: pages.id }).from(pages).where(eq(pages.variantGroupId, page.variantGroupId));
    // Replace whatever is live at this path, and this page group's live row at any other path.
    await tx
      .update(publications)
      .set({ unpublishedAt: sql`now()` })
      .where(
        and(
          eq(publications.funnelId, page.funnelId),
          isNull(publications.unpublishedAt),
          sql`(${publications.path} = ${path.data} or ${inArray(publications.pageId, group.map((g) => g.id))})`,
        ),
      );
    const [row] = await tx
      .insert(publications)
      .values({ funnelId: page.funnelId, pageId: page.id, version: version.version, path: path.data, publishedBy: userId })
      .returning();
    await tx.update(funnels).set({ status: "published", updatedAt: sql`now()` }).where(eq(funnels.id, page.funnelId));
    return row;
  });
}

export async function unpublishPage(db: Db, userId: string, pageId: string) {
  const { page } = await getPage(db, { userId }, pageId);
  await requireFunnel(db, userId, page.funnelId, "edit");
  return db.transaction(async (tx) => {
    await tx.select({ id: funnels.id }).from(funnels).where(eq(funnels.id, page.funnelId)).for("update");
    const done = await tx
      .update(publications)
      .set({ unpublishedAt: sql`now()` })
      .where(and(eq(publications.pageId, page.id), isNull(publications.unpublishedAt)))
      .returning();
    if (done.length === 0) throw new ValidationError("Cette page n’est pas publiée.");
    const [{ live }] = await tx
      .select({ live: sql<number>`count(*)::int` })
      .from(publications)
      .where(and(eq(publications.funnelId, page.funnelId), isNull(publications.unpublishedAt)));
    if (live === 0) await tx.update(funnels).set({ status: "draft", updatedAt: sql`now()` }).where(eq(funnels.id, page.funnelId));
    return done[0];
  });
}

/** Full history, newest first, with who published. */
export async function listPublications(db: Db, userId: string, funnelId: string) {
  await requireFunnel(db, userId, funnelId, "read");
  return db
    .select({
      id: publications.id,
      pageId: publications.pageId,
      pageName: pages.name,
      variantLabel: pages.variantLabel,
      version: publications.version,
      path: publications.path,
      publishedByName: users.name,
      createdAt: publications.createdAt,
      unpublishedAt: publications.unpublishedAt,
    })
    .from(publications)
    .innerJoin(pages, eq(pages.id, publications.pageId))
    .leftJoin(users, eq(users.id, publications.publishedBy))
    .where(eq(publications.funnelId, funnelId))
    .orderBy(desc(publications.createdAt));
}

export type PublicSite = { subdomain: string } | { hostname: string };

/**
 * What a visitor sees at a site path, or null. Public: no user, so it only ever returns
 * live publications of a funnel reachable through its subdomain or a verified domain.
 */
export type ResolvedPage = {
  content: PageContent;
  title: string;
  funnelId: string;
  workspaceId: string;
  pageId: string;
  variantLabel: string;
  experimentId: string | null;
};

/**
 * `visitorId` (anonymous cookie) decides the arm when an A/B test runs on this path;
 * otherwise the live publication is served.
 */
export async function resolvePublishedPage(db: Db, site: PublicSite, path: string, visitorId: string | null = null): Promise<ResolvedPage | null> {
  if (!pathSchema.safeParse(path).success) return null;
  let funnelId: string | undefined;
  if ("subdomain" in site) {
    if (!subdomainSchema.safeParse(site.subdomain).success) return null;
    const [row] = await db.select({ id: funnels.id }).from(funnels).where(eq(funnels.subdomain, site.subdomain));
    funnelId = row?.id;
  } else {
    const [row] = await db
      .select({ id: domains.funnelId })
      .from(domains)
      .where(and(eq(domains.hostname, site.hostname.toLowerCase()), eq(domains.status, "verified")));
    funnelId = row?.id;
  }
  if (!funnelId) return null;

  const experiment = await runningExperimentAt(db, funnelId, path);
  const arm = experiment ? await assignArm(db, experiment.id, visitorId) : null;
  if (arm) {
    const [served] = await db
      .select({ content: pageVersions.content, name: pages.name, workspaceId: funnels.workspaceId })
      .from(pageVersions)
      .innerJoin(pages, eq(pages.id, pageVersions.pageId))
      .innerJoin(funnels, eq(funnels.id, pages.funnelId))
      .where(and(eq(pageVersions.pageId, arm.pageId), eq(pageVersions.version, arm.version)));
    if (served) {
      const hero = served.content.sections.find((s) => s.type === "hero");
      return {
        content: served.content,
        title: hero && "headline" in hero ? hero.headline : served.name,
        funnelId,
        workspaceId: served.workspaceId,
        pageId: arm.pageId,
        variantLabel: arm.variantLabel,
        experimentId: arm.experimentId,
      };
    }
  }

  const [row] = await db
    .select({ content: pageVersions.content, name: pages.name, pageId: pages.id, variantLabel: pages.variantLabel, workspaceId: funnels.workspaceId })
    .from(publications)
    .innerJoin(funnels, eq(funnels.id, publications.funnelId))
    .innerJoin(pageVersions, and(eq(pageVersions.pageId, publications.pageId), eq(pageVersions.version, publications.version)))
    .innerJoin(pages, eq(pages.id, publications.pageId))
    .where(and(eq(publications.funnelId, funnelId), eq(publications.path, path), isNull(publications.unpublishedAt)));
  if (!row) return null;
  const hero = row.content.sections.find((s) => s.type === "hero");
  return {
    content: row.content,
    title: hero && "headline" in hero ? hero.headline : row.name,
    funnelId,
    workspaceId: row.workspaceId,
    pageId: row.pageId,
    variantLabel: row.variantLabel,
    experimentId: null,
  };
}

/** Live publication of a page, if any (for the page screen and MCP). */
export async function livePublicationOf(db: Db, userId: string, pageId: string) {
  const { page } = await getPage(db, { userId }, pageId);
  const [row] = await db
    .select()
    .from(publications)
    .where(and(eq(publications.pageId, page.id), isNull(publications.unpublishedAt)));
  return row ?? null;
}
