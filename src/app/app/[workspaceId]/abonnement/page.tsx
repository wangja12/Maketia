import type { Metadata } from "next";
import { getDb } from "@/db";
import { count, money } from "@/lib/format";
import { getUsageAndLimits, listActivePlans, QUOTA_LABELS, type QuotaKey } from "@/server/billing/plans";
import { loadWorkspace } from "../workspace";
import { ChoosePlanButton } from "./choose-plan";

export const metadata: Metadata = { title: "Abonnement · Tunnels IA" };

const price = (p: { priceMonthly: number | null; currency: string | null }) =>
  p.priceMonthly === null ? "Tarif à définir" : p.priceMonthly === 0 ? "Gratuit" : `${money(p.priceMonthly, p.currency ?? "XOF")} / mois`;

export default async function SubscriptionPage({ params }: PageProps<"/app/[workspaceId]/abonnement">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const db = getDb();
  const [usage, plans] = await Promise.all([getUsageAndLimits(db, user.id, workspace.id), listActivePlans(db)]);
  const isOwner = workspace.role === "owner";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Abonnement</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Plan de l’espace et consommation. Les limites s’appliquent à tout le monde, y compris aux agents IA connectés par MCP.
          Elles sont distinctes des paiements que vous encaissez via vos tunnels.
        </p>
      </div>

      <section aria-labelledby="current-title" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="current-title" className="text-lg font-semibold">Plan actuel : {usage.plan.name}</h2>
          <span className="text-sm text-muted">{price(usage.plan)}</span>
        </div>
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
          {usage.quotas.map((q) => (
            <li key={q.key} className="flex flex-col gap-1.5 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{q.label}</span>
                <span className="shrink-0 tabular-nums">
                  {q.used === null ? "" : `${count(q.used)} / `}
                  {q.limit === null ? "illimité" : count(q.limit)}
                </span>
              </div>
              {q.limit !== null && q.used !== null && q.limit > 0 && (
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
                  <div className={`h-full rounded-full ${q.reached ? "bg-danger" : "bg-accent"}`} style={{ width: `${Math.min(100, (q.used / q.limit) * 100)}%` }} />
                </div>
              )}
              {q.exceeded && <p className="text-xs text-danger">Dépassement : ce qui existe est conservé, mais rien de nouveau ne peut être ajouté.</p>}
              {q.reached && !q.exceeded && <p className="text-xs text-danger">Limite atteinte.</p>}
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">{usage.period} Les modifications par agent comptent les appels MCP d’écriture réussis.</p>
      </section>

      <section aria-labelledby="plans-title" className="flex flex-col gap-3">
        <h2 id="plans-title" className="text-lg font-semibold">Plans disponibles</h2>
        <p role="note" className="rounded-card bg-warning-soft px-4 py-3 text-sm text-warning">
          Le paiement des abonnements n’est pas encore en service : les plans payants sont attribués par l’équipe de la plateforme. Vous pouvez passer vous-même à un plan gratuit.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => {
            const current = p.id === usage.plan.id;
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  {current && <span className="text-xs font-medium text-success">Plan actuel</span>}
                </div>
                <p className="text-sm">{price(p)}</p>
                <ul className="flex flex-col gap-1 text-xs text-muted">
                  {(Object.keys(QUOTA_LABELS) as QuotaKey[]).map((k) => (
                    <li key={k}>{QUOTA_LABELS[k]} : {p.limits[k] === null || p.limits[k] === undefined ? "illimité" : count(p.limits[k]!)}</li>
                  ))}
                </ul>
                {!current && isOwner && p.priceMonthly === 0 && <ChoosePlanButton workspaceId={workspace.id} planId={p.id} name={p.name} />}
              </div>
            );
          })}
        </div>
        {!isOwner && <p className="text-xs text-muted">Seul le propriétaire de l’espace peut changer de plan.</p>}
      </section>
    </div>
  );
}
