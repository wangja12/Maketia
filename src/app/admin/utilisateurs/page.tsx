import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { adminListUsers } from "@/server/admin";
import { loadAdmin } from "../admin";

const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function AdminUsers({ searchParams }: PageProps<"/admin/utilisateurs">) {
  const admin = await loadAdmin();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q : "";
  const rows = await adminListUsers(getDb(), admin.id, query);
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Utilisateurs</h1>
      <form className="flex gap-2" role="search">
        <label htmlFor="q" className="sr-only">Rechercher</label>
        <input id="q" name="q" defaultValue={query} placeholder="Nom ou e-mail"
          className="h-9 w-full max-w-sm rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised sm:h-8 sm:text-sm" />
        <button type="submit" className="pressable h-9 rounded-control border border-border-strong bg-surface px-3 text-sm font-medium shadow-raised sm:h-8">Rechercher</button>
      </form>
      <DataTable
        head={["Utilisateur", "Statut", "Espaces", "Inscrit le"]}
        rows={rows.map((u) => [
          <Link key="u" href={`/admin/utilisateurs/${u.id}`} className="flex flex-col underline-offset-4 hover:underline">
            <span className="font-medium">{u.name}</span>
            <span className="text-xs text-muted">{u.email}</span>
          </Link>,
          u.suspendedAt ? <span key="s" className="font-medium text-danger">Suspendu</span> : u.isPlatformAdmin ? "Administrateur" : "Actif",
          u.workspaces,
          date.format(u.createdAt),
        ])}
      />
      {rows.length === 0 && <p className="text-sm text-muted">Aucun utilisateur trouvé.</p>}
    </div>
  );
}
