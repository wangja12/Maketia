import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { adminDiagnostics } from "@/server/admin";
import { loadAdmin } from "../admin";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const DOMAIN: Record<string, string> = { pending: "En attente", misconfigured: "Mal configuré" };

export default async function AdminDiagnostics() {
  const admin = await loadAdmin();
  const d = await adminDiagnostics(getDb(), admin.id);
  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Diagnostics</h1>
      <section aria-labelledby="domains" className="flex flex-col gap-3">
        <h2 id="domains" className="text-lg font-semibold">Domaines non vérifiés</h2>
        {d.badDomains.length === 0 ? <p className="text-sm text-muted">Aucun.</p> : (
          <DataTable head={["Domaine", "Statut", "Dernière erreur", "Vérifié le"]}
            rows={d.badDomains.map((x) => [
              <span key="h" className="flex flex-col"><span className="font-medium">{x.hostname}</span><span className="text-xs text-muted">{x.workspace} · {x.funnel}</span></span>,
              DOMAIN[x.status] ?? x.status,
              <span key="e" className="text-xs">{x.lastError ?? "—"}</span>,
              x.lastCheckedAt ? dateTime.format(x.lastCheckedAt) : "jamais",
            ])} />
        )}
      </section>
      <section aria-labelledby="pubs" className="flex flex-col gap-3">
        <h2 id="pubs" className="text-lg font-semibold">Publications récentes</h2>
        {d.recentPublications.length === 0 ? <p className="text-sm text-muted">Aucune.</p> : (
          <DataTable head={["Offre", "Adresse", "Version", "Publiée le", "État"]}
            rows={d.recentPublications.map((p) => [p.funnel, `${p.subdomain ?? "(sans sous-domaine)"} /${p.path}`, `v${p.version}`, dateTime.format(p.createdAt), p.unpublishedAt ? "Retirée" : "En ligne"])} />
        )}
      </section>
      <section aria-labelledby="pay" className="flex flex-col gap-3">
        <h2 id="pay" className="text-lg font-semibold">Erreurs de paiement</h2>
        {d.paymentErrors.length === 0 ? <p className="text-sm text-muted">Aucune.</p> : (
          <DataTable head={["Commande", "Détail", "Date"]}
            rows={d.paymentErrors.map((e) => [<span key="r" className="flex flex-col"><code className="text-xs">{e.reference}</code><span className="text-xs text-muted">{e.workspace}</span></span>, <span key="d" className="text-xs">{e.detail ?? e.providerStatus ?? "—"}</span>, dateTime.format(e.createdAt)])} />
        )}
      </section>
    </div>
  );
}
