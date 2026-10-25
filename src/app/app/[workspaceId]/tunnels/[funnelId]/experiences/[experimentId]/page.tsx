import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { count, money, percent } from "@/lib/format";
import { EXPERIMENT_REVIEW, getExperimentResults, GOAL_LABELS, MAX_ARMS, STATUS_LABELS } from "@/server/analytics/experiments";
import { NotFoundError } from "@/server/errors";
import { listPages } from "@/server/pages";
import { livePublicationOf } from "@/server/publishing";
import { can } from "@/server/workspaces";
import { loadFunnel } from "../../funnel";
import { AddArmForm, SplitForm, StartForm, StopButton, WinnerForm } from "../experiment-forms";

export const metadata: Metadata = { title: "Test A/B · Maketia" };

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const points = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pValue = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
// A difference of two rates is in percentage points, not percent.
const signed = (d: number) => `${d > 0 ? "+" : d < 0 ? "−" : ""}${points.format(Math.abs(d) * 100)} pts`;

export default async function ExperimentPage({ params }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]/experiences/[experimentId]">) {
  const { workspaceId, funnelId, experimentId } = await params;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const db = getDb();
  let results: Awaited<ReturnType<typeof getExperimentResults>>;
  try {
    results = await getExperimentResults(db, user.id, experimentId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const exp = results.experiment;
  if (exp.funnelId !== funnel.id) notFound();

  const pageList = await listPages(db, { userId: user.id }, funnel.id);
  const group = pageList.filter((p) => p.variantGroupId === exp.variantGroupId);
  const nameOf = (id: string) => group.find((p) => p.id === id)?.name ?? "Page supprimée";
  const lives = await Promise.all(group.map((p) => livePublicationOf(db, user.id, p.id)));
  const groupLive = lives.some(Boolean);

  const base = `/app/${workspace.id}/tunnels/${funnel.id}`;
  const canEdit = can(workspace.role, "edit");
  const active = results.arms.filter((a) => a.active);
  const candidates = group
    .filter((p) => !results.arms.some((a) => a.pageId === p.id))
    .map((p) => ({ id: p.id, label: p.variantLabel, name: p.name }));
  const armChoices = results.arms.filter((a) => a.version !== null).map((a) => ({ id: a.pageId, label: a.label, name: nameOf(a.pageId) }));
  const showRevenue = results.currency !== null;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`${base}/experiences`} className="w-fit text-sm text-muted underline-offset-4 hover:underline">← Tests A/B</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{exp.name}</h1>
        <p className="text-sm text-muted">
          {STATUS_LABELS[exp.status]} · objectif : {GOAL_LABELS[exp.goal]}
          {exp.path !== null ? ` · adresse /${exp.path}` : ""}
          {exp.startedAt ? ` · démarrée le ${date.format(exp.startedAt)} (UTC)` : ""}
          {exp.stoppedAt ? ` · arrêtée le ${date.format(exp.stoppedAt)} (UTC)` : ""}
        </p>
        {exp.winnerPageId && (
          <p className="text-sm"><span className="font-medium text-success">Gagnant publié :</span> {nameOf(exp.winnerPageId)}</p>
        )}
      </div>

      {exp.status !== "draft" && (
        <section aria-labelledby="results-title" className="flex flex-col gap-3">
          <h2 id="results-title" className="text-lg font-semibold">Résultats</h2>
          <p role="note" className={`rounded-card px-4 py-3 text-sm ${results.verdict.kind === "difference" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
            {results.verdict.message}
          </p>
          <DataTable
            head={["Variante", "Visiteurs", "Conversions", "Taux", "Intervalle 95 %", "Écart vs A", "p", ...(showRevenue ? ["CA / visiteur"] : [])]}
            rows={results.arms.map((a) => [
              <span key="l"><span className="font-mono text-xs">{a.label}</span> {nameOf(a.pageId)}{a.active ? "" : " (retirée)"}</span>,
              count(a.visitors),
              count(a.conversions),
              a.visitors ? percent(a.rate) : "—",
              a.visitors ? `${percent(a.interval[0])} – ${percent(a.interval[1])}` : "—",
              a.vsControl ? signed(a.vsControl.difference) : "référence",
              a.vsControl ? pValue.format(a.vsControl.pValue) : "—",
              ...(showRevenue ? [a.visitors ? money(a.revenuePerVisitor, results.currency!) : "—"] : []),
            ])}
          />
          {!results.revenueComparable && <p className="text-xs text-muted">Paiements en plusieurs devises : le chiffre d’affaires par visiteur n’est pas comparé.</p>}
          <p className="text-xs text-muted">{results.method}</p>
        </section>
      )}

      <section aria-labelledby="split-title" className="flex flex-col gap-3">
        <h2 id="split-title" className="text-lg font-semibold">Répartition du trafic</h2>
        <DataTable
          head={["Variante", "Poids", "Part prévue", "Visiteurs assignés", "Part réelle"]}
          rows={results.arms.map((a) => [
            <span key="l"><span className="font-mono text-xs">{a.label}</span> {nameOf(a.pageId)}</span>,
            a.active ? count(a.weight) : "retirée",
            a.active ? percent(a.plannedShare) : "—",
            count(a.assigned),
            exp.status === "draft" ? "—" : percent(a.actualShare),
          ])}
        />
        {canEdit && exp.status !== "stopped" && (
          <SplitForm funnelId={funnel.id} experimentId={exp.id} arms={active.map((a) => ({ pageId: a.pageId, label: a.label, weight: a.weight }))} />
        )}
      </section>

      {canEdit && (
        <div className="grid gap-4 lg:grid-cols-2">
          {exp.status === "draft" && (
            <Panel title="Démarrer">
              <p className="text-sm text-muted">
                Les visiteurs de l’adresse où la page est en ligne seront répartis entre les variantes, dans la version actuelle de chacune (figée au démarrage).
              </p>
              <StartForm funnelId={funnel.id} experimentId={exp.id} review={EXPERIMENT_REVIEW}
                blockedReason={groupLive ? null : "Publie d’abord une des variantes : le test se déroule à son adresse."} />
            </Panel>
          )}
          {exp.status !== "stopped" && candidates.length > 0 && active.length < MAX_ARMS && (
            <Panel title="Ajouter une variante">
              <AddArmForm funnelId={funnel.id} experimentId={exp.id} candidates={candidates} running={exp.status === "running"} review={EXPERIMENT_REVIEW} />
            </Panel>
          )}
          {exp.status !== "stopped" && active.length >= MAX_ARMS && (
            <Panel title="Ajouter une variante">
              <p className="text-sm text-muted">Limite atteinte : {MAX_ARMS} variantes actives maximum par expérience.</p>
            </Panel>
          )}
          {exp.status !== "draft" && !exp.winnerPageId && (
            <Panel title="Choisir le gagnant">
              <p className="text-sm text-muted">La variante choisie est publiée à l’adresse du test (dans sa version testée) et l’expérience se termine.</p>
              <WinnerForm funnelId={funnel.id} experimentId={exp.id} arms={armChoices} review={EXPERIMENT_REVIEW}
                warning={results.verdict.kind === "insufficient" ? "Données insuffisantes : un choix maintenant repose sur le hasard autant que sur la page." : null} />
            </Panel>
          )}
          {exp.status === "running" && (
            <Panel title="Arrêter">
              <p className="text-sm text-muted">Les visiteurs reverront la page publiée à cette adresse. Aucun gagnant n’est publié.</p>
              <div><StopButton funnelId={funnel.id} experimentId={exp.id} /></div>
            </Panel>
          )}
        </div>
      )}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}
