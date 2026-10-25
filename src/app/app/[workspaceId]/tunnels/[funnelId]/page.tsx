import type { Metadata } from "next";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/status-badge";
import { getDb } from "@/db";
import { listMcpTokens } from "@/server/mcp-tokens";
import { listPages } from "@/server/pages";
import { PAGE_KIND_LABELS } from "@/server/page-templates";
import { can } from "@/server/workspaces";
import { BriefForm } from "./brief-form";
import { CreatePageForm } from "./create-page-form";
import { loadFunnel } from "./funnel";
import { SiteSection } from "./site-section";
import { listDomains } from "@/server/domains";
import { listPublications } from "@/server/publishing";

export const metadata: Metadata = { title: "Offre · Maketia" };

const ACTIVE_WINDOW_MS = 15 * 60 * 1000;
const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

export default async function FunnelPage({ params }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]">) {
  const { workspaceId, funnelId } = await params;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const db = getDb();
  const [pageList, tokens, history, domainList] = await Promise.all([
    listPages(db, { userId: user.id }, funnel.id),
    listMcpTokens(db, user.id, workspace.id),
    listPublications(db, user.id, funnel.id),
    listDomains(db, user.id, funnel.id),
  ]);
  const canEdit = can(workspace.role, "edit");

  // Variants share a group; show one row per group with its A–D letters.
  const groups = new Map<string, typeof pageList>();
  for (const p of pageList) groups.set(p.variantGroupId, [...(groups.get(p.variantGroupId) ?? []), p]);

  const lastAgent = tokens
    .filter((t) => !t.revokedAt && t.lastUsedAt)
    .sort((a, b) => b.lastUsedAt!.getTime() - a.lastUsedAt!.getTime())[0];
  // Server render: compares against request time, not a client clock.
  // eslint-disable-next-line react-hooks/purity
  const agentActive = lastAgent && Date.now() - lastAgent.lastUsedAt!.getTime() < ACTIVE_WINDOW_MS;
  const base = `/app/${workspace.id}/tunnels/${funnel.id}`;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/app/${workspace.id}`} className="w-fit text-sm text-muted underline-offset-4 hover:underline">
          ← Toutes les offres
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{funnel.name}</h1>
            <StatusBadge status={funnel.status} />
          </div>
          <Link href={`${base}/statistiques`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">Statistiques</Link>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section aria-labelledby="pages-title" className="flex min-w-0 flex-col gap-4">
          <h2 id="pages-title" className="text-lg font-semibold">Pages</h2>
          {groups.size === 0 ? (
            <div className="rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
              <p className="font-medium">Aucune page</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                Crée une page à partir d’un modèle ci-dessous, ou demande à ton agent IA de la préparer.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
              {[...groups.values()].map((group) => {
                const first = group[0];
                return (
                  <li key={first.variantGroupId} className="flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <Link href={`${base}/pages/${first.id}`} className="truncate font-medium underline-offset-4 hover:underline">
                        {first.name}
                      </Link>
                      <span className="text-xs text-muted">
                        {PAGE_KIND_LABELS[first.kind]} · {group.length > 1 ? `${group.length} variantes` : "1 version de page"}
                      </span>
                    </div>
                    {group.length > 1 && (
                      <div className="flex gap-1" aria-label="Variantes">
                        {group.map((p) => (
                          <Link
                            key={p.id}
                            href={`${base}/pages/${p.id}`}
                            aria-label={`Variante ${p.variantLabel}`}
                            className="pressable inline-flex size-8 items-center justify-center rounded-control border border-border-strong font-mono text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-sunken"
                          >
                            {p.variantLabel}
                          </Link>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {canEdit && <CreatePageForm funnelId={funnel.id} />}
          <SiteSection funnel={funnel} history={history} domainList={domainList} canEdit={canEdit} />
        </section>

        <aside aria-labelledby="brief-title" className="flex flex-col gap-4">
          <div>
            <h2 id="brief-title" className="text-lg font-semibold">Fiche de l’offre</h2>
            <p className="mt-1 text-sm text-muted">Ton agent IA la lit avant d’écrire. Rien n’y est inventé : ce que tu ne remplis pas restera à compléter.</p>
          </div>
          <BriefForm funnelId={funnel.id} brief={funnel.brief} readOnly={!canEdit} />
        </aside>
      </div>

      {/* Tools for later: out of the way of a first sale (founder pack, Product lens). */}
      <details className="group rounded-card border border-border bg-surface text-sm shadow-raised">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 font-medium [&::-webkit-details-marker]:hidden">
          Outils avancés : tests A/B et agent IA
          <span aria-hidden="true" className="text-muted transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-90">›</span>
        </summary>
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3">
          <p>
            <Link href={`${base}/experiences`} className="font-medium text-accent underline-offset-4 hover:underline">Tests A/B</Link>
            <span className="text-muted"> · compare deux versions d’une page sur de vrais visiteurs.</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {agentActive ? (
              <p>
                <span className="font-medium">Agent IA actif</span> · « {lastAgent.name} », dernière action le {dateTime.format(lastAgent.lastUsedAt!)} (UTC).
              </p>
            ) : (
              <p className="text-muted">
                <span className="font-medium text-fg">Aucun agent IA actif.</span> Maketia n’intègre pas d’IA : connecte la tienne
                (Claude, ChatGPT…) via MCP pour qu’elle prépare les pages à partir de la fiche. Tout reste faisable à la main.
              </p>
            )}
            <Link href={`/app/${workspace.id}/agents`} className="shrink-0 font-medium text-accent underline-offset-4 hover:underline">
              {agentActive ? "Gérer les connexions" : "Connecter un agent"}
            </Link>
          </div>
        </div>
      </details>
    </div>
  );
}
