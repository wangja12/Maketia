import { getDb } from "@/db";
import { money } from "@/lib/format";
import { adminListPlans } from "@/server/admin";
import { loadAdmin } from "../admin";
import { PlanForm } from "../forms";

export default async function AdminPlans() {
  const admin = await loadAdmin();
  const plans = await adminListPlans(getDb(), admin.id);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plans et quotas</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Prix et limites se règlent ici, sans toucher au code. Les limites sont vérifiées par le serveur à chaque création (y compris par les agents MCP).
          Le paiement des abonnements n’est pas encore branché : un plan payant s’attribue depuis la fiche d’un utilisateur.
        </p>
      </div>
      {plans.map(({ plan, workspaces }) => (
        <details key={plan.id} className="group rounded-card border border-border bg-surface shadow-raised">
          <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-2 px-4 py-3">
            <span className="font-medium">{plan.name} <span className="font-mono text-xs text-muted">{plan.code}</span></span>
            <span className="text-sm text-muted">
              {plan.priceMonthly === null ? "Tarif à définir" : plan.priceMonthly === 0 ? "Gratuit" : `${money(plan.priceMonthly, plan.currency ?? "XOF")} / mois`}
              {" · "}{workspaces} espace(s){plan.isDefault ? " · par défaut" : ""}{plan.active ? "" : " · inactif"}
            </span>
          </summary>
          <div className="border-t border-border p-4"><PlanForm plan={plan} /></div>
        </details>
      ))}
      <section aria-labelledby="new-plan" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
        <h2 id="new-plan" className="text-sm font-semibold">Nouveau plan</h2>
        <PlanForm />
      </section>
    </div>
  );
}
