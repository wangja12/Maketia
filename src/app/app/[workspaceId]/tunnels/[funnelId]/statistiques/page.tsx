import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/db";
import { DataTable as Table } from "@/components/ui/data-table";
import { count, money, percent } from "@/lib/format";
import { getFunnelAnalytics } from "@/server/analytics/reports";
import { trackingEnabled } from "@/server/analytics/tracking";
import { listPages } from "@/server/pages";
import { loadFunnel } from "../funnel";

export const metadata: Metadata = { title: "Statistiques · Maketia" };

const control = "h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised sm:h-8 sm:text-sm";
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/*
 * Figures only, no charts: a handful of totals reads faster as numbers, and the tables
 * carry the breakdowns. Everything comes from measured events; nothing is estimated.
 */
export default async function StatisticsPage({ params, searchParams }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]/statistiques">) {
  const { workspaceId, funnelId } = await params;
  const search = await searchParams;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const db = getDb();
  const [data, pageList] = await Promise.all([
    getFunnelAnalytics(db, user.id, funnel.id, { period: one(search.periode), pageId: one(search.page), variant: one(search.variante), source: one(search.source) }),
    listPages(db, { userId: user.id }, funnel.id),
  ]);
  const base = `/app/${workspace.id}/tunnels/${funnel.id}`;
  const t = data.totals;
  const tiles = [
    { label: "Visiteurs", value: count(t.visitors) },
    { label: "Vues de page", value: count(t.pageViews) },
    { label: "Clics sur un appel à l’action", value: count(t.ctaClicks) },
    { label: "Inscriptions", value: count(t.leads) },
    { label: "Commandes commencées", value: count(t.checkouts) },
    { label: "Paiements confirmés", value: count(t.payments) },
    { label: "Taux de conversion", value: t.conversionRate === null ? "—" : percent(t.conversionRate), hint: "Acheteurs ÷ visiteurs" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={base} className="w-fit text-sm text-muted underline-offset-4 hover:underline">← {funnel.name}</Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Statistiques</h1>
          <Link href={`${base}/experiences`} className="text-sm font-medium text-accent underline-offset-4 hover:underline">Tests A/B →</Link>
        </div>
      </div>

      {!trackingEnabled() && (
        <p role="note" className="rounded-card bg-warning-soft px-4 py-3 text-sm text-warning">
          Mesure désactivée sur ce serveur (ANALYTICS_SECRET absent) : aucune visite ni aucun clic n’est enregistré. Les paiements confirmés restent comptés.
        </p>
      )}

      <form className="flex flex-wrap items-end gap-3" aria-label="Filtres">
        <Filter label="Période" name="periode" value={data.filters.period} options={[["7", "7 jours"], ["30", "30 jours"], ["90", "90 jours"]]} />
        <Filter label="Page" name="page" value={data.filters.pageId ?? ""} options={[["", "Toutes"], ...pageList.map((p) => [p.id, `${p.name} · ${p.variantLabel}`] as [string, string])]} />
        <Filter label="Variante" name="variante" value={data.filters.variant ?? ""} options={[["", "Toutes"], ["A", "A"], ["B", "B"], ["C", "C"], ["D", "D"]]} />
        <Filter label="Source" name="source" value={data.filters.source ?? ""} options={[["", "Toutes"], ...data.bySource.map((s) => [s.source, s.source] as [string, string])]} />
        <button type="submit" className={`${control} pressable font-medium [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-sunken`}>Filtrer</button>
      </form>

      <section aria-label="Totaux" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col gap-1 rounded-card border border-border bg-surface px-4 py-3 shadow-raised">
            <span className="text-xs text-muted">{tile.label}</span>
            <span className="text-xl font-semibold tabular-nums">{tile.value}</span>
            {tile.hint && <span className="text-xs text-muted">{tile.hint}</span>}
          </div>
        ))}
      </section>

      <section aria-labelledby="revenue-title" className="flex flex-col gap-3">
        <h2 id="revenue-title" className="text-lg font-semibold">Chiffre d’affaires confirmé</h2>
        {data.revenue.length === 0 ? (
          <p className="text-sm text-muted">Aucun paiement confirmé sur la période.</p>
        ) : (
          <Table head={["Devise", "Total", "Paiements", "Panier moyen"]}
            rows={data.revenue.map((r) => [r.currency, money(r.total, r.currency), count(r.orders), r.averageOrder === null ? "—" : money(r.averageOrder, r.currency)])} />
        )}
      </section>

      <section aria-labelledby="pages-title" className="flex flex-col gap-3">
        <h2 id="pages-title" className="text-lg font-semibold">Par page et variante</h2>
        {data.byPage.length === 0 ? (
          <p className="text-sm text-muted">Aucune donnée sur la période.</p>
        ) : (
          <Table head={["Page", "Variante", "Visiteurs", "Clics", "Inscriptions", "Commandes", "Paiements"]}
            rows={data.byPage.map((r) => [r.name ?? "Page supprimée", r.variant ?? "—", count(r.visitors), count(r.ctaClicks), count(r.leads), count(r.checkouts), count(r.payments)])} />
        )}
      </section>

      <section aria-labelledby="sources-title" className="flex flex-col gap-3">
        <h2 id="sources-title" className="text-lg font-semibold">Sources des visiteurs</h2>
        {data.bySource.length === 0 ? (
          <p className="text-sm text-muted">Aucune visite mesurée sur la période.</p>
        ) : (
          <Table head={["Source", "Visiteurs"]} rows={data.bySource.map((s) => [s.source, count(s.visitors)])} />
        )}
        <p className="text-xs text-muted">Source = paramètre utm_source du lien, sinon le site d’où vient le visiteur ; « (direct) » si inconnu.</p>
      </section>

      <section aria-labelledby="limits-title" className="flex flex-col gap-2 text-sm text-muted">
        <h2 id="limits-title" className="font-semibold text-fg">Limites de la mesure</h2>
        <ul className="list-disc pl-5">
          {data.limits.map((l) => <li key={l}>{l}</li>)}
        </ul>
      </section>
    </div>
  );
}

function Filter({ label, name, value, options }: { label: string; name: string; value: string; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <select name={name} defaultValue={value} className={`${control} max-w-56`}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
