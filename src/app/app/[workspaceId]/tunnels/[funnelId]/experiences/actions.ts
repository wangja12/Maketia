"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { addArm, createExperiment, EXPERIMENT_REVIEW, selectWinner, startExperiment, stopExperiment, updateTrafficSplit } from "@/server/analytics/experiments";
import { getFunnel } from "@/server/funnels";

/*
 * Starting, adding a variant to a running test and choosing a winner expose pages to the
 * public: each needs every review item ticked. The server checks again.
 */

async function basePath(userId: string, funnelId: string) {
  const funnel = await getFunnel(getDb(), userId, funnelId);
  return `/app/${funnel.workspaceId}/tunnels/${funnel.id}`;
}

function reviewed(form: FormData) {
  return form.getAll("review").length === EXPERIMENT_REVIEW.length;
}

/** weight_<pageId> fields → { pageId: weight } */
function weightsOf(form: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (k.startsWith("weight_")) out[k.slice(7)] = String(v);
  return out;
}

export async function createExperimentAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { name: String(form.get("name") ?? ""), goal: String(form.get("goal") ?? "") };
  const weights = weightsOf(form);
  const arms = form.getAll("arm").map((id) => ({ pageId: String(id), weight: weights[String(id)] ? Number(weights[String(id)]) : undefined }));
  let target: string;
  try {
    const exp = await createExperiment(getDb(), user.id, funnelId, { ...values, arms });
    target = `${await basePath(user.id, funnelId)}/experiences/${exp.id}`;
  } catch (e) {
    return toActionState(e, values);
  }
  redirect(target);
}

async function run(funnelId: string, experimentId: string, fn: (userId: string) => Promise<unknown>): Promise<ActionState> {
  const user = await requireUser();
  try {
    await fn(user.id);
    const base = await basePath(user.id, funnelId);
    revalidatePath(`${base}/experiences/${experimentId}`);
    revalidatePath(`${base}/statistiques`);
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true };
}

export async function updateSplitAction(funnelId: string, experimentId: string, _prev: ActionState, form: FormData) {
  return run(funnelId, experimentId, (u) => updateTrafficSplit(getDb(), u, experimentId, weightsOf(form)));
}

export async function startExperimentAction(funnelId: string, experimentId: string, _prev: ActionState, form: FormData) {
  return run(funnelId, experimentId, (u) => startExperiment(getDb(), u, experimentId, { reviewConfirmed: reviewed(form) }));
}

export async function addArmAction(funnelId: string, experimentId: string, _prev: ActionState, form: FormData) {
  return run(funnelId, experimentId, (u) =>
    addArm(getDb(), u, experimentId, { pageId: String(form.get("pageId") ?? ""), reviewConfirmed: reviewed(form) }),
  );
}

export async function stopExperimentAction(funnelId: string, experimentId: string, _prev: ActionState) {
  return run(funnelId, experimentId, (u) => stopExperiment(getDb(), u, experimentId));
}

export async function selectWinnerAction(funnelId: string, experimentId: string, _prev: ActionState, form: FormData) {
  return run(funnelId, experimentId, (u) =>
    selectWinner(getDb(), u, experimentId, { pageId: String(form.get("pageId") ?? ""), reviewConfirmed: reviewed(form) }),
  );
}
