import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { count } from "@/lib/format";
import { adminGetUser, adminListPlans } from "@/server/admin";
import { QUOTA_LABELS } from "@/server/billing/plans";
import { NotFoundError } from "@/server/errors";
import { loadAdmin } from "../../admin";
import { ReactivateButton, SuspendButton, WorkspacePlanForm } from "../../forms";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const ROLE: Record<string, string> = { owner: "Propriétaire", admin: "Administrateur", editor: "Éditeur", viewer: "Lecteur" };

export default async function AdminUser({ params }: PageProps<"/admin/utilisateurs/[userId]">) {
  const admin = await loadAdmin();
  const { userId } = await params;
  const db = getDb();
  let data: Awaited<ReturnType<typeof adminGetUser>>;
  try {
    data = await adminGetUser(db, admin.id, userId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const plans = (await adminListPlans(db, admin.id)).filter((p) => p.plan.active).map((p) => ({ id: p.plan.id, name: p.plan.name }));
  const { user, workspaces } = data;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href="/admin/utilisateurs" className="w-fit text-sm text-muted underline-offset-4 hover:underline">← Utilisateurs</Link>
        <h1 className="text-2xl font-semibold tracking-tight">{user.name}</h1>
        <p className="text-sm text-muted">{user.email} · inscrit le {dateTime.format(user.createdAt)} (UTC){user.isPlatformAdmin ? " · administrateur" : ""}</p>
      </div>

      <section aria-labelledby="account-title" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
        <h2 id="account-title" className="text-sm font-semibold">Compte</h2>
        {user.suspendedAt ? (
          <>
            <p className="text-sm"><span className="font-medium text-danger">Suspendu</span> le {dateTime.format(user.suspendedAt)} (UTC) · motif : {user.suspendedReason}</p>
            <div><ReactivateButton userId={user.id} /></div>
          </>
        ) : user.isPlatformAdmin || user.id === admin.id ? (
          <p className="text-sm text-muted">Compte administrateur : pas de suspension depuis l’interface.</p>
        ) : (
          <div><SuspendButton userId={user.id} email={user.email} /></div>
        )}
      </section>

      <section aria-labelledby="ws-title" className="flex flex-col gap-3">
        <h2 id="ws-title" className="text-lg font-semibold">Espaces</h2>
        {workspaces.map((w) => (
          <div key={w.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col gap-1">
              <h3 className="font-medium">{w.name}</h3>
              <p className="text-xs text-muted">{ROLE[w.role]} · plan {w.plan.name} · {w.activeTokens} connexion(s) MCP active(s)</p>
              <ul className="mt-1 text-xs text-muted">
                {(Object.keys(w.usage) as (keyof typeof w.usage)[]).map((k) => (
                  <li key={k}>{QUOTA_LABELS[k]} : {count(w.usage[k])} / {w.plan.limits[k] === null || w.plan.limits[k] === undefined ? "illimité" : count(w.plan.limits[k]!)}</li>
                ))}
              </ul>
            </div>
            {w.role === "owner" && <div className="md:w-72"><WorkspacePlanForm userId={user.id} workspaceId={w.id} planId={w.plan.id} plans={plans} /></div>}
          </div>
        ))}
      </section>
    </div>
  );
}
