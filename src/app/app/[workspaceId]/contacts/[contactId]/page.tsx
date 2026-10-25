import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { money } from "@/lib/format";
import { EVENT_LABELS, getContact, STATUS_LABELS } from "@/server/crm/contacts";
import { NotFoundError } from "@/server/errors";
import { can } from "@/server/workspaces";
import { loadWorkspace } from "../../workspace";
import { DeleteContactButton, StatusForm, TagsEditor } from "../contact-forms";
import { ContactStatusBadge } from "../status-badge";

export const metadata: Metadata = { title: "Contact · Maketia" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
const ORDER_STATUS: Record<string, string> = { started: "Commencée", pending: "En attente", paid: "Payée", failed: "Échouée", expired: "Expirée" };

export default async function ContactPage({ params }: PageProps<"/app/[workspaceId]/contacts/[contactId]">) {
  const { workspaceId, contactId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  let data: Awaited<ReturnType<typeof getContact>>;
  try {
    data = await getContact(getDb(), user.id, contactId);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { contact: c, orders, history, origin } = data;
  if (c.workspaceId !== workspace.id) notFound();
  const name = `${c.firstName} ${c.lastName}`.trim();
  const canEdit = can(workspace.role, "edit");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/app/${workspace.id}/contacts`} className="w-fit text-sm text-muted underline-offset-4 hover:underline">← Contacts</Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <ContactStatusBadge status={c.status} />
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="orders-title" className="flex flex-col gap-3">
            <h2 id="orders-title" className="text-lg font-semibold">Commandes</h2>
            {orders.length === 0 ? (
              <p className="text-sm text-muted">Aucune commande.</p>
            ) : (
              <DataTable
                head={["Produit", "Montant", "Statut", "Date"]}
                rows={orders.map((o) => [o.productName, money(o.amount, o.currency), ORDER_STATUS[o.status] ?? o.status, dateTime.format(o.paidAt ?? o.createdAt)])}
              />
            )}
            <p className="text-xs text-muted">« Payée » seulement après confirmation par le prestataire de paiement.</p>
          </section>

          <section aria-labelledby="history-title" className="flex flex-col gap-3">
            <h2 id="history-title" className="text-lg font-semibold">Historique</h2>
            <ol className="flex flex-col gap-3 border-l border-border pl-4">
              {history.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="font-medium">{EVENT_LABELS[h.kind] ?? h.kind}</span>
                  {h.detail && <span className="text-muted"> · {h.detail}</span>}
                  <span className="block text-xs text-muted">{dateTime.format(h.createdAt)} (UTC)</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="flex flex-col gap-5">
          <section aria-label="Coordonnées" className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4 text-sm shadow-raised">
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
              <dt className="text-muted">E-mail</dt><dd className="[overflow-wrap:anywhere]">{c.email}</dd>
              <dt className="text-muted">Téléphone</dt><dd>{c.phone ?? "—"}</dd>
              <dt className="text-muted">Inscrit le</dt><dd>{dateTime.format(c.createdAt)}</dd>
              <dt className="text-muted">Offre</dt><dd>{origin.funnelName ?? "—"}</dd>
              <dt className="text-muted">Page</dt><dd>{origin.pageName ?? "—"}{c.variantLabel ? ` · variante ${c.variantLabel}` : ""}</dd>
              <dt className="text-muted">Source</dt><dd>{c.source ?? "(direct ou inconnue)"}</dd>
              <dt className="text-muted">Consentement</dt><dd>{c.consentAt ? `Donné le ${dateTime.format(c.consentAt)}` : "Commande uniquement"}</dd>
            </dl>
          </section>
          {canEdit ? (
            <StatusForm workspaceId={workspace.id} contactId={c.id} status={c.status} options={Object.entries(STATUS_LABELS)} />
          ) : null}
          <div className="flex flex-col gap-1.5">
            <h2 className="text-xs font-medium">Tags</h2>
            <TagsEditor workspaceId={workspace.id} contactId={c.id} tags={c.tags} canEdit={canEdit} />
          </div>
          {can(workspace.role, "delete") && (
            <div className="border-t border-border pt-4">
              <DeleteContactButton workspaceId={workspace.id} contactId={c.id} name={name} />
              <p className="mt-1 text-xs text-muted">À utiliser quand la personne demande l’effacement de ses données.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
