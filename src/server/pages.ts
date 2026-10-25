import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { mcpTokens, pageKind, pageVersions, pages, publications, users, type Page, type PageKind } from "@/db/schema";
import { QuotaExceededError, variantLimit } from "./billing/plans";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { requireFunnel } from "./funnels";
import { formatIssues, pageContentSchema, sectionSchema, type PageContent, type Section } from "./page-schema";
import { templateFor } from "./page-templates";
import { validatePageContent } from "./page-validation";
import { isUuid, type Permission } from "./workspaces";

/** Who is acting. Agents act on behalf of a user, through one MCP token. */
export type Actor = { userId: string; mcpTokenId?: string };

export const MAX_VARIANTS = 4;
const LABELS = ["A", "B", "C", "D"] as const;

const pageNameSchema = z.string().trim().min(1, "Donne un nom à la page").max(80, "80 caractères maximum");

function parseContent(raw: unknown): PageContent {
  const parsed = pageContentSchema.safeParse(raw);
  if (!parsed.success) {
    throw new ValidationError(`Contenu de page invalide :\n${formatIssues(parsed.error)}`);
  }
  return parsed.data;
}

function parseName(raw: unknown) {
  const parsed = pageNameSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, { name: parsed.error.issues[0].message });
  return parsed.data;
}

function parseKind(raw: unknown): PageKind {
  const parsed = z.enum(pageKind.enumValues).safeParse(raw);
  if (!parsed.success) throw new ValidationError(`Type de page inconnu. Valeurs : ${pageKind.enumValues.join(", ")}`);
  return parsed.data;
}

function authorOf(actor: Actor) {
  return actor.mcpTokenId
    ? { authorKind: "agent" as const, authorUserId: actor.userId, mcpTokenId: actor.mcpTokenId }
    : { authorKind: "user" as const, authorUserId: actor.userId, mcpTokenId: null };
}

/** Loads a page only if the actor may perform `permission` on its workspace. */
async function requirePage(db: Db, actor: Actor, pageId: string, permission: Permission) {
  if (!isUuid(pageId)) throw new NotFoundError("Page introuvable");
  const [page] = await db.select().from(pages).where(eq(pages.id, pageId));
  if (!page) throw new NotFoundError("Page introuvable");
  // Goes through the funnel so the workspace check is the same one as everywhere else.
  const funnel = await requireFunnel(db, actor.userId, page.funnelId, permission);
  return { page, funnel };
}

export async function listPages(db: Db, actor: Actor, funnelId: string) {
  await requireFunnel(db, actor.userId, funnelId, "read");
  return db
    .select()
    .from(pages)
    .where(eq(pages.funnelId, funnelId))
    .orderBy(asc(pages.createdAt), asc(pages.variantLabel));
}

export async function getPage(db: Db, actor: Actor, pageId: string, version?: number) {
  const { page, funnel } = await requirePage(db, actor, pageId, "read");
  const v = version ?? page.currentVersion;
  const [row] = await db
    .select()
    .from(pageVersions)
    .where(and(eq(pageVersions.pageId, page.id), eq(pageVersions.version, v)));
  if (!row) throw new NotFoundError(`Version ${v} introuvable`);
  return { page, funnel, version: row };
}

export async function listVersions(db: Db, actor: Actor, pageId: string) {
  await requirePage(db, actor, pageId, "read");
  return db
    .select({
      version: pageVersions.version,
      authorKind: pageVersions.authorKind,
      authorUserId: pageVersions.authorUserId,
      mcpTokenId: pageVersions.mcpTokenId,
      authorName: users.name,
      agentName: mcpTokens.name,
      note: pageVersions.note,
      createdAt: pageVersions.createdAt,
    })
    .from(pageVersions)
    .leftJoin(users, eq(users.id, pageVersions.authorUserId))
    .leftJoin(mcpTokens, eq(mcpTokens.id, pageVersions.mcpTokenId))
    .where(eq(pageVersions.pageId, pageId))
    .orderBy(desc(pageVersions.version));
}

export async function createPage(
  db: Db,
  actor: Actor,
  funnelId: string,
  input: { name: unknown; kind: unknown; content?: unknown; note?: string },
) {
  await requireFunnel(db, actor.userId, funnelId, "edit");
  const name = parseName(input.name);
  const kind = parseKind(input.kind);
  const content = input.content === undefined ? templateFor(kind) : parseContent(input.content);

  return db.transaction(async (tx) => {
    const id = crypto.randomUUID();
    const [page] = await tx
      .insert(pages)
      .values({ id, funnelId, name, kind, variantGroupId: id, variantLabel: "A", currentVersion: 1 })
      .returning();
    await tx.insert(pageVersions).values({ pageId: id, version: 1, content, note: input.note ?? "Création", ...authorOf(actor) });
    return page;
  });
}

/**
 * Appends a new version. `baseVersion` is the version the caller read: if someone saved since,
 * the call fails with ConflictError instead of overwriting their work.
 */
export async function updatePageContent(
  db: Db,
  actor: Actor,
  pageId: string,
  input: { baseVersion: number; content?: unknown; edit?: (current: PageContent) => PageContent; note?: string },
) {
  const { page } = await requirePage(db, actor, pageId, "edit");
  return db.transaction(async (tx) => {
    // Row lock: concurrent writers queue here, then see the bumped version.
    const [locked] = await tx.select().from(pages).where(eq(pages.id, page.id)).for("update");
    if (locked.currentVersion !== input.baseVersion) throw new ConflictError(locked.currentVersion);

    let next: PageContent;
    if (input.edit) {
      const [current] = await tx
        .select({ content: pageVersions.content })
        .from(pageVersions)
        .where(and(eq(pageVersions.pageId, page.id), eq(pageVersions.version, locked.currentVersion)));
      next = parseContent(input.edit(structuredClone(current.content)));
    } else {
      next = parseContent(input.content);
    }

    const version = locked.currentVersion + 1;
    await tx.insert(pageVersions).values({ pageId: page.id, version, content: next, note: input.note ?? null, ...authorOf(actor) });
    const [updated] = await tx
      .update(pages)
      .set({ currentVersion: version, updatedAt: sql`now()` })
      .where(eq(pages.id, page.id))
      .returning();
    return updated;
  });
}

function findSection(content: PageContent, sectionId: string) {
  const index = content.sections.findIndex((s) => s.id === sectionId);
  if (index === -1) throw new NotFoundError(`Section « ${sectionId} » introuvable`);
  return index;
}

/** Changes only the given fields of one section; everything else is kept as is. */
export async function updateSection(db: Db, actor: Actor, pageId: string, baseVersion: number, sectionId: string, changes: Record<string, unknown>, note?: string) {
  if ("id" in changes || "type" in changes) throw new ValidationError("L’identifiant et le type d’une section ne se modifient pas.");
  return updatePageContent(db, actor, pageId, {
    baseVersion,
    note: note ?? `Section « ${sectionId} » modifiée`,
    edit: (c) => {
      const i = findSection(c, sectionId);
      c.sections[i] = { ...c.sections[i], ...changes } as Section;
      return c;
    },
  });
}

export async function updateTheme(db: Db, actor: Actor, pageId: string, baseVersion: number, changes: Partial<PageContent["theme"]>, note?: string) {
  return updatePageContent(db, actor, pageId, {
    baseVersion,
    note: note ?? "Thème modifié",
    edit: (c) => ({ ...c, theme: { ...c.theme, ...changes } }),
  });
}

export async function addSection(db: Db, actor: Actor, pageId: string, baseVersion: number, section: unknown, position?: number, note?: string) {
  const parsed = sectionSchema.safeParse(section);
  if (!parsed.success) throw new ValidationError(`Section invalide :\n${formatIssues(parsed.error)}`);
  return updatePageContent(db, actor, pageId, {
    baseVersion,
    note: note ?? `Section « ${parsed.data.id} » ajoutée`,
    edit: (c) => {
      const at = position === undefined ? c.sections.length : Math.max(0, Math.min(position, c.sections.length));
      c.sections.splice(at, 0, parsed.data);
      return c;
    },
  });
}

export async function removeSection(db: Db, actor: Actor, pageId: string, baseVersion: number, sectionId: string, note?: string) {
  return updatePageContent(db, actor, pageId, {
    baseVersion,
    note: note ?? `Section « ${sectionId} » supprimée`,
    edit: (c) => {
      c.sections.splice(findSection(c, sectionId), 1);
      return c;
    },
  });
}

export async function reorderSections(db: Db, actor: Actor, pageId: string, baseVersion: number, order: string[], note?: string) {
  return updatePageContent(db, actor, pageId, {
    baseVersion,
    note: note ?? "Sections réorganisées",
    edit: (c) => {
      const ids = c.sections.map((s) => s.id);
      if (order.length !== ids.length || new Set(order).size !== order.length || !order.every((id) => ids.includes(id))) {
        throw new ValidationError(`L’ordre doit contenir chaque section exactement une fois : ${ids.join(", ")}`);
      }
      c.sections = order.map((id) => c.sections[ids.indexOf(id)]);
      return c;
    },
  });
}

/** Restoring creates a new version with the old content; history is never rewritten. */
export async function restoreVersion(db: Db, actor: Actor, pageId: string, baseVersion: number, version: number) {
  const { version: old } = await getPage(db, actor, pageId, version);
  return updatePageContent(db, actor, pageId, { baseVersion, content: old.content, note: `Version ${version} restaurée` });
}

/** A copy that starts its own variant group (a new page, not a variant). */
export async function duplicatePage(db: Db, actor: Actor, pageId: string, name?: unknown) {
  const { page, version } = await getPage(db, actor, pageId);
  return createPage(db, actor, page.funnelId, {
    name: name ?? `${page.name} (copie)`.slice(0, 80),
    kind: page.kind,
    content: version.content,
    note: `Copie de « ${page.name} » v${page.currentVersion}`,
  });
}

/**
 * An independent page in the same variant group, at most MAX_VARIANTS per group.
 * Starts from the source's current content unless `content` is given.
 */
export async function createVariant(db: Db, actor: Actor, pageId: string, input: { content?: unknown; note?: string } = {}) {
  const { page: source, funnel } = await requirePage(db, actor, pageId, "edit");
  const { version } = await getPage(db, actor, pageId);
  const content = input.content === undefined ? version.content : parseContent(input.content);

  return db.transaction(async (tx) => {
    // Serialize variant creation per group so two callers cannot both take the 4th slot.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${source.variantGroupId}))`);
    const siblings = await tx
      .select({ label: pages.variantLabel })
      .from(pages)
      .where(eq(pages.variantGroupId, source.variantGroupId));
    if (siblings.length >= MAX_VARIANTS) {
      throw new ValidationError(`Limite atteinte : ${MAX_VARIANTS} variantes maximum par page.`);
    }
    const { limit, plan } = await variantLimit(tx, funnel.workspaceId, MAX_VARIANTS);
    if (siblings.length >= limit) throw new QuotaExceededError("variantsPerPage", limit, plan.name);
    const used = new Set(siblings.map((s) => s.label));
    const label = LABELS.find((l) => !used.has(l))!;
    const id = crypto.randomUUID();
    const [page] = await tx
      .insert(pages)
      .values({
        id,
        funnelId: source.funnelId,
        name: source.name,
        kind: source.kind,
        variantGroupId: source.variantGroupId,
        variantLabel: label,
        currentVersion: 1,
      })
      .returning();
    await tx.insert(pageVersions).values({
      pageId: id,
      version: 1,
      content,
      note: input.note ?? `Variante ${label} créée depuis ${source.variantLabel} v${source.currentVersion}`,
      ...authorOf(actor),
    });
    return page;
  });
}

export async function listVariants(db: Db, actor: Actor, pageId: string) {
  const { page } = await requirePage(db, actor, pageId, "read");
  return db
    .select()
    .from(pages)
    .where(eq(pages.variantGroupId, page.variantGroupId))
    .orderBy(asc(pages.variantLabel));
}

export async function deletePage(db: Db, actor: Actor, pageId: string): Promise<Page> {
  const { page } = await requirePage(db, actor, pageId, "delete");
  const [live] = await db
    .select({ id: publications.id })
    .from(publications)
    .where(and(eq(publications.pageId, page.id), isNull(publications.unpublishedAt)));
  if (live) throw new ValidationError("Cette page est en ligne : dépublie-la avant de la supprimer.");
  await db.delete(pages).where(eq(pages.id, page.id));
  return page;
}

export async function validatePage(db: Db, actor: Actor, pageId: string, version?: number) {
  const { page, version: row } = await getPage(db, actor, pageId, version);
  return { pageId: page.id, version: row.version, ...validatePageContent(page.kind, row.content) };
}
