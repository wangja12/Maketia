import { and, desc, eq, gt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { agentRequests } from "@/db/schema";
import { getExperimentResults, selectWinner, stopExperiment } from "./analytics/experiments";
import { NotFoundError, ValidationError } from "./errors";
import { getFunnel } from "./funnels";
import type { McpContext } from "./mcp-tokens";
import { getPage, validatePage } from "./pages";
import { checkoutProblems } from "./payments/checks";
import { livePublicationOf, publishPage, unpublishPage } from "./publishing";
import { isUuid, requireMembership } from "./workspaces";

/*
 * Agent → human confirmation for sensitive actions. An agent may only ASK: the request is
 * checked up front (so the person is not asked to approve something that cannot work), then
 * waits. A member who can edit approves it in the app (ticking the review list where the
 * action publishes), and it runs with that member's rights through the normal services.
 */

export const REQUEST_KINDS = {
  publish_page: "Publier une page",
  unpublish_page: "Dépublier une page",
  stop_ab_experiment: "Arrêter un test A/B",
  select_experiment_winner: "Choisir le gagnant d’un test A/B",
} as const;
export type RequestKind = keyof typeof REQUEST_KINDS;

/** Kinds that expose a page publicly: approval requires the review checklist. */
export const NEEDS_REVIEW: RequestKind[] = ["publish_page", "select_experiment_winner"];

const TTL_DAYS = 7;

type Input =
  | { kind: "publish_page"; pageId: string; path: string; version?: number }
  | { kind: "unpublish_page"; pageId: string }
  | { kind: "stop_ab_experiment"; experimentId: string }
  | { kind: "select_experiment_winner"; experimentId: string; pageId: string };

/** Pre-checks with the agent's user rights, then records a pending request (or returns the same pending one). */
export async function createAgentRequest(db: Db, ctx: McpContext, input: Input, reason?: string) {
  const actor = { userId: ctx.userId, mcpTokenId: ctx.tokenId };
  let resourceId: string;
  let params: Record<string, unknown>;
  let workspaceId: string;

  if (input.kind === "publish_page" || input.kind === "unpublish_page") {
    const { page, funnel, version } = await getPage(db, actor, input.pageId, input.kind === "publish_page" ? input.version : undefined);
    workspaceId = funnel.workspaceId;
    resourceId = page.id;
    if (input.kind === "publish_page") {
      const report = await validatePage(db, actor, page.id, version.version);
      const problems = [...report.errors.map((e) => e.message), ...(await checkoutProblems(db, funnel.workspaceId, version.content))];
      if (problems.length) throw new ValidationError(`Publication impossible en l’état : ${problems.join(" ")}`);
      params = { path: input.path, version: version.version, pageName: page.name, variant: page.variantLabel };
    } else {
      if (!(await livePublicationOf(db, ctx.userId, page.id))) throw new ValidationError("Cette page n’est pas en ligne.");
      params = { pageName: page.name, variant: page.variantLabel };
    }
  } else {
    const { experiment, arms } = await getExperimentResults(db, ctx.userId, input.experimentId);
    workspaceId = (await getFunnel(db, ctx.userId, experiment.funnelId)).workspaceId;
    resourceId = experiment.id;
    if (input.kind === "stop_ab_experiment") {
      if (experiment.status !== "running") throw new ValidationError("Cette expérience ne tourne pas.");
      params = { experimentName: experiment.name };
    } else {
      if (experiment.status === "draft") throw new ValidationError("L’expérience n’a pas démarré.");
      const arm = arms.find((a) => a.pageId === input.pageId);
      if (!arm || arm.version === null) throw new ValidationError("Cette page n’est pas une variante de l’expérience.");
      params = { experimentName: experiment.name, pageId: arm.pageId, variant: arm.label };
    }
  }
  if (workspaceId !== ctx.workspaceId) throw new NotFoundError();

  const [existing] = await db
    .select()
    .from(agentRequests)
    .where(and(eq(agentRequests.workspaceId, workspaceId), eq(agentRequests.kind, input.kind), eq(agentRequests.resourceId, resourceId), eq(agentRequests.status, "pending"), gt(agentRequests.expiresAt, sql`now()`)));
  if (existing) return { request: existing, duplicate: true };
  const [request] = await db
    .insert(agentRequests)
    .values({
      workspaceId,
      tokenId: ctx.tokenId,
      requestedBy: ctx.userId,
      kind: input.kind,
      resourceId,
      params,
      reason: reason?.slice(0, 500) ?? null,
      expiresAt: sql`now() + make_interval(days => ${TTL_DAYS})`,
    })
    .returning();
  return { request, duplicate: false };
}

export async function listAgentRequests(db: Db, userId: string, workspaceId: string, onlyPending = false) {
  await requireMembership(db, userId, workspaceId, "read");
  // The full list (Agents page) also records expirations; the pending count stays read-only.
  if (!onlyPending) {
    await db
      .update(agentRequests)
      .set({ status: "expired" })
      .where(and(eq(agentRequests.workspaceId, workspaceId), eq(agentRequests.status, "pending"), sql`${agentRequests.expiresAt} <= now()`));
  }
  return db
    .select()
    .from(agentRequests)
    .where(and(eq(agentRequests.workspaceId, workspaceId), onlyPending ? and(eq(agentRequests.status, "pending"), gt(agentRequests.expiresAt, sql`now()`)) : undefined))
    .orderBy(desc(agentRequests.createdAt))
    .limit(50);
}

export async function getAgentRequest(db: Db, userId: string, requestId: string) {
  if (!isUuid(requestId)) throw new NotFoundError();
  const [request] = await db.select().from(agentRequests).where(eq(agentRequests.id, requestId));
  if (!request) throw new NotFoundError();
  await requireMembership(db, userId, request.workspaceId, "read");
  return request;
}

/**
 * A person approves or rejects. Approval is claimed atomically (pending → approved), so a
 * double click or two people cannot run it twice; a failure is recorded, not hidden.
 */
export async function decideAgentRequest(db: Db, userId: string, requestId: string, input: { approve: boolean; reviewConfirmed?: unknown; note?: string }) {
  const request = await getAgentRequest(db, userId, requestId);
  await requireMembership(db, userId, request.workspaceId, "edit");
  if (request.status !== "pending") throw new ValidationError("Cette demande a déjà été traitée.");
  if (request.expiresAt.getTime() <= Date.now()) {
    await db.update(agentRequests).set({ status: "expired" }).where(eq(agentRequests.id, request.id));
    throw new ValidationError("Cette demande a expiré.");
  }
  const kind = request.kind as RequestKind;
  if (input.approve && NEEDS_REVIEW.includes(kind) && input.reviewConfirmed !== true) {
    throw new ValidationError("Cochez chaque point de la revue avant d’approuver une publication.");
  }
  const [claimed] = await db
    .update(agentRequests)
    .set({ status: input.approve ? "approved" : "rejected", decidedBy: userId, decidedAt: sql`now()`, result: input.note?.slice(0, 300) ?? null })
    .where(and(eq(agentRequests.id, request.id), eq(agentRequests.status, "pending")))
    .returning();
  if (!claimed) throw new ValidationError("Cette demande a déjà été traitée.");
  if (!input.approve) return claimed;

  try {
    const p = request.params;
    let result: string;
    if (kind === "publish_page") {
      const row = await publishPage(db, userId, request.resourceId, { path: p.path, version: p.version as number, reviewConfirmed: true });
      result = `Publiée : version ${row.version} sur /${row.path}`;
    } else if (kind === "unpublish_page") {
      await unpublishPage(db, userId, request.resourceId);
      result = "Dépubliée";
    } else if (kind === "stop_ab_experiment") {
      await stopExperiment(db, userId, request.resourceId);
      result = "Expérience arrêtée";
    } else {
      await selectWinner(db, userId, request.resourceId, { pageId: String(p.pageId), reviewConfirmed: true });
      result = `Variante ${String(p.variant)} publiée comme gagnante`;
    }
    const [done] = await db.update(agentRequests).set({ result }).where(eq(agentRequests.id, request.id)).returning();
    return done;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erreur";
    await db.update(agentRequests).set({ status: "failed", result: message.slice(0, 300) }).where(eq(agentRequests.id, request.id));
    throw e;
  }
}
