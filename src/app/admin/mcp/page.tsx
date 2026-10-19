import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { count, percent } from "@/lib/format";
import { adminMcpUsage } from "@/server/admin";
import { loadAdmin } from "../admin";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function AdminMcp() {
  const admin = await loadAdmin();
  const u = await adminMcpUsage(getDb(), admin.id);
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Usage MCP</h1>
        <p className="mt-1 text-sm text-muted">Appels des agents IA externes, tirés du journal d’audit. Les écritures réussies comptent dans les quotas des plans.</p>
      </div>
      <section aria-labelledby="daily" className="flex flex-col gap-3">
        <h2 id="daily" className="text-lg font-semibold">14 derniers jours (UTC)</h2>
        {u.daily.length === 0 ? <p className="text-sm text-muted">Aucun appel.</p> : (
          <DataTable head={["Jour", "Appels", "Écritures", "Erreurs", "Taux d’erreur"]}
            rows={u.daily.map((d) => [d.day, count(d.calls), count(d.writes), count(d.errors), percent(d.calls ? d.errors / d.calls : 0)])} />
        )}
      </section>
      <section aria-labelledby="tools" className="flex flex-col gap-3">
        <h2 id="tools" className="text-lg font-semibold">Outils (7 jours)</h2>
        {u.tools.length === 0 ? <p className="text-sm text-muted">Aucun appel.</p> : (
          <DataTable head={["Outil", "Appels", "Erreurs", "Durée moyenne"]}
            rows={u.tools.map((t) => [<code key="t" className="text-xs">{t.tool}</code>, count(t.calls), count(t.errors), t.avgMs === null ? "—" : `${count(t.avgMs)} ms`])} />
        )}
      </section>
      <section aria-labelledby="ws" className="flex flex-col gap-3">
        <h2 id="ws" className="text-lg font-semibold">Espaces les plus actifs (7 jours)</h2>
        {u.byWorkspace.length === 0 ? <p className="text-sm text-muted">Aucun appel.</p> : (
          <DataTable head={["Espace", "Appels", "Erreurs"]} rows={u.byWorkspace.map((w) => [w.workspace, count(w.calls), count(w.errors)])} />
        )}
      </section>
      <section aria-labelledby="errors" className="flex flex-col gap-3">
        <h2 id="errors" className="text-lg font-semibold">Dernières erreurs</h2>
        {u.recentErrors.length === 0 ? <p className="text-sm text-muted">Aucune erreur.</p> : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface text-sm shadow-raised">
            {u.recentErrors.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 px-4 py-2.5">
                <span><code className="text-xs">{e.tool}</code> · {e.workspace} · <span className="text-muted">{dateTime.format(e.createdAt)}</span></span>
                <span className="text-xs text-danger [overflow-wrap:anywhere]">{e.error}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
