import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/db";
import { NotFoundError } from "@/server/errors";
import { getPage, listVariants, listVersions, MAX_VARIANTS } from "@/server/pages";
import { PAGE_KIND_LABELS } from "@/server/page-templates";
import { validatePageContent } from "@/server/page-validation";
import { can } from "@/server/workspaces";
import { buttonClass } from "@/components/ui/button";
import { loadFunnel } from "../../funnel";
import { DevicePreview } from "./device-preview";
import { DeletePageButton, DuplicateButton, RestoreButton, VariantButton } from "./page-actions";

export const metadata: Metadata = { title: "Page · Tunnels IA" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function PageDetail({ params, searchParams }: PageProps<"/app/[workspaceId]/tunnels/[funnelId]/pages/[pageId]">) {
  const { workspaceId, funnelId, pageId } = await params;
  const { v } = await searchParams;
  const { user, workspace, funnel } = await loadFunnel(workspaceId, funnelId);
  const db = getDb();
  const actor = { userId: user.id };
  const requested = typeof v === "string" && /^\d+$/.test(v) ? Number(v) : undefined;

  let data;
  try {
    data = await getPage(db, actor, pageId, requested);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const { page, version } = data;
  if (page.funnelId !== funnel.id) notFound();

  const [variants, versions] = await Promise.all([listVariants(db, actor, page.id), listVersions(db, actor, page.id)]);
  const report = validatePageContent(page.kind, version.content);
  const canEdit = can(workspace.role, "edit");
  const canDelete = can(workspace.role, "delete");
  const isCurrent = version.version === page.currentVersion;
  const base = `/app/${workspace.id}/tunnels/${funnel.id}/pages`;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href={`/app/${workspace.id}/tunnels/${funnel.id}`} className="w-fit text-sm text-muted underline-offset-4 hover:underline">
          ← {funnel.name}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{page.name}</h1>
          <span className="text-sm text-muted">{PAGE_KIND_LABELS[page.kind]}</span>
          {canEdit && (
            <Link href={`${base}/${page.id}/editer`} className={buttonClass("primary", "ml-auto")}>
              Modifier la page
            </Link>
          )}
        </div>
        <nav aria-label="Variantes" className="flex flex-wrap items-center gap-1">
          {variants.map((p) => (
            <Link
              key={p.id}
              href={`${base}/${p.id}`}
              aria-current={p.id === page.id ? "page" : undefined}
              className="pressable inline-flex h-8 items-center rounded-control border border-border-strong px-3 text-sm aria-[current=page]:border-fg aria-[current=page]:bg-fg aria-[current=page]:text-bg"
            >
              Variante {p.variantLabel}
            </Link>
          ))}
          <span className="ml-1 text-xs text-muted">{variants.length}/{MAX_VARIANTS}</span>
        </nav>
      </div>

      {!isCurrent && (
        <p role="status" className="rounded-control bg-surface-sunken px-3 py-2 text-sm">
          Vous consultez la version {version.version} (la version actuelle est la {page.currentVersion}).{" "}
          <Link href={`${base}/${page.id}`} className="font-medium text-accent underline-offset-4 hover:underline">Revenir à la version actuelle</Link>
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Aperçu" className="min-w-0">
          <DevicePreview src={`/preview/${page.id}?v=${version.version}`} title={`Aperçu de ${page.name}, version ${version.version}`} />
          <p className="mt-2 text-xs text-muted">
            Aperçu privé de la version {version.version}. Modifiez la page dans l’éditeur visuel, ou demandez-le à votre agent IA (MCP).
          </p>
        </section>

        <aside className="flex flex-col gap-6">
          <section aria-labelledby="checks-title" className="flex flex-col gap-2">
            <h2 id="checks-title" className="text-sm font-semibold">Contrôles automatiques · v{version.version}</h2>
            {report.errors.length === 0 && report.warnings.length === 0 && (
              <p className="text-sm text-success">Aucun problème détecté par les contrôles automatiques.</p>
            )}
            <ul className="flex flex-col gap-1.5 text-sm">
              {report.errors.map((e, i) => (
                <li key={`e${i}`} className="rounded-control bg-danger-soft px-2.5 py-1.5 text-danger">
                  <span className="font-medium">Bloquant :</span> {e.message}
                </li>
              ))}
              {report.warnings.map((w, i) => (
                <li key={`w${i}`} className="rounded-control bg-surface-sunken px-2.5 py-1.5">
                  <span className="font-medium">À vérifier :</span> {w.message}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="review-title" className="flex flex-col gap-2">
            <h2 id="review-title" className="text-sm font-semibold">Revue humaine avant publication</h2>
            <p className="text-xs text-muted">Ces points ne peuvent pas être vérifiés automatiquement (skill wang-design-engineering).</p>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-sm text-muted">
              {report.review.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </section>

          {(canEdit || canDelete) && (
            <section aria-label="Actions" className="flex flex-col gap-2">
              {canEdit && <VariantButton pageId={page.id} full={variants.length >= MAX_VARIANTS} />}
              {canEdit && <DuplicateButton pageId={page.id} />}
              {canDelete && <DeletePageButton pageId={page.id} label={`${page.name} (variante ${page.variantLabel})`} />}
            </section>
          )}

          <section aria-labelledby="history-title" className="flex flex-col gap-2">
            <h2 id="history-title" className="text-sm font-semibold">Historique</h2>
            <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface text-sm">
              {versions.map((h) => (
                <li key={h.version} className="flex items-start gap-2 px-3 py-2">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`${base}/${page.id}?v=${h.version}`}
                      aria-current={h.version === version.version ? "true" : undefined}
                      className="font-medium underline-offset-4 hover:underline aria-[current=true]:text-accent"
                    >
                      v{h.version}{h.version === page.currentVersion ? " · actuelle" : ""}
                    </Link>
                    <span className="truncate text-xs text-muted" title={h.note ?? undefined}>{h.note ?? "—"}</span>
                    <span className="text-xs text-muted">
                      {h.authorKind === "agent" ? `Agent « ${h.agentName ?? "révoqué"} » pour ${h.authorName ?? "?"}` : (h.authorName ?? "Utilisateur supprimé")} · {dateTime.format(h.createdAt)}
                    </span>
                  </div>
                  {canEdit && h.version !== page.currentVersion && (
                    <RestoreButton pageId={page.id} baseVersion={page.currentVersion} version={h.version} />
                  )}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
