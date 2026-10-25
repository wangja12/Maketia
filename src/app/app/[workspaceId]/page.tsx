import type { Metadata } from "next";
import { getDb } from "@/db";
import { listFunnels } from "@/server/funnels";
import { can } from "@/server/workspaces";
import { CreateFunnelForm } from "./create-funnel-form";
import { FunnelRow } from "./funnel-row";
import { loadWorkspace } from "./workspace";

export const metadata: Metadata = { title: "Offres · Maketia" };

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function WorkspacePage({ params }: PageProps<"/app/[workspaceId]">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const funnels = await listFunnels(getDb(), user.id, workspace.id);
  const canEdit = can(workspace.role, "edit");
  const canDelete = can(workspace.role, "delete");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Mes offres</h1>
        <p className="text-sm text-muted">
          {funnels.length === 0
            ? "Aucune offre pour l’instant."
            : `${funnels.length} offre${funnels.length > 1 ? "s" : ""} dans cet espace.`}
        </p>
      </div>

      {canEdit && <CreateFunnelForm workspaceId={workspace.id} />}

      {funnels.length === 0 ? (
        <section className="flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong px-6 py-14 text-center">
          <h2 className="text-base font-medium">Crée ta première offre</h2>
          <p className="max-w-sm text-sm text-muted">
            {canEdit
              ? "Donne-lui un nom ci-dessus. Tu pourras ensuite générer ses pages et les modifier."
              : "Tu as un accès en lecture seule à cet espace. Un membre éditeur peut créer des offres."}
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
          {funnels.map((f) => (
            <FunnelRow
              key={f.id}
              workspaceId={workspace.id}
              funnel={{ id: f.id, name: f.name, slug: f.slug, status: f.status }}
              updatedLabel={dateFormat.format(f.updatedAt)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
