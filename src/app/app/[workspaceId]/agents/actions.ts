"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { createMcpToken, revokeMcpToken } from "@/server/mcp-tokens";

export type TokenState = ActionState & { token?: string };

export async function createTokenAction(workspaceId: string, _prev: TokenState, form: FormData): Promise<TokenState> {
  const user = await requireUser();
  const values = { name: String(form.get("name") ?? ""), access: String(form.get("access") ?? "write") };
  try {
    const { token } = await createMcpToken(getDb(), user.id, workspaceId, values);
    revalidatePath(`/app/${workspaceId}/agents`);
    // Returned once to this response only; the database keeps a hash.
    return { ok: true, token };
  } catch (e) {
    return toActionState(e, values);
  }
}

export async function revokeTokenAction(workspaceId: string, tokenId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await revokeMcpToken(getDb(), user.id, tokenId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(`/app/${workspaceId}/agents`);
  return { ok: true };
}
