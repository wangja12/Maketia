import type { Metadata } from "next";
import { getDb } from "@/db";
import type { Order } from "@/db/schema";
import { CINETPAY_COUNTRIES } from "@/server/payments/cinetpay";
import { getOrderForUser, listOrders, listProducts, listProviders } from "@/server/payments/service";
import { can } from "@/server/workspaces";
import { loadWorkspace } from "../workspace";
import { ProductForm, ProviderForm, RefreshOrderButton, RemoveProviderButton, ToggleProductButton, VerifyProviderButton } from "./forms";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Paiements · Tunnels IA" };

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const ORDER_STATUS: Record<Order["status"], { label: string; className: string }> = {
  started: { label: "Commencée", className: "bg-surface-sunken text-muted" },
  pending: { label: "Paiement en attente", className: "bg-surface-sunken text-fg" },
  paid: { label: "Payée (confirmée)", className: "bg-success-soft text-success" },
  failed: { label: "Échouée", className: "bg-danger-soft text-danger" },
  expired: { label: "Expirée", className: "bg-surface-sunken text-muted" },
};

const PROVIDER_STATUS = {
  unverified: { label: "Non vérifié", className: "bg-surface-sunken text-muted" },
  verified: { label: "Connexion vérifiée", className: "bg-success-soft text-success" },
  failed: { label: "Échec de connexion", className: "bg-danger-soft text-danger" },
} as const;

const EVENT_LABELS: Record<string, string> = {
  order_created: "Commande créée",
  payment_initiated: "Paiement initialisé chez le prestataire",
  webhook_received: "Notification reçue (authentifiée)",
  webhook_rejected: "Notification rejetée",
  status_changed: "Statut confirmé par le prestataire",
  error: "Erreur",
};

export default async function PaymentsPage({ params }: PageProps<"/app/[workspaceId]/paiements">) {
  const { workspaceId } = await params;
  const { user, workspace } = await loadWorkspace(workspaceId);
  const db = getDb();
  const [providers, productList, orderList] = await Promise.all([
    listProviders(db, user.id, workspace.id),
    listProducts(db, user.id, workspace.id),
    listOrders(db, user.id, workspace.id),
  ]);
  const events = new Map(
    await Promise.all(orderList.slice(0, 30).map(async ({ order }) => [order.id, (await getOrderForUser(db, user.id, order.id)).events] as const)),
  );
  const isAdmin = can(workspace.role, "delete");
  const canEdit = can(workspace.role, "edit");
  const countries = Object.entries(CINETPAY_COUNTRIES).map(([code, c]) => ({ code, name: c.name, currency: c.currency }));
  const currencies = [...new Set(countries.map((c) => c.currency))];
  const keyMissing = !process.env.PAYMENT_SECRETS_KEY;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Paiements</h1>
        <p className="text-sm text-muted text-pretty">
          Les paiements de vos clients sont encaissés directement sur votre compte marchand. Une commande n’est marquée
          « payée » qu’après confirmation par l’API du prestataire, jamais sur la seule foi d’une redirection ou d’une notification.
        </p>
      </div>

      <section aria-labelledby="provider-title" className="flex flex-col gap-3">
        <h2 id="provider-title" className="text-lg font-semibold">Prestataire de paiement</h2>
        <p className="rounded-control bg-surface-sunken px-3 py-2 text-xs text-muted">
          CinetPay (Afrique de l’Ouest et centrale : mobile money et cartes selon les opérateurs activés sur votre compte).
          Intégration écrite d’après le SDK officiel CinetPay (commit 422244a, août 2026) ; elle n’a pas encore été testée
          avec un vrai compte marchand. Testez d’abord en bac à sable.
        </p>
        {providers.length === 0 ? (
          <p className="text-sm text-muted">Aucun compte configuré : les formulaires de commande ne peuvent pas être publiés.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
            {providers.map((p) => {
              const c = CINETPAY_COUNTRIES[p.country as keyof typeof CINETPAY_COUNTRIES];
              return (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">CinetPay · {c?.name ?? p.country} · {c?.currency}</span>
                      <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${PROVIDER_STATUS[p.status].className}`}>{PROVIDER_STATUS[p.status].label}</span>
                      <span className="text-xs text-muted">{p.environment === "sandbox" ? "Bac à sable" : "Production"}</span>
                    </div>
                    {p.lastError && <p role="alert" className="text-xs text-danger">{p.lastError}</p>}
                    <span className="text-xs text-muted">{p.lastCheckedAt ? `Vérifié le ${dateTime.format(p.lastCheckedAt)} UTC` : "Jamais vérifié"}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-2">
                      <VerifyProviderButton workspaceId={workspace.id} providerId={p.id} />
                      <RemoveProviderButton workspaceId={workspace.id} providerId={p.id} label={c?.name ?? p.country} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {isAdmin && (
          <details className="rounded-card border border-border bg-surface p-4 shadow-raised" open={providers.length === 0}>
            <summary className="cursor-pointer text-sm font-semibold">{providers.length === 0 ? "Connecter un compte CinetPay" : "Ajouter ou remplacer un compte"}</summary>
            <div className="mt-3">
              {keyMissing ? (
                <p role="alert" className="text-sm text-danger">Configuration serveur incomplète : PAYMENT_SECRETS_KEY manquante. Les identifiants ne peuvent pas être enregistrés.</p>
              ) : (
                <ProviderForm workspaceId={workspace.id} countries={countries} />
              )}
            </div>
          </details>
        )}
      </section>

      <section aria-labelledby="products-title" className="flex flex-col gap-3">
        <h2 id="products-title" className="text-lg font-semibold">Produits</h2>
        {productList.length > 0 && (
          <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-raised">
            {productList.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className={`min-w-0 flex-1 truncate font-medium ${p.active ? "" : "text-muted line-through"}`}>{p.name}</span>
                <span className="text-sm">{money(p.price, p.currency)}</span>
                {!p.active && <span className="text-xs text-muted">désactivé</span>}
                {canEdit && <ToggleProductButton workspaceId={workspace.id} productId={p.id} active={p.active} />}
              </li>
            ))}
          </ul>
        )}
        {canEdit && <ProductForm workspaceId={workspace.id} currencies={currencies} />}
        <p className="text-xs text-muted">Ajoutez ensuite une section « Commande et paiement » à une page, dans l’éditeur.</p>
      </section>

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
                  <span className={`inline-flex h-5 items-center rounded-full px-2 text-xs font-medium ${ORDER_STATUS[order.status].className}`}>{ORDER_STATUS[order.status].label}</span>
                  {order.providerStatus && <span className="font-mono text-xs text-muted">{order.providerStatus}</span>}
                  {canEdit && (order.status === "pending" || order.status === "started") && <RefreshOrderButton workspaceId={workspace.id} orderId={order.id} />}
                </div>
                <p className="text-xs text-muted">
                  {dateTime.format(order.createdAt)} UTC · {order.customerFirstName} {order.customerLastName} · {order.customerEmail}
                  {order.customerPhone ? ` · ${order.customerPhone}` : ""} · {funnelName ?? "—"} / {pageName ?? "—"}
                  {order.variantLabel ? ` (variante ${order.variantLabel})` : ""} · réf. <span className="font-mono">{order.merchantTransactionId}</span>
                </p>
                {events.get(order.id) && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted">Historique du paiement</summary>
                    <ol className="mt-1 flex flex-col gap-0.5 text-muted">
                      {events.get(order.id)!.map((e) => (
                        <li key={e.id}>
                          {dateTime.format(e.createdAt)} · {EVENT_LABELS[e.kind] ?? e.kind}
                          {e.providerStatus ? ` · ${e.providerStatus}` : ""}
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
        <p className="text-xs text-muted">Remboursements : non pris en charge par cette intégration (l’API CinetPay utilisée ne les expose pas) ; à traiter depuis votre espace marchand.</p>
      </section>
    </div>
  );
}
