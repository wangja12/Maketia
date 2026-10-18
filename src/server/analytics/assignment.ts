import { randomInt } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { experimentArms, experimentAssignments, experiments, pages } from "@/db/schema";

/*
 * Which arm a visitor sees. Assignment is sticky (stored per experiment and visitor), so a
 * returning visitor keeps their variant even if weights change later; new visitors follow the
 * current weights. Visitors without an id (Do Not Track / GPC) get a random arm each time and
 * are never stored or counted.
 */

export type ServedArm = { experimentId: string; pageId: string; version: number; variantLabel: string };

export async function runningExperimentAt(db: Db, funnelId: string, path: string) {
  const [exp] = await db
    .select()
    .from(experiments)
    .where(and(eq(experiments.funnelId, funnelId), eq(experiments.path, path), eq(experiments.status, "running")));
  return exp ?? null;
}

export function pickWeighted<T extends { weight: number }>(arms: T[], roll = randomInt): T {
  const total = arms.reduce((s, a) => s + a.weight, 0);
  let r = roll(total);
  for (const a of arms) {
    if (r < a.weight) return a;
    r -= a.weight;
  }
  return arms[arms.length - 1];
}

export async function assignArm(db: Db, experimentId: string, visitorId: string | null): Promise<ServedArm | null> {
  const arms = await db
    .select({ pageId: experimentArms.pageId, version: experimentArms.version, weight: experimentArms.weight, variantLabel: experimentArms.variantLabel, active: experimentArms.active })
    .from(experimentArms)
    .innerJoin(pages, eq(pages.id, experimentArms.pageId))
    .where(eq(experimentArms.experimentId, experimentId));
  const active = arms.filter((a) => a.active && a.version !== null);
  if (active.length === 0) return null;
  const serve = (a: (typeof active)[number]) => ({ experimentId, pageId: a.pageId, version: a.version!, variantLabel: a.variantLabel });

  if (!visitorId) return serve(pickWeighted(active));
  const [existing] = await db
    .select({ pageId: experimentAssignments.pageId })
    .from(experimentAssignments)
    .where(and(eq(experimentAssignments.experimentId, experimentId), eq(experimentAssignments.visitorId, visitorId)));
  const kept = existing && active.find((a) => a.pageId === existing.pageId);
  if (kept) return serve(kept);

  const chosen = pickWeighted(active);
  if (existing) {
    // Their arm was deactivated: move them to a live one.
    await db
      .update(experimentAssignments)
      .set({ pageId: chosen.pageId })
      .where(and(eq(experimentAssignments.experimentId, experimentId), eq(experimentAssignments.visitorId, visitorId)));
    return serve(chosen);
  }
  // New visitor: draw by weight; on a concurrent first request, the first writer wins.
  const [stored] = await db
    .insert(experimentAssignments)
    .values({ experimentId, visitorId, pageId: chosen.pageId })
    .onConflictDoUpdate({ target: [experimentAssignments.experimentId, experimentAssignments.visitorId], set: { visitorId } })
    .returning({ pageId: experimentAssignments.pageId });
  return serve(active.find((a) => a.pageId === stored.pageId) ?? chosen);
}
