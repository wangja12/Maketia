import type { Metadata } from "next";
import Link from "next/link";
import { DataTable } from "@/components/ui/data-table";
import { getDb } from "@/db";
import { count } from "@/lib/format";
import { contactFacets, listContacts, listSegments, STATUS_LABELS } from "@/server/crm/contacts";
import { listFunnels } from "@/server/funnels";
import { can } from "@/server/workspaces";
import { loadWorkspace } from "../workspace";
import { DeleteSegmentButton, SaveSegmentForm } from "./contact-forms";
import { ContactStatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Contacts · Tunnels IA" };

const PAGE_SIZE = 50;
const control = "h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised sm:h-8 sm:text-sm";
const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "UTC" });

export default async function ContactsPage({ params, searchParams }: PageProps<"/app/[workspaceId]/contacts">) {
  const { workspaceId } = await params;
  const search = await searchParams;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const db = getDb();
  const raw = Object.fromEntries(Object.entries(search).filter((e): e is [string, string] => typeof e[1] === "string"));
  const pageNumber = Math.max(1, Number(raw.page) || 1);
  const [result, segments, facets, funnelList] = await Promise.all([
    listContacts(db, user.id, workspace.id, raw, { limit: PAGE_SIZE, offset: (pageNumber - 1) * PAGE_SIZE }),
    listSegments(db, user.id, workspace.id),
    contactFacets(db, user.id, workspace.id),
    listFunnels(db, user.id, workspace.id),
  ]);
  const f = result.filters;
  const active = Object.fromEntries(Object.entries(f).filter(([, v]) => v)) as Record<string, string>;
  const base = `/app/${workspace.id}/contacts`;
  const qs = (extra: Record<string, string> = {}) => new URLSearchParams({ ...active, ...extra }).toString();
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Les personnes qui ont laissé leurs coordonnées sur vos pages (formulaire de contact ou de commande). Rien n’est importé ni deviné, et aucun e-mail n’est envoyé depuis la plateforme.
          </p>
        </div>
        {can(workspace.role, "delete") && result.total > 0 && (
          <a href={`${base}/export?${qs()}`} className="text-sm font-medium text-accent underline-offset-4 hover:underline" download>
            Exporter en CSV ({count(result.total)})
          </a>
        )}
      </div>

      {segments.length > 0 && (
        <nav aria-label="Segments" className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted">Segments :</span>
          {segments.map((s) => (
            <span key={s.id} className="inline-flex items-center rounded-full border border-border-strong bg-surface pl-3 text-sm">
              <Link href={`${base}?${new URLSearchParams(s.filters).toString()}`} className="underline-offset-4 hover:underline">
                {s.name} <span className="tabular-nums text-muted">({count(s.size)})</span>
              </Link>
              {can(workspace.role, "edit") ? <DeleteSegmentButton workspaceId={workspace.id} segmentId={s.id} name={s.name} /> : <span className="w-3" />}
            </span>
          ))}
        </nav>
      )}

      <form className="flex flex-wrap items-end gap-3" aria-label="Filtres">
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs font-medium">
          Rechercher
          <input name="q" defaultValue={f.q ?? ""} placeholder="Nom, e-mail ou téléphone" className={control} />
        </label>
        <Filter label="Statut" name="status" value={f.status} options={Object.entries(STATUS_LABELS)} />
        <Filter label="Tag" name="tag" value={f.tag} options={facets.tags.map((t) => [t, t])} />
        <Filter label="Tunnel" name="funnelId" value={f.funnelId} options={funnelList.map((x) => [x.id, x.name])} />
        <Filter label="Source" name="source" value={f.source} options={[["(direct)", "(direct)"], ...facets.sources.map((s): [string, string] => [s, s])]} />
        <Filter label="Achat" name="buyer" value={f.buyer} options={[["yes", "A payé"], ["no", "N’a pas payé"]]} />
        <button type="submit" className={`${control} pressable font-medium [@media(hover:hover)_and_(pointer:fine)]:hover:bg-surface-sunken`}>Filtrer</button>
        {Object.keys(active).length > 0 && <Link href={base} className="pb-1.5 text-sm text-muted underline-offset-4 hover:underline">Effacer</Link>}
      </form>

      {can(workspace.role, "edit") && Object.keys(active).length > 0 && <SaveSegmentForm workspaceId={workspace.id} filters={active} />}

      {result.total === 0 ? (
        <div className="rounded-card border border-dashed border-border-strong px-6 py-10 text-center">
          <p className="font-medium">{Object.keys(active).length ? "Aucun contact ne correspond" : "Aucun contact pour l’instant"}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Ajoutez une section « Formulaire de contact » ou « Commande et paiement » à une page publiée : chaque envoi crée ou met à jour un contact ici.
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted">{count(result.total)} contact{result.total > 1 ? "s" : ""}</p>
          <DataTable
            head={["Contact", "Statut", "Tags", "Origine", "Paiements", "Dernière activité"]}
            rows={result.rows.map(({ contact: c, funnelName, paidOrders }) => [
              <Link key="n" href={`${base}/${c.id}`} className="flex flex-col underline-offset-4 hover:underline">
                <span className="font-medium">{`${c.firstName} ${c.lastName}`.trim()}</span>
                <span className="text-xs text-muted">{c.email}</span>
              </Link>,
              <ContactStatusBadge key="s" status={c.status} />,
              <span key="t" className="text-xs">{c.tags.join(", ") || "—"}</span>,
              <span key="o" className="text-xs">{funnelName ?? "—"}{c.variantLabel ? ` · ${c.variantLabel}` : ""}<br />{c.source ?? "(direct)"}</span>,
              count(paidOrders),
              date.format(c.lastActivityAt),
            ])}
          />
          {pages > 1 && (
            <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
              {pageNumber > 1 ? <Link href={`${base}?${qs({ page: String(pageNumber - 1) })}`} className="text-accent underline-offset-4 hover:underline">← Précédents</Link> : <span />}
              <span className="text-muted">Page {pageNumber} sur {pages}</span>
              {pageNumber < pages ? <Link href={`${base}?${qs({ page: String(pageNumber + 1) })}`} className="text-accent underline-offset-4 hover:underline">Suivants →</Link> : <span />}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function Filter({ label, name, value, options }: { label: string; name: string; value?: string; options: [string, string][] }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium">
      {label}
      <select name={name} defaultValue={value ?? ""} className={`${control} max-w-48`}>
        <option value="">Tous</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
