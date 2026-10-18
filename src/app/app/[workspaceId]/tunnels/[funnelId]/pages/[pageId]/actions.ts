"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { getFunnel } from "@/server/funnels";
import { createVariant, deletePage, duplicatePage, getPage, restoreVersion } from "@/server/pages";

async function pagePath(userId: string, funnelId: string, pageId?: string) {
  const funnel = await getFunnel(getDb(), userId, funnelId);
  const base = `/app/${funnel.workspaceId}/tunnels/${funnel.id}`;
  return pageId ? `${base}/pages/${pageId}` : base;
}

export async function createVariantAction(pageId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  let target: string;
  try {
    const variant = await createVariant(getDb(), { userId: user.id }, pageId);
    target = await pagePath(user.id, variant.funnelId, variant.id);
  } catch (e) {
    return toActionState(e);
  }
  redirect(target);
}

export async function duplicatePageAction(pageId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  let target: string;
  try {
    const copy = await duplicatePage(getDb(), { userId: user.id }, pageId);
    target = await pagePath(user.id, copy.funnelId, copy.id);
  } catch (e) {
    return toActionState(e);
  }
  redirect(target);
}

export async function restoreVersionAction(pageId: string, baseVersion: number, version: number, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  let target: string;
  try {
    const page = await restoreVersion(getDb(), { userId: user.id }, pageId, baseVersion, version);
    target = await pagePath(user.id, page.funnelId, page.id);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(target);
  redirect(target);
}

export async function deletePageAction(pageId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  let target: string;
  try {
    const db = getDb();
    const { page } = await getPage(db, { userId: user.id }, pageId);
    target = await pagePath(user.id, page.funnelId);
    await deletePage(db, { userId: user.id }, pageId);
  } catch (e) {
    return toActionState(e);
  }
  redirect(target);
}
