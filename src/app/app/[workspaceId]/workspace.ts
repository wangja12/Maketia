import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { NotFoundError } from "@/server/errors";
import { requireMembership } from "@/server/workspaces";

/** Signed-in user plus their membership in this workspace; 404 for anyone else. */
export const loadWorkspace = cache(async (workspaceId: string) => {
  const user = await requireUser();
  try {
    const workspace = await requireMembership(getDb(), user.id, workspaceId);
    return { user, workspace };
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
});
