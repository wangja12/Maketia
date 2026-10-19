"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { choosePlan } from "@/server/billing/plans";

export async function choosePlanAction(workspaceId: string, planId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await choosePlan(getDb(), user.id, workspaceId, planId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/${workspaceId}/abonnement`);
  return { ok: true };
}
