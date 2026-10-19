"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { createSegment, deleteContact, deleteSegment, setContactStatus, setContactTags } from "@/server/crm/contacts";

const base = (workspaceId: string) => `/app/${workspaceId}/contacts`;

async function run(paths: string[], fn: (userId: string) => Promise<unknown>, values?: Record<string, string>): Promise<ActionState> {
  const user = await requireUser();
  try {
    await fn(user.id);
  } catch (e) {
    return toActionState(e, values);
  }
  for (const p of paths) revalidatePath(p);
  return { ok: true };
}

export async function setStatusAction(workspaceId: string, contactId: string, _prev: ActionState, form: FormData) {
  return run([base(workspaceId), `${base(workspaceId)}/${contactId}`], (u) => setContactStatus(getDb(), u, contactId, form.get("status")));
}

export async function addTagAction(workspaceId: string, contactId: string, _prev: ActionState, form: FormData) {
  const tag = String(form.get("tag") ?? "");
  return run([base(workspaceId), `${base(workspaceId)}/${contactId}`], (u) => setContactTags(getDb(), u, contactId, { add: tag }), { tag });
}

export async function removeTagAction(workspaceId: string, contactId: string, tag: string, _prev: ActionState) {
  return run([base(workspaceId), `${base(workspaceId)}/${contactId}`], (u) => setContactTags(getDb(), u, contactId, { remove: tag }));
}

export async function deleteContactAction(workspaceId: string, contactId: string, _prev: ActionState): Promise<ActionState> {
  const state = await run([base(workspaceId)], (u) => deleteContact(getDb(), u, contactId));
  if (!state.ok) return state;
  redirect(base(workspaceId));
}

export async function saveSegmentAction(workspaceId: string, filters: Record<string, string>, _prev: ActionState, form: FormData) {
  const name = String(form.get("name") ?? "");
  return run([base(workspaceId)], (u) => createSegment(getDb(), u, workspaceId, { name, filters }), { name });
}

export async function deleteSegmentAction(workspaceId: string, segmentId: string, _prev: ActionState) {
  return run([base(workspaceId)], (u) => deleteSegment(getDb(), u, segmentId));
}
