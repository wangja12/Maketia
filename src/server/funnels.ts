import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { funnels } from "@/db/schema";
import { briefSchema } from "./brief";
import { NotFoundError, ValidationError } from "./errors";
import { fieldErrorsOf } from "./validation";
import { isUuid, requireMembership, type Permission } from "./workspaces";

const nameSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom au tunnel").max(80, "80 caractères maximum"),
});

function parseName(input: { name: unknown }) {
  const parsed = nameSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  }
  return parsed.data.name;
}

export function slugify(name: string) {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/, "");
  return slug || "tunnel";
}

export async function listFunnels(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select()
    .from(funnels)
    .where(eq(funnels.workspaceId, workspaceId))
    .orderBy(desc(funnels.updatedAt));
}

export async function createFunnel(
  db: Db,
  userId: string,
  workspaceId: string,
  input: { name: unknown },
) {
  await requireMembership(db, userId, workspaceId, "edit");
  const name = parseName(input);
  const base = slugify(name);

  // Pick the first free slug; the unique index is the real guard, so retry on a race.
  for (let attempt = 0; attempt < 3; attempt++) {
    const taken = await db
      .select({ slug: funnels.slug })
      .from(funnels)
      .where(
        and(
          eq(funnels.workspaceId, workspaceId),
          or(eq(funnels.slug, base), like(funnels.slug, `${base}-%`)),
        ),
      );
    const used = new Set(taken.map((r) => r.slug));
    let slug = base;
    for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;

    const [created] = await db
      .insert(funnels)
      .values({ workspaceId, name, slug })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
  }
  throw new Error("Could not allocate a funnel slug");
}

/** Loads a funnel only if the user may perform `permission` on its workspace. */
export async function requireFunnel(db: Db, userId: string, funnelId: string, permission: Permission) {
  if (!isUuid(funnelId)) throw new NotFoundError();
  const [funnel] = await db.select().from(funnels).where(eq(funnels.id, funnelId));
  if (!funnel) throw new NotFoundError();
  await requireMembership(db, userId, funnel.workspaceId, permission);
  return funnel;
}

export async function getFunnel(db: Db, userId: string, funnelId: string) {
  return requireFunnel(db, userId, funnelId, "read");
}

export async function renameFunnel(
  db: Db,
  userId: string,
  funnelId: string,
  input: { name: unknown },
) {
  const funnel = await requireFunnel(db, userId, funnelId, "edit");
  const name = parseName(input);
  const [updated] = await db
    .update(funnels)
    .set({ name, updatedAt: sql`now()` })
    .where(eq(funnels.id, funnel.id))
    .returning();
  return updated;
}

export async function deleteFunnel(db: Db, userId: string, funnelId: string) {
  const funnel = await requireFunnel(db, userId, funnelId, "delete");
  await db.delete(funnels).where(eq(funnels.id, funnel.id));
  return funnel;
}

export async function updateFunnelBrief(db: Db, userId: string, funnelId: string, input: unknown) {
  const funnel = await requireFunnel(db, userId, funnelId, "edit");
  const parsed = briefSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  }
  const [updated] = await db
    .update(funnels)
    .set({ brief: parsed.data, updatedAt: sql`now()` })
    .where(eq(funnels.id, funnel.id))
    .returning();
  return updated;
}
