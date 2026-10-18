import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { NotFoundError } from "@/server/errors";
import { getFunnel } from "@/server/funnels";
import { loadWorkspace } from "../../workspace";

/** Funnel of this workspace for the signed-in user; 404 otherwise (including a funnel of another workspace). */
export const loadFunnel = cache(async (workspaceId: string, funnelId: string) => {
  const { user, workspace } = await loadWorkspace(workspaceId);
  try {
    const funnel = await getFunnel(getDb(), user.id, funnelId);
    if (funnel.workspaceId !== workspace.id) notFound();
    return { user, workspace, funnel };
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});
