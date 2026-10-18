"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { ConflictError, isDomainError } from "@/server/errors";
import { getPage, listVersions, updatePageContent } from "@/server/pages";
import type { PageContent } from "@/server/page-schema";

export type SaveResult =
  | { ok: true; version: number }
  | { ok: false; conflict: true; currentVersion: number }
  | { ok: false; conflict: false; error: string };

/** Appends a version if `baseVersion` is still current; never overwrites a newer one. */
export async function saveContentAction(pageId: string, baseVersion: number, content: unknown): Promise<SaveResult> {
  const user = await requireUser();
  try {
    const page = await updatePageContent(getDb(), { userId: user.id }, pageId, { baseVersion, content, note: "Éditeur visuel" });
    revalidatePath(`/preview/${page.id}`);
    return { ok: true, version: page.currentVersion };
  } catch (e) {
    if (e instanceof ConflictError) return { ok: false, conflict: true, currentVersion: e.currentVersion };
    if (isDomainError(e)) return { ok: false, conflict: false, error: e.message };
    console.error(e);
    return { ok: false, conflict: false, error: "Erreur inattendue : la modification n’a pas été enregistrée." };
  }
}

export type PageHead = { currentVersion: number; author: string; agent: boolean };

/** Cheap poll target: who saved the latest version. */
export async function pageHeadAction(pageId: string): Promise<PageHead | null> {
  const user = await requireUser();
  try {
    const [latest] = await listVersions(getDb(), { userId: user.id }, pageId);
    return {
      currentVersion: latest.version,
      agent: latest.authorKind === "agent",
      author: latest.authorKind === "agent" ? `l’agent « ${latest.agentName ?? "révoqué"} »` : (latest.authorName ?? "un membre"),
    };
  } catch {
    return null;
  }
}

export async function loadVersionAction(pageId: string): Promise<{ version: number; content: PageContent } | null> {
  const user = await requireUser();
  try {
    const { page, version } = await getPage(getDb(), { userId: user.id }, pageId);
    return { version: page.currentVersion, content: version.content };
  } catch {
    return null;
  }
}
