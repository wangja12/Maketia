import type { Metadata } from "next";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { DESIGN_SKILL_VERSION } from "@/server/design-skill";
import { listAgentRequests, NEEDS_REVIEW, REQUEST_KINDS, type RequestKind } from "@/server/agent-requests";
import { EXPERIMENT_REVIEW } from "@/server/analytics/experiments";
import { listMcpAudit, listMcpTokens, RATE_LIMIT_PER_MINUTE } from "@/server/mcp-tokens";
import { MANUAL_REVIEW } from "@/server/page-validation";
import { can } from "@/server/workspaces";
import { loadWorkspace } from "../workspace";
import { DecideRequest } from "./request-forms";
import { CreateTokenForm, RevokeButton } from "./token-forms";

export const metadata: Metadata = { title: "Agents IA · Maketia" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

export default async function AgentsPage({ params }: PageProps<"/app/[workspaceId]/agents">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const db = getDb();
  const [tokens, audit, requests] = await Promise.all([
    listMcpTokens(db, user.id, workspace.id),
    listMcpAudit(db, user.id, workspace.id),
    listAgentRequests(db, user.id, workspace.id),
  ]);
  const canDecide = can(workspace.role, "edit");
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending").slice(0, 15);
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const serverUrl = `${process.env.APP_URL ?? `${proto}://${h.get("host")}`}/api/mcp`;
  const canRevokeAll = can(workspace.role, "delete");
  const active = tokens.filter((t) => !t.revokedAt);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Agents IA (MCP)</h1>
        <p className="text-sm text-muted text-pretty">
          Maketia n’intègre aucune intelligence artificielle. Vous connectez la vôtre (Claude, ChatGPT ou tout client
          compatible MCP) : elle lit votre fiche d’offre et crée ou modifie des pages avec vos droits, en appliquant la
          skill de design obligatoire <span className="font-mono text-xs">wang-design-engineering {DESIGN_SKILL_VERSION}</span>.
          Chaque action est enregistrée et versionnée. Un agent peut demander une publication, un arrêt de test ou un choix
          de gagnant : rien n’est exécuté tant qu’une personne de l’espace ne l’a pas approuvé ici.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section aria-labelledby="requests-title" className="flex flex-col gap-3">
            <h2 id="requests-title" className="text-lg font-semibold">Demandes à approuver ({pending.length})</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-muted">Aucune demande en attente.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {pending.map((r) => {
                  const p = r.params as Record<string, string | number | undefined>;
                  const kind = r.kind as RequestKind;
                  const review = NEEDS_REVIEW.includes(kind) ? (kind === "select_experiment_winner" ? EXPERIMENT_REVIEW : MANUAL_REVIEW) : [];
                  return (
                    <li key={r.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{REQUEST_KINDS[kind]}</span>
                        <span className="text-sm">
                          {p.pageName ? `« ${p.pageName} » (variante ${p.variant})` : `« ${p.experimentName} »${p.variant ? `, variante ${p.variant}` : ""}`}
                          {kind === "publish_page" ? ` · version ${p.version} sur /${p.path}` : ""}
                        </span>
                        {r.reason && <span className="text-xs text-muted">Motif donné par l’agent (non vérifié) : {r.reason}</span>}
                        <span className="text-xs text-muted">Demandée le {dateTime.format(r.createdAt)} UTC · expire le {dateTime.format(r.expiresAt)} UTC</span>
                        {kind === "publish_page" && (
                          <a href={`/preview/${r.resourceId}?v=${p.version}`} target="_blank" rel="noreferrer" className="w-fit text-xs font-medium text-accent underline-offset-4 hover:underline">
                            Voir l’aperçu de la version {p.version}
                          </a>
                        )}
                      </div>
                      {canDecide ? <DecideRequest workspaceId={workspace.id} requestId={r.id} review={review} /> : <p className="text-xs text-muted">Seul un membre pouvant modifier décide.</p>}
                    </li>
                  );
                })}
              </ul>
            )}
            {decided.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Demandes traitées</summary>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                  {decided.map((r) => (
                    <li key={r.id}>
                      {dateTime.format(r.createdAt)} · {REQUEST_KINDS[r.kind as RequestKind]} ·{" "}
                      {{ approved: "approuvée", rejected: "refusée", failed: "échec", expired: "expirée" }[r.status] ?? r.status}
                      {r.result ? ` · ${r.result}` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section aria-labelledby="tokens-title" className="flex flex-col gap-3">
            <h2 id="tokens-title" className="text-lg font-semibold">Connexions</h2>
            {active.length === 0 ? (
              <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted">
                Aucun agent connecté. Créez une connexion, puis ajoutez-la dans votre client IA.
              </p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
                {active.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">{t.name}</span>
                      <span className="text-xs text-muted">
                        {t.access === "write" ? "Lecture et modification" : "Lecture seule"} ·{" "}
                        {t.lastUsedAt ? `dernière activité ${dateTime.format(t.lastUsedAt)} UTC` : "jamais utilisée"}
                      </span>
                    </div>
                    {(t.userId === user.id || canRevokeAll) && <RevokeButton workspaceId={workspace.id} tokenId={t.id} name={t.name} />}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="audit-title" className="flex flex-col gap-3">
            <h2 id="audit-title" className="text-lg font-semibold">Journal des actions</h2>
            {audit.length === 0 ? (
              <p className="text-sm text-muted">Aucune action d’agent pour l’instant.</p>
            ) : (
              <div tabIndex={0} className="overflow-x-auto rounded-card border border-border bg-surface">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs text-muted">
                    <tr className="border-b border-border">
                      <th scope="col" className="px-3 py-2 font-medium">Date (UTC)</th>
                      <th scope="col" className="px-3 py-2 font-medium">Agent</th>
                      <th scope="col" className="px-3 py-2 font-medium">Outil</th>
                      <th scope="col" className="px-3 py-2 font-medium">Résultat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {audit.map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-muted">{dateTime.format(a.createdAt)}</td>
                        <td className="max-w-40 truncate px-3 py-2">{a.tokenName ?? "—"}</td>
                        <td className="px-3 py-2 font-mono text-xs">{a.tool}</td>
                        <td className="px-3 py-2">
                          {a.ok ? <span className="text-success">Réussi</span> : <span className="text-danger" title={a.error ?? undefined}>Refusé · {a.error}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <CreateTokenForm workspaceId={workspace.id} serverUrl={serverUrl} canWrite={can(workspace.role, "edit")} />
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-muted">Adresse</dt>
            <dd className="font-mono text-xs break-all">{serverUrl}</dd>
            <dt className="text-muted">Transport</dt>
            <dd>HTTP « streamable », sans session</dd>
            <dt className="text-muted">Authentification</dt>
            <dd>Jeton porteur (Bearer), un espace par jeton</dd>
            <dt className="text-muted">Limite</dt>
            <dd>{RATE_LIMIT_PER_MINUTE} appels par minute et par jeton</dd>
          </dl>
        </aside>
      </div>
    </div>
  );
}
