import type { Metadata } from "next";
import { getDb } from "@/db";
import { publicOrderStatus } from "@/server/payments/service";
import { money } from "@/lib/format";

export const metadata: Metadata = { title: "Votre paiement", robots: { index: false, follow: false } };

/**
 * Order status for a buyer. Arriving here proves nothing: the status shown is the stored one,
 * and "confirmed" appears only once the payment was verified (never because of this visit).
 */
export default async function PaymentReturn({ searchParams }: PageProps<"/paiement/retour">) {
  const { commande } = await searchParams;
  const order = typeof commande === "string" ? await publicOrderStatus(getDb(), commande) : null;

  let title: string;
  let body: string;
  if (!order) {
    title = "Commande introuvable";
    body = "Ce lien ne correspond à aucune commande.";
  } else if (["paid", "delivery_queued", "delivered", "delivery_failed"].includes(order.status)) {
    title = "Paiement confirmé";
    body = `Merci ! Votre paiement de ${money(order.amount, order.currency)} pour « ${order.productName} » est confirmé.`;
  } else if (order.status === "pending" || order.status === "started" || order.status === "payment_unmatched") {
    title = "Paiement en cours de vérification";
    body = "Votre commande est enregistrée. Elle sera confirmée dès que le paiement aura été vérifié ; vous pouvez fermer cette page.";
  } else {
    title = "Paiement non abouti";
    body = "Le paiement n’a pas été confirmé. Si un montant a été débité, il sera traité par le prestataire de paiement. Vous pouvez réessayer depuis la page de l’offre.";
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted text-pretty">{body}</p>
      {order && <p className="font-mono text-xs text-muted">Référence : {order.reference}</p>}
    </main>
  );
}
