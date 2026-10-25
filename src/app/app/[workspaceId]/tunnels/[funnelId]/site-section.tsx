import { siteBaseUrl } from "@/lib/site-url";
import type { Domain, Funnel } from "@/db/schema";
import { TXT_PREFIX, txtValue } from "@/server/domains";
import type { listPublications } from "@/server/publishing";
import { siteConfig } from "@/server/site-config";
import { AddDomainForm, RemoveDomainButton, SubdomainForm, VerifyDomainButton } from "./site-forms";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

const STATUS: Record<Domain["status"], { label: string; className: string }> = {
  pending: { label: "En attente de vérification", className: "bg-surface-sunken text-muted" },
  verified: { label: "Vérifié, actif", className: "bg-success-soft text-success" },
  misconfigured: { label: "Mal configuré", className: "bg-danger-soft text-danger" },
};

export async function SiteSection({
  funnel,
  history,
  domainList,
  canEdit,
}: {
  funnel: Funnel;
  history: Awaited<ReturnType<typeof listPublications>>;
  domainList: Domain[];
  canEdit: boolean;
}) {
  const config = siteConfig();
  const base = funnel.subdomain ? await siteBaseUrl(funnel.subdomain) : null;
  const live = history.filter((h) => !h.unpublishedAt);
  const suffix = config.rootDomain ? `.${config.rootDomain}` : "(adresse /s/… de l’application)";

  return (
    <section aria-labelledby="site-title" className="flex flex-col gap-4">
      <h2 id="site-title" className="text-lg font-semibold">Site en ligne</h2>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
        {live.length === 0 ? (
          <p className="text-sm text-muted">Aucune page en ligne. Publie une page depuis sa fiche, après la revue.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {live.map((h) => {
              const url = `${base}/${h.path}`;
              return (
                <li key={h.id} className="flex flex-wrap items-baseline gap-x-2">
                  <a href={url} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-4 [overflow-wrap:anywhere]">{url}</a>
                  <span className="text-xs text-muted">{h.pageName} · variante {h.variantLabel} · v{h.version}</span>
                </li>
              );
            })}
          </ul>
        )}
        {!config.rootDomain && (
          <p className="text-xs text-muted">
            Sous-domaines désactivés : PUBLIC_ROOT_DOMAIN n’est pas configuré (DNS générique requis). Les pages restent accessibles sous /s/… sur l’adresse de l’application.
          </p>
        )}
        {canEdit && <SubdomainForm funnelId={funnel.id} subdomain={funnel.subdomain} suffix={suffix} />}
      </div>

      <div className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
        <h3 className="text-sm font-semibold">Domaines personnalisés</h3>
        {domainList.length === 0 && <p className="text-sm text-muted">Aucun domaine. Ajoute le tien pour afficher cette offre à ton adresse.</p>}
        <ul className="flex flex-col gap-4">
          {domainList.map((d) => (
            <li key={d.id} className="flex flex-col gap-2 border-t border-border pt-3 first:border-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium [overflow-wrap:anywhere]">{d.hostname}</span>
                <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${STATUS[d.status].className}`}>{STATUS[d.status].label}</span>
              </div>
              {d.lastError && <p role="alert" className="text-xs text-danger">{d.lastError}</p>}
              <p className="text-xs text-muted">
                {d.lastCheckedAt ? `Dernière vérification : ${dateTime.format(d.lastCheckedAt)} UTC.` : "Jamais vérifié."}{" "}
                HTTPS : le certificat est délivré par l’hébergeur, non configuré ici ; il n’est pas vérifié par cette page.
              </p>
              {d.status !== "verified" && (
                <div tabIndex={0} className="overflow-x-auto rounded-control bg-surface-sunken p-3 text-xs">
                  <p className="mb-2 font-medium">Chez ton registraire, crée :</p>
                  <table className="w-full text-left font-mono">
                    <thead className="text-muted"><tr><th className="pr-3 font-normal">Type</th><th className="pr-3 font-normal">Nom</th><th className="font-normal">Valeur</th></tr></thead>
                    <tbody>
                      <tr><td className="pr-3">TXT</td><td className="pr-3 break-all">{TXT_PREFIX}.{d.hostname}</td><td className="break-all">{txtValue(d.verificationToken)}</td></tr>
                      <tr><td className="pr-3">CNAME</td><td className="pr-3 break-all">{d.hostname}</td><td className="break-all">{config.domainTarget ?? "— cible non configurée (PUBLIC_DOMAIN_TARGET)"}</td></tr>
                    </tbody>
                  </table>
                  <p className="mt-2 text-muted">La propagation DNS peut prendre jusqu’à quelques heures.</p>
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2">
                  <VerifyDomainButton domainId={d.id} />
                  <RemoveDomainButton domainId={d.id} hostname={d.hostname} />
                </div>
              )}
            </li>
          ))}
        </ul>
        {canEdit && <AddDomainForm funnelId={funnel.id} />}
      </div>

      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer font-medium">Historique des publications ({history.length})</summary>
          <ol className="mt-2 flex flex-col gap-1 text-xs text-muted">
            {history.map((h) => (
              <li key={h.id}>
                {dateTime.format(h.createdAt)} UTC · {h.pageName} {h.variantLabel} v{h.version} sur /{h.path} par {h.publishedByName ?? "—"}
                {h.unpublishedAt ? ` · retirée le ${dateTime.format(h.unpublishedAt)}` : " · en ligne"}
              </li>
            ))}
          </ol>
        </details>
      )}
    </section>
  );
}
