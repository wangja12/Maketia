"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { briefSchema } from "@/server/brief";
import { getFunnel, updateFunnelBrief } from "@/server/funnels";
import { addDomain, removeDomain, verifyDomain } from "@/server/domains";
import { createPage } from "@/server/pages";
import { setSubdomain } from "@/server/publishing";

// Ids come from the client: every action re-reads the session and the services re-check access.

export async function saveBriefAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = Object.fromEntries(Object.keys(briefSchema.shape).map((k) => [k, String(form.get(k) ?? "")]));
  try {
    const funnel = await updateFunnelBrief(getDb(), user.id, funnelId, values);
    revalidatePath(`/app/${funnel.workspaceId}/tunnels/${funnel.id}`);
  } catch (e) {
    return toActionState(e, values);
  }
  return { ok: true, values };
}

export async function createPageAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { name: String(form.get("name") ?? ""), kind: String(form.get("kind") ?? "") };
  let target: string;
  try {
    const db = getDb();
    const page = await createPage(db, { userId: user.id }, funnelId, values);
    const funnel = await getFunnel(db, user.id, funnelId);
    target = `/app/${funnel.workspaceId}/tunnels/${funnelId}/pages/${page.id}`;
  } catch (e) {
    return toActionState(e, values);
  }
  redirect(target);
}

export async function setSubdomainAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { subdomain: String(form.get("subdomain") ?? "") };
  try {
    const funnel = await setSubdomain(getDb(), user.id, funnelId, values.subdomain);
    revalidatePath(`/app/${funnel.workspaceId}/tunnels/${funnel.id}`, "layout");
  } catch (e) {
    return toActionState(e, values);
  }
  return { ok: true };
}

export async function addDomainAction(funnelId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { hostname: String(form.get("hostname") ?? "") };
  try {
    const domain = await addDomain(getDb(), user.id, funnelId, values.hostname);
    revalidatePath(`/app/${domain.workspaceId}/tunnels/${funnelId}`);
  } catch (e) {
    return toActionState(e, values);
  }
  return { ok: true };
}

export async function verifyDomainAction(domainId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    const domain = await verifyDomain(getDb(), user.id, domainId);
    revalidatePath(`/app/${domain.workspaceId}/tunnels/${domain.funnelId}`);
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true };
}

export async function removeDomainAction(domainId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    const domain = await removeDomain(getDb(), user.id, domainId);
    revalidatePath(`/app/${domain.workspaceId}/tunnels/${domain.funnelId}`);
  } catch (e) {
    return toActionState(e);
  }
  return { ok: true };
}
