import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { adminAuditTrail } from "@/server/admin";
import { loadAdmin } from "../admin";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function AdminJournal() {
  const admin = await loadAdmin();
  const rows = await adminAuditTrail(getDb(), admin.id);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Journal d’administration</h1>
        <p className="mt-1 text-sm text-muted">Chaque action faite dans l’administration, avec son auteur. Le journal MCP est dans « MCP ».</p>
      </div>
      {rows.length === 0 ? <p className="text-sm text-muted">Aucune action.</p> : (
        <DataTable head={["Date (UTC)", "Action", "Cible", "Détail", "Par"]}
          rows={rows.map((r) => [dateTime.format(r.createdAt), <code key="a" className="text-xs">{r.action}</code>, `${r.targetType}${r.targetId ? ` ${r.targetId.slice(0, 8)}` : ""}`, <span key="d" className="text-xs [overflow-wrap:anywhere]">{r.detail ?? "—"}</span>, r.admin ?? "ligne de commande"])} />
      )}
    </div>
  );
}
