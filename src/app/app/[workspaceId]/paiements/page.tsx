import type { Metadata } from "next";
import { getDb } from "@/db";
import type { Order } from "@/db/schema";
import { money } from "@/lib/format";
import { allowedLinkHosts, linkStatus } from "@/server/payments/links";
import { ACCEPTED_TYPES, listDownloadGrants, listProductFiles, MAX_FILE_BYTES } from "@/server/files/files";
import { getWebhookSetup, listWebhookEvents } from "@/server/payments/saspay-webhooks";
import { getOrderForUser, listOrders, listProducts, PRODUCT_KINDS } from "@/server/payments/service";
import { can } from "@/server/workspaces";
import { loadWorkspace } from "../workspace";
import {
  CancelOrderButton,
  ClearSecretButton,
  ConfirmPaidButton,
  CopyField,
  LinkForm,
  ProductForm,
  RawBody,
  ReconcileForm,
  RemoveLinkButton,
  RotateUrlButton,
  SecretForm,
  ToggleProductButton,
} from "./forms";
import { DeleteFileButton, DownloadLinksButton, FileUploader, RevokeGrantButton } from "./files";

export const metadata: Metadata = { title: "Paiements · Maketia" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

// Label always present: state is never conveyed by color alone.
const ORDER_STATUS: Record<Order["status"], { label: string; className: string }> = {
  started: { label: "Commencée", className: "bg-surface-sunken text-muted" },
  pending: { label: "Paiement en attente", className: "bg-surface-sunken text-fg" },
  paid: { label: "Payée", className: "bg-success-soft text-success" },
  failed: { label: "Échouée", className: "bg-danger-soft text-danger" },
  expired: { label: "Expirée", className: "bg-surface-sunken text-muted" },
  payment_unmatched: { label: "Paiement à rapprocher", className: "bg-warning-soft text-warning" },
  delivery_queued: { label: "Livraison en attente", className: "bg-surface-sunken text-fg" },
  delivered: { label: "Livrée", className: "bg-success-soft text-success" },
  delivery_failed: { label: "Échec de livraison", className: "bg-danger-soft text-danger" },
  cancelled: { label: "Annulée", className: "bg-surface-sunken text-muted" },
};

const PAID_VIA: Record<string, string> = { manual: "confirmée par vous", webhook: "confirmée par notification" };

const EVENT_LABELS: Record<string, string> = {
  order_created: "Commande créée, acheteur envoyé vers votre lien SasPay",
  manual_confirmation: "Paiement confirmé manuellement",
  cancelled: "Commande annulée",
  // Orders from the removed CinetPay integration.
  payment_initiated: "Paiement initialisé (ancienne intégration)",
  webhook_received: "Notification reçue (ancienne intégration)",
  status_changed: "Statut confirmé (ancienne intégration)",
  error: "Erreur",
};

const WEBHOOK_STATE: Record<string, string> = {
  secret_missing: "Webhook à configurer",
  waiting_for_test: "Webhook en attente de test",
  received_unverified: "Notifications reçues, non vérifiables pour l’instant",
  verified: "Notifications vérifiées",
};

export default async function PaymentsPage({ params }: PageProps<"/app/[workspaceId]/paiements">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const db = getDb();
  const isAdmin = can(workspace.role, "delete");
  const canEdit = can(workspace.role, "edit");
  const [productList, orderList, hosts, setup, webhookEvents] = await Promise.all([
    listProducts(db, user.id, workspace.id),
    listOrders(db, user.id, workspace.id),
    allowedLinkHosts(db),
    isAdmin ? getWebhookSetup(db, user.id, workspace.id) : null,
    isAdmin ? listWebhookEvents(db, user.id, workspace.id) : [],
  ]);
  const events = new Map(
    await Promise.all(orderList.slice(0, 30).map(async ({ order }) => [order.id, (await getOrderForUser(db, user.id, order.id)).events] as const)),
  );
  const digital = productList.filter((p) => p.kind === "digital_file");
  const filesByProduct = new Map(await Promise.all(digital.map(async (p) => [p.id, await listProductFiles(db, user.id, p.id)] as const)));
  const digitalIds = new Set(digital.map((p) => p.id));
  const PAID = ["paid", "delivery_queued", "delivered", "delivery_failed"];
  const grants = new Map(
    await Promise.all(
      orderList
        .filter(({ order }) => order.productId && digitalIds.has(order.productId) && PAID.includes(order.status))
        .slice(0, 30)
        .map(async ({ order }) => [order.id, await listDownloadGrants(db, user.id, order.id)] as const),
    ),
  );
  const pendingOrders = orderList
    .filter(({ order }) => order.paymentMethod === "saspay_link" && (order.status === "pending" || order.status === "payment_unmatched"))
    .map(({ order }) => ({
      id: order.id,
      label: `${order.merchantTransactionId} · ${order.productName} · ${money(order.amount, order.currency)} · ${order.customerEmail} · ${dateTime.format(order.createdAt)}`,
    }));
  const toReconcile = webhookEvents.filter((e) => e.status === "to_reconcile");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Paiements</h1>
        <p className="text-sm text-muted text-pretty">
          Vos clients paient sur vos propres liens SasPay : l’argent arrive directement sur votre compte, jamais sur celui de la plateforme.
          La plateforme ne se connecte pas à votre compte SasPay et ne vous demande aucune clé API.
        </p>
      </div>

      <p role="note" className="max-w-3xl rounded-card bg-warning-soft px-4 py-3 text-sm text-warning">
        Confirmation automatique des paiements non disponible pour l’instant : le format de signature et le contenu exact des notifications SasPay
        n’ont pas encore pu être vérifiés. Une commande passe « payée » seulement quand vous la confirmez, après avoir vérifié le paiement dans votre
        tableau de bord SasPay. Aucune livraison automatique ni aucun achat Meta n’est déclenché.
      </p>

      <section aria-labelledby="products-title" className="flex flex-col gap-3">
        <h2 id="products-title" className="text-lg font-semibold">Produits et liens de paiement</h2>
        <ol className="flex max-w-3xl list-decimal flex-col gap-1 pl-5 text-sm text-muted">
          <li>Dans votre compte SasPay, créez un lien de paiement pour ce produit, à <strong className="text-fg">montant fixe</strong>, dans votre devise.</li>
          <li>Copiez l’adresse publique du lien (aucune clé API).</li>
          <li>Collez-la ci-dessous, avec le même prix et la même devise, et confirmez qu’ils correspondent.</li>
          <li>Dans l’éditeur, ajoutez une section « Commande et paiement » avec ce produit, puis publiez.</li>
        </ol>
        {hosts.length === 0 && (
          <p role="alert" className="rounded-control bg-surface-sunken px-3 py-2 text-sm">
            Les liens SasPay ne peuvent pas encore être enregistrés : l’administrateur de la plateforme doit renseigner le domaine des liens SasPay (Administration → Paramètres).
          </p>
        )}
        {productList.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
            {productList.map((p) => {
              const status = linkStatus(p, hosts);
              return (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className={`min-w-0 flex-1 truncate font-medium ${p.active ? "" : "text-muted line-through"}`}>{p.name}</span>
                    <span className="text-sm">{money(p.price, p.currency)}</span>
                    <span className="text-xs text-muted">{PRODUCT_KINDS[p.kind]}</span>
                    <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${status.ready ? "bg-success-soft text-success" : "bg-surface-sunken text-fg"}`}>{status.label}</span>
                    {canEdit && <ToggleProductButton workspaceId={workspace.id} productId={p.id} active={p.active} />}
                  </div>
                  {p.saspayLinkUrl && <p className="font-mono text-xs break-all text-muted">{p.saspayLinkUrl}</p>}
                  {p.kind === "digital_file" && (
                    <div className="flex flex-col gap-2 rounded-control bg-surface-sunken p-3">
                      <h3 className="text-xs font-semibold">Fichiers livrés à l’acheteur</h3>
                      {(filesByProduct.get(p.id) ?? []).length === 0 ? (
                        <p className="text-xs text-muted">Aucun fichier : ajoutez celui que l’acheteur doit recevoir.</p>
                      ) : (
                        <ul className="flex flex-col gap-1.5">
                          {filesByProduct.get(p.id)!.map((f) => (
                            <li key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <span className="min-w-0 font-medium [overflow-wrap:anywhere]">{f.title}</span>
                              <span className="text-xs text-muted tabular-nums">v{f.version} · {(f.sizeBytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo</span>
                              <a href={`/api/files/${f.id}`} className="text-xs text-accent underline-offset-4 hover:underline">Télécharger</a>
                              {isAdmin && <DeleteFileButton workspaceId={workspace.id} fileId={f.id} title={f.title} />}
                            </li>
                          ))}
                        </ul>
                      )}
                      {canEdit && <FileUploader productId={p.id} maxMb={MAX_FILE_BYTES / 1024 / 1024} accepted={ACCEPTED_TYPES} />}
                    </div>
                  )}
                  {canEdit && (
                    <details className="text-sm" open={!p.saspayLinkUrl && hosts.length > 0}>
                      <summary className="cursor-pointer text-accent">{p.saspayLinkUrl ? "Modifier le lien SasPay" : "Ajouter le lien SasPay"}</summary>
                      <div className="mt-3 flex flex-col gap-3">
                        <LinkForm workspaceId={workspace.id} product={p} />
                        {p.saspayLinkUrl && <RemoveLinkButton workspaceId={workspace.id} productId={p.id} />}
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {canEdit && <ProductForm workspaceId={workspace.id} kinds={Object.entries(PRODUCT_KINDS)} />}
        <p className="text-xs text-muted">
          L’acheteur laisse son nom et son e-mail sur votre page, une commande « en attente » est créée, puis il est envoyé sur votre lien SasPay.
          Revenir sur une page de remerciement ne prouve pas qu’il a payé.
        </p>
      </section>

      {setup && (
        <section aria-labelledby="webhook-title" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="webhook-title" className="text-lg font-semibold">Notifications SasPay (webhook)</h2>
            <span className="inline-flex h-5 items-center rounded-full bg-surface-sunken px-2 text-xs font-medium">{WEBHOOK_STATE[setup.state]}</span>
          </div>
          <div className="flex max-w-3xl flex-col gap-4 rounded-card border border-border bg-surface p-4 shadow-raised">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-muted">
              <li>Dans votre tableau de bord SasPay, ajoutez un webhook avec l’adresse ci-dessous et l’événement de transaction réussie, si cette option est proposée sur votre compte.</li>
              <li>Copiez le secret de signature affiché par SasPay (il n’est souvent montré qu’une fois) et collez-le ici.</li>
              <li>Envoyez une notification de test depuis SasPay : elle apparaîtra dans la liste « à rapprocher ».</li>
            </ol>
            {setup.url ? (
              <CopyField label="Adresse de notification (propre à votre espace)" value={setup.url} />
            ) : (
              <p role="alert" className="text-sm text-danger">Adresse indisponible : l’adresse publique de l’application (APP_URL) n’est pas configurée.</p>
            )}
            <div className="flex flex-wrap gap-2"><RotateUrlButton workspaceId={workspace.id} /></div>
            <p className="text-sm">
              Secret de signature : {setup.hasSecret ? <strong>enregistré (chiffré)</strong> : <strong>absent</strong>}
              {setup.secretUpdatedAt ? ` · modifié le ${dateTime.format(setup.secretUpdatedAt)} UTC` : ""}
              {setup.lastEventAt ? ` · dernière notification le ${dateTime.format(setup.lastEventAt)} UTC` : " · aucune notification reçue"}
            </p>
            <SecretForm workspaceId={workspace.id} hasSecret={setup.hasSecret} />
            {setup.hasSecret && <div><ClearSecretButton workspaceId={workspace.id} /></div>}
            <p className="text-xs text-muted">Secret perdu ? Régénérez-le dans votre tableau de bord SasPay puis collez le nouveau ici : il ne peut pas être relu.</p>
          </div>

          <h3 className="mt-2 text-base font-semibold">À rapprocher ({toReconcile.length})</h3>
          {toReconcile.length === 0 ? (
            <p className="text-sm text-muted">Aucune notification en attente.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {toReconcile.map((e) => (
                <li key={e.id} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
                  <p className="text-sm">
                    Reçue le {dateTime.format(e.receivedAt)} UTC
                    {e.eventType ? ` · type annoncé : ${e.eventType}` : ""}
                    {e.transactionRef ? ` · référence annoncée : ${e.transactionRef}` : ""}
                    <span className="block text-xs text-muted">
                      {e.verification === "no_secret" ? "Reçue sans secret enregistré." : "Signature non vérifiable pour l’instant."} Contenu non vérifié : contrôlez-le dans SasPay avant de rapprocher.
                    </span>
                  </p>
                  <RawBody body={e.rawBody} />
                  <ReconcileForm workspaceId={workspace.id} eventId={e.id} orders={pendingOrders} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="orders-title" className="flex flex-col gap-3">
        <h2 id="orders-title" className="text-lg font-semibold">Commandes</h2>
        {orderList.length === 0 ? (
          <p className="text-sm text-muted">Aucune commande pour l’instant.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
            {orderList.map(({ order, funnelName, pageName }) => (
              <li key={order.id} className="flex flex-col gap-1.5 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium">{order.productName}</span>
                  <span className="text-sm">{money(order.amount, order.currency)}</span>
                  <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${ORDER_STATUS[order.status].className}`}>
                    {ORDER_STATUS[order.status].label}{order.paidVia ? ` (${PAID_VIA[order.paidVia] ?? order.paidVia})` : ""}
                  </span>
                  {isAdmin && order.paymentMethod === "saspay_link" && order.status === "pending" && (
                    <>
                      <ConfirmPaidButton workspaceId={workspace.id} orderId={order.id} label={order.merchantTransactionId} />
                      <CancelOrderButton workspaceId={workspace.id} orderId={order.id} />
                    </>
                  )}
                </div>
                <p className="text-xs text-muted">
                  {dateTime.format(order.createdAt)} UTC · {order.customerFirstName} {order.customerLastName} · {order.customerEmail}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ""} · {funnelName ?? "—"} / {pageName ?? "—"}
                  {order.variantLabel ? ` (variante ${order.variantLabel})` : ""} · réf. <span className="font-mono">{order.merchantTransactionId}</span>
                  {order.paymentMethod === "cinetpay" ? " · ancienne intégration CinetPay" : ""}
                </p>
                {grants.has(order.id) && (
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && <DownloadLinksButton workspaceId={workspace.id} orderId={order.id} />}
                      <span className="text-muted">{grants.get(order.id)!.length === 0 ? "Aucun lien de téléchargement créé." : ""}</span>
                    </div>
                    {grants.get(order.id)!.map((g) => (
                      <p key={g.id} className="text-muted">
                        {g.title} · {g.downloads}/{g.maxDownloads} téléchargement{g.maxDownloads > 1 ? "s" : ""} ·{" "}
                        {g.revokedAt ? "révoqué" : `expire le ${dateTime.format(g.expiresAt)} UTC`}
                        {isAdmin && !g.revokedAt && <> · <RevokeGrantButton workspaceId={workspace.id} grantId={g.id} /></>}
                      </p>
                    ))}
                  </div>
                )}
                {events.get(order.id) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">Historique</summary>
                    <ol className="mt-1 flex flex-col gap-0.5 text-muted">
                      {events.get(order.id)!.map((e) => (
                        <li key={e.id}>
                          {dateTime.format(e.createdAt)} · {EVENT_LABELS[e.kind] ?? e.kind}
                          {e.detail ? ` · ${e.detail}` : ""}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted">Remboursements : à faire depuis votre compte SasPay ; la plateforme ne peut ni les lancer ni les constater.</p>
      </section>
    </div>
  );
}
