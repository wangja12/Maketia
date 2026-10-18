"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { createFunnel, deleteFunnel, renameFunnel } from "@/server/funnels";

// Each action re-reads the session and lets the service check membership:
// the workspace and funnel ids come from the client and are not trusted.

export async function createFunnelAction(workspaceId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "");
  try {
    await createFunnel(getDb(), user.id, workspaceId, { name });
  } catch (e) {
    return toActionState(e, { name });
  }
  revalidatePath(`/app/${workspaceId}`);
  return { ok: true };
}

export async function renameFunnelAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "");
  try {
    const funnel = await renameFunnel(getDb(), user.id, funnelId, { name });
    revalidatePath(`/app/${funnel.workspaceId}`);
  } catch (e) {
    return toActionState(e, { name });
  }
  return { ok: true };
}

export async function deleteFunnelAction(funnelId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    const funnel = await deleteFunnel(getDb(), user.id, funnelId);
    revalidatePath(`/app/${funnel.workspaceId}`);
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true };
}
