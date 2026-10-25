import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { GOAL_LABELS, listExperiments, STATUS_LABELS } from "@/server/analytics/experiments";
import { listPages } from "@/server/pages";
import { can } from "@/server/workspaces";
import { loadFunnel } from "../funnel";
import { CreateExperimentForm } from "./experiment-forms";

export const metadata: Metadata = { title: "Tests A/B · Maketia" };

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function ExperimentsPage({ params }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]/experiences">) {
  const { workspaceId, funnelId } = await params;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const db = getDb();
  const [list, pageList] = await Promise.all([listExperiments(db, user.id, funnel.id), listPages(db, { userId: user.id }, funnel.id)]);
  const base = `/app/${workspace.id}/tunnels/${funnel.id}`;
  const canEdit = can(workspace.role, "edit");

  // Only page groups with at least two variants can be tested.
  const groups = new Map<string, typeof pageList>();
  for (const p of pageList) groups.set(p.variantGroupId, [...(groups.get(p.variantGroupId) ?? []), p]);
  const testable = [...groups.values()].filter((g) => g.length >= 2);
  const goals = Object.entries(GOAL_LABELS).map(([value, label]) => ({ value, label }));

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={base} className="w-fit text-sm text-muted underline-offset-4 hover:underline">← {funnel.name}</Link>
        <h1 className="text-2xl font-semibold tracking-tight">Tests A/B</h1>
        <p className="max-w-2xl text-sm text-muted">
          Montre 2 à 4 variantes d’une page à des visiteurs répartis au hasard, puis compare-les sur un objectif fixé à l’avance.
          Tu décides du démarrage, de l’arrêt et du gagnant.
        </p>
      </div>

      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <h2 id="list-title" className="text-lg font-semibold">Expériences</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted">Aucune expérience pour cette offre.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
            {list.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3">
                <Link href={`${base}/experiences/${e.id}`} className="font-medium underline-offset-4 hover:underline">{e.name}</Link>
                <span className="text-xs text-muted">
                  {STATUS_LABELS[e.status]} · objectif : {GOAL_LABELS[e.goal]}
                  {e.startedAt ? ` · démarrée le ${date.format(e.startedAt)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canEdit && (
        <section aria-labelledby="new-title" className="flex flex-col gap-3">
          <h2 id="new-title" className="text-lg font-semibold">Nouvelle expérience</h2>
          {testable.length === 0 ? (
            <p className="text-sm text-muted">Crée d’abord une variante d’une page (bouton « Créer une variante » sur la page) : il en faut au moins deux.</p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {testable.map((g) => (
                <div key={g[0].variantGroupId} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
                  <h3 className="text-sm font-semibold">{g[0].name}</h3>
                  <CreateExperimentForm funnelId={funnel.id} goals={goals} variants={g.map((p) => ({ id: p.id, label: p.variantLabel, name: p.name }))} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
