import { and, asc, count, countDistinct, desc, eq, inArray, isNull, sql, sum } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { events, experimentArms, experimentAssignments, experiments, pages, pageVersions, publications, type Experiment } from "@/db/schema";
import { isUniqueViolation, NotFoundError, ValidationError } from "../errors";
import { requireFunnel } from "../funnels";
import { MANUAL_REVIEW, validatePageContent } from "../page-validation";
import { checkoutProblems } from "../payments/checks";
import { publishPage } from "../publishing";
import { fieldErrorsOf } from "../validation";
import { isUuid } from "../workspaces";
import { analyse } from "./stats";

/*
 * A/B experiments: 2 to 4 variants of a page group, on the path where the group is live.
 * Starting exposes every arm to the public, so it follows the publication rules (checks +
 * human review). The goal is fixed before the start. Stopping returns the path to the live
 * publication; choosing a winner publishes it through the normal pipeline. Nothing is deleted.
 */

export const MIN_ARMS = 2;
export const MAX_ARMS = 4;

export const GOAL_LABELS = {
  order_paid: "Paiement confirmé",
  checkout_submitted: "Commande commencée",
  cta_click: "Clic sur un appel à l’action",
} as const;

export const STATUS_LABELS = { draft: "Brouillon", running: "En cours", stopped: "Terminée" } as const;

/** What a person confirms before variants go public (start, added variant, winner). */
export const EXPERIMENT_REVIEW = [
  ...MANUAL_REVIEW,
  "J’ai relu chaque variante concernée : chaque visiteur peut voir n’importe laquelle.",
];

const armsSchema = z
  .array(z.object({ pageId: z.string(), weight: z.coerce.number().int().min(1, "Poids : 1 à 100").max(100, "Poids : 1 à 100") }))
  .min(MIN_ARMS, `Choisissez au moins ${MIN_ARMS} variantes.`)
  .max(MAX_ARMS, `${MAX_ARMS} variantes maximum par expérience.`)
  .refine((a) => new Set(a.map((x) => x.pageId)).size === a.length, "Une variante ne peut figurer qu’une fois.");

const createSchema = z.object({
  name: z.string().trim().min(1, "Nommez l’expérience").max(80),
  goal: z.enum(["order_paid", "checkout_submitted", "cta_click"]),
  arms: armsSchema,
});

async function requireExperiment(db: Db, userId: string, experimentId: string, permission: "read" | "edit" = "read") {
  if (!isUuid(experimentId)) throw new NotFoundError("Expérience introuvable");
  const [exp] = await db.select().from(experiments).where(eq(experiments.id, experimentId));
  if (!exp) throw new NotFoundError("Expérience introuvable");
  const funnel = await requireFunnel(db, userId, exp.funnelId, permission);
  return { exp, funnel };
}

/** All arm pages must exist and belong to the same variant group of the funnel. */
async function groupPages(db: Db, funnelId: string, pageIds: string[]) {
  if (!pageIds.every(isUuid)) throw new ValidationError("Variante introuvable.");
  const rows = await db.select().from(pages).where(and(eq(pages.funnelId, funnelId), inArray(pages.id, pageIds)));
  if (rows.length !== pageIds.length) throw new ValidationError("Variante introuvable dans ce tunnel.");
  const groups = new Set(rows.map((r) => r.variantGroupId));
  if (groups.size !== 1) throw new ValidationError("Toutes les variantes doivent être des versions de la même page.");
  return rows;
}

export async function createExperiment(db: Db, userId: string, funnelId: string, input: unknown) {
  const funnel = await requireFunnel(db, userId, funnelId, "edit");
  const raw = input as { arms?: { pageId: string; weight?: number }[] };
  // Equal split by default.
  const withWeights = { ...raw, arms: raw.arms?.map((a) => ({ ...a, weight: a.weight ?? Math.floor(100 / raw.arms!.length) })) };
  const parsed = createSchema.safeParse(withWeights);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message, fieldErrorsOf(parsed.error));
  const rows = await groupPages(db, funnel.id, parsed.data.arms.map((a) => a.pageId));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return db.transaction(async (tx) => {
    const [exp] = await tx
      .insert(experiments)
      .values({ funnelId: funnel.id, variantGroupId: rows[0].variantGroupId, name: parsed.data.name, goal: parsed.data.goal, createdBy: userId })
      .returning();
    await tx.insert(experimentArms).values(
      parsed.data.arms.map((a) => ({ experimentId: exp.id, pageId: a.pageId, variantLabel: byId.get(a.pageId)!.variantLabel, weight: a.weight })),
    );
    return exp;
  });
}

/** Weights can change at any time; existing visitors keep their arm (sticky assignment). */
export async function updateTrafficSplit(db: Db, userId: string, experimentId: string, weights: Record<string, unknown>) {
  const { exp } = await requireExperiment(db, userId, experimentId, "edit");
  if (exp.status === "stopped") throw new ValidationError("Expérience arrêtée : la répartition ne peut plus changer.");
  const arms = await db.select().from(experimentArms).where(eq(experimentArms.experimentId, exp.id));
  const parsed = z.record(z.string(), z.coerce.number().int().min(1).max(100)).safeParse(weights);
  if (!parsed.success) throw new ValidationError("Poids : nombres entiers de 1 à 100.");
  for (const id of Object.keys(parsed.data)) if (!arms.some((a) => a.pageId === id)) throw new ValidationError("Variante absente de l’expérience.");
  await db.transaction(async (tx) => {
    for (const [pageId, weight] of Object.entries(parsed.data)) {
      await tx.update(experimentArms).set({ weight }).where(and(eq(experimentArms.experimentId, exp.id), eq(experimentArms.pageId, pageId)));
    }
  });
  return listArms(db, exp.id);
}

async function listArms(db: Db, experimentId: string) {
  return db.select().from(experimentArms).where(eq(experimentArms.experimentId, experimentId)).orderBy(asc(experimentArms.variantLabel));
}

/** Same gate as publishing: no blocking check failure, payable order forms, human review. */
async function assertPublishable(db: Db, workspaceId: string, pageIds: string[]) {
  const problems: string[] = [];
  for (const pageId of pageIds) {
    const [row] = await db
      .select({ kind: pages.kind, label: pages.variantLabel, content: pageVersions.content })
      .from(pages)
      .innerJoin(pageVersions, and(eq(pageVersions.pageId, pages.id), eq(pageVersions.version, pages.currentVersion)))
      .where(eq(pages.id, pageId));
    const report = validatePageContent(row.kind, row.content);
    problems.push(...report.errors.map((e) => `${row.label} : ${e.message}`));
    problems.push(...(await checkoutProblems(db, workspaceId, row.content)).map((p) => `${row.label} : ${p}`));
  }
  if (problems.length) throw new ValidationError(`Démarrage bloqué : ${problems.join(" ")}`);
}

export async function startExperiment(db: Db, userId: string, experimentId: string, input: { reviewConfirmed: unknown }) {
  const { exp, funnel } = await requireExperiment(db, userId, experimentId, "edit");
  if (exp.status !== "draft") throw new ValidationError("Seule une expérience en brouillon peut démarrer.");
  const arms = (await listArms(db, exp.id)).filter((a) => a.active);
  if (arms.length < MIN_ARMS) throw new ValidationError(`Au moins ${MIN_ARMS} variantes actives sont nécessaires.`);

  // The test runs where the page group is already live.
  const groupIds = (await db.select({ id: pages.id }).from(pages).where(eq(pages.variantGroupId, exp.variantGroupId))).map((r) => r.id);
  const [live] = await db
    .select({ path: publications.path })
    .from(publications)
    .where(and(inArray(publications.pageId, groupIds), isNull(publications.unpublishedAt)));
  if (!live) throw new ValidationError("Publiez d’abord une des variantes : le test se déroule à son adresse.");
  await assertPublishable(db, funnel.workspaceId, arms.map((a) => a.pageId));
  if (input.reviewConfirmed !== true) throw new ValidationError("Confirmez la revue humaine de chaque variante avant de démarrer.");

  try {
    return await db.transaction(async (tx) => {
      for (const arm of arms) {
        const [page] = await tx.select({ v: pages.currentVersion }).from(pages).where(eq(pages.id, arm.pageId));
        await tx.update(experimentArms).set({ version: page.v }).where(and(eq(experimentArms.experimentId, exp.id), eq(experimentArms.pageId, arm.pageId)));
      }
      const [started] = await tx
        .update(experiments)
        .set({ status: "running", path: live.path, startedAt: sql`now()` })
        .where(eq(experiments.id, exp.id))
        .returning();
      return started;
    });
  } catch (e) {
    if (isUniqueViolation(e)) throw new ValidationError("Une autre expérience tourne déjà à cette adresse.");
    throw e;
  }
}

/** Adds a variant (max 4 active). On a running test it goes live immediately, so it is checked first. */
export async function addArm(db: Db, userId: string, experimentId: string, input: { pageId: string; weight?: number; reviewConfirmed?: unknown }) {
  const { exp, funnel } = await requireExperiment(db, userId, experimentId, "edit");
  if (exp.status === "stopped") throw new ValidationError("Expérience arrêtée.");
  const arms = await listArms(db, exp.id);
  if (arms.filter((a) => a.active).length >= MAX_ARMS) {
    throw new ValidationError(`Limite atteinte : ${MAX_ARMS} variantes actives maximum par expérience.`);
  }
  if (arms.some((a) => a.pageId === input.pageId)) throw new ValidationError("Cette variante fait déjà partie de l’expérience.");
  const [page] = await groupPages(db, funnel.id, [input.pageId]);
  if (page.variantGroupId !== exp.variantGroupId) throw new ValidationError("Cette page n’est pas une variante de la page testée.");
  if (exp.status === "running") {
    await assertPublishable(db, funnel.workspaceId, [page.id]);
    if (input.reviewConfirmed !== true) throw new ValidationError("Confirmez la revue humaine de la nouvelle variante.");
  }
  await db.insert(experimentArms).values({
    experimentId: exp.id,
    pageId: page.id,
    variantLabel: page.variantLabel,
    weight: input.weight ?? Math.round(arms.reduce((s, a) => s + a.weight, 0) / Math.max(1, arms.length)),
    version: exp.status === "running" ? page.currentVersion : null,
  });
  return listArms(db, exp.id);
}

export async function stopExperiment(db: Db, userId: string, experimentId: string) {
  const { exp } = await requireExperiment(db, userId, experimentId, "edit");
  if (exp.status !== "running") throw new ValidationError("Cette expérience ne tourne pas.");
  const [stopped] = await db.update(experiments).set({ status: "stopped", stoppedAt: sql`now()` }).where(eq(experiments.id, exp.id)).returning();
  return stopped;
}

/** A person picks the winner; it is published at the test's address through the normal pipeline. */
export async function selectWinner(db: Db, userId: string, experimentId: string, input: { pageId: string; reviewConfirmed: unknown }) {
  const { exp } = await requireExperiment(db, userId, experimentId, "edit");
  if (exp.status === "draft") throw new ValidationError("L’expérience n’a pas démarré.");
  const arm = (await listArms(db, exp.id)).find((a) => a.pageId === input.pageId);
  if (!arm || arm.version === null) throw new ValidationError("Variante absente de l’expérience.");
  await publishPage(db, userId, arm.pageId, { path: exp.path ?? "", version: arm.version, reviewConfirmed: input.reviewConfirmed });
  const [updated] = await db
    .update(experiments)
    .set({ winnerPageId: arm.pageId, status: "stopped", stoppedAt: exp.stoppedAt ?? sql`now()` })
    .where(eq(experiments.id, exp.id))
    .returning();
  return updated;
}

export async function listExperiments(db: Db, userId: string, funnelId: string) {
  await requireFunnel(db, userId, funnelId, "read");
  return db.select().from(experiments).where(eq(experiments.funnelId, funnelId)).orderBy(desc(experiments.createdAt));
}

/**
 * Results from measured events only. Visitors = distinct visitors who viewed the arm;
 * conversions = distinct visitors who reached the goal on that arm.
 */
export async function getExperimentResults(db: Db, userId: string, experimentId: string) {
  const { exp } = await requireExperiment(db, userId, experimentId, "read");
  const arms = await listArms(db, exp.id);
  const byArm = async (type: "page_view" | Experiment["goal"]) =>
    db
      .select({ pageId: events.pageId, visitors: countDistinct(events.visitorId), revenue: sum(events.amount) })
      .from(events)
      .where(and(eq(events.experimentId, exp.id), eq(events.type, type)))
      .groupBy(events.pageId);
  const [views, goals, paid, assigned, currencies] = await Promise.all([
    byArm("page_view"),
    byArm(exp.goal),
    byArm("order_paid"),
    db
      .select({ pageId: experimentAssignments.pageId, n: count() })
      .from(experimentAssignments)
      .where(eq(experimentAssignments.experimentId, exp.id))
      .groupBy(experimentAssignments.pageId),
    db
      .selectDistinct({ currency: events.currency })
      .from(events)
      .where(and(eq(events.experimentId, exp.id), eq(events.type, "order_paid"))),
  ]);
  // Amounts in different currencies are never added: revenue is shown only for a single currency.
  const currency = currencies.length === 1 ? currencies[0].currency : null;
  const find = <T extends { pageId: string | null }>(rows: T[], id: string) => rows.find((r) => r.pageId === id);
  const inputs = arms.map((a) => ({
    label: a.variantLabel,
    visitors: Number(find(views, a.pageId)?.visitors ?? 0),
    conversions: Number(find(goals, a.pageId)?.visitors ?? 0),
    revenue: currency ? Number(find(paid, a.pageId)?.revenue ?? 0) : 0,
  }));
  const analysis = analyse(inputs);
  const totalAssigned = assigned.reduce((s, r) => s + Number(r.n), 0);
  const totalWeight = arms.filter((a) => a.active).reduce((s, a) => s + a.weight, 0);
  return {
    experiment: exp,
    arms: arms.map((a, i) => ({
      pageId: a.pageId,
      version: a.version,
      active: a.active,
      plannedShare: a.active && totalWeight ? a.weight / totalWeight : 0,
      weight: a.weight,
      assigned: Number(find(assigned, a.pageId)?.n ?? 0),
      actualShare: totalAssigned ? Number(find(assigned, a.pageId)?.n ?? 0) / totalAssigned : 0,
      ...analysis.arms[i],
    })),
    currency,
    revenueComparable: currencies.length <= 1,
    verdict: analysis.verdict,
    threshold: analysis.threshold,
    method:
      "Taux de conversion = visiteurs ayant atteint l’objectif ÷ visiteurs ayant vu la variante. Intervalle de Wilson à 95 %. Comparaison de chaque variante à la première par un test z bilatéral de deux proportions, seuil 0,05 corrigé de Bonferroni. Aucune conclusion sous 100 visiteurs et 10 conversions par variante. Les visiteurs ayant refusé le suivi (DNT/GPC) ne sont pas comptés.",
  };
}
