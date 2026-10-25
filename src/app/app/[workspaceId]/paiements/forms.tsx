"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { deliveryMessage, whatsappShareUrl } from "@/lib/whatsapp";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import {
  cancelOrderAction,
  clearSecretAction,
  confirmAndPrepareAction,
  createProductAction,
  ignoreEventAction,
  reconcileAction,
  removeLinkAction,
  rotateUrlAction,
  saveLinkAction,
  saveSecretAction,
  toggleProductAction,
  type LinksState,
} from "./actions";

const select = "h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] shadow-raised sm:h-9 sm:text-sm";
const textarea = "rounded-control border border-border-strong bg-surface p-2.5 text-[16px] shadow-raised sm:text-sm";

export function ProductForm({ workspaceId, kinds }: { workspaceId: string; kinds: [string, string][] }) {
  const id = useId();
  const [state, action] = useActionState(createProductAction.bind(null, workspaceId), {});
  const v = state.ok ? {} : (state.values ?? {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_8rem_6rem_12rem_auto] sm:items-end" noValidate>
      <TextField label="Nom du produit" name="name" defaultValue={v.name} key={`n${v.name}${state.ok}`} error={fe.name} />
      <TextField label="Prix" name="price" inputMode="numeric" defaultValue={v.price} key={`p${v.price}${state.ok}`} error={fe.price} />
      <TextField label="Devise" name="currency" defaultValue={v.currency ?? "XOF"} key={`c${v.currency}${state.ok}`} maxLength={3} error={fe.currency} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-kind`} className="text-sm font-medium">Type</label>
        <select id={`${id}-kind`} name="kind" defaultValue={v.kind ?? "no_delivery"} className={select}>
          {kinds.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <SubmitButton>Ajouter</SubmitButton>
      {state.error && !state.fieldErrors && <p className="text-xs text-danger sm:col-span-5">{state.error}</p>}
    </form>
  );
}

export function ToggleProductButton({ workspaceId, productId, active }: { workspaceId: string; productId: string; active: boolean }) {
  const [state, action] = useActionState(toggleProductAction.bind(null, workspaceId, productId, !active), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-8">{active ? "Désactiver" : "Réactiver"}</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

/** The seller pastes the public link they created in SasPay and confirms the price matches. */
export function LinkForm({
  workspaceId,
  product,
}: {
  workspaceId: string;
  product: { id: string; name: string; price: number; currency: string; saspayLinkUrl: string | null; phoneRequired: boolean };
}) {
  const id = useId();
  const [state, action] = useActionState(saveLinkAction.bind(null, workspaceId, product.id), {});
  const fe = state.fieldErrors ?? {};
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <TextField label="Lien public SasPay du produit" name="url" type="url" placeholder="https://…" defaultValue={v.url ?? product.saspayLinkUrl ?? ""} error={fe.url}
        hint="Copie l’adresse du lien créé dans ton compte SasPay. Aucune clé API n’est demandée." />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Prix fixé sur le lien SasPay" name="price" inputMode="numeric" defaultValue={v.price ?? String(product.price)} error={fe.price} />
        <TextField label="Devise du lien SasPay" name="currency" maxLength={3} defaultValue={v.currency ?? product.currency} error={fe.currency} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="phoneRequired" defaultChecked={product.phoneRequired} className="mt-0.5 accent-[var(--accent)]" />
        <span>Demander le téléphone de l’acheteur<span className="block text-xs text-muted">Utile pour retrouver son paiement dans ton tableau de bord SasPay.</span></span>
      </label>
      <label htmlFor={`${id}-ok`} className="flex items-start gap-2 text-sm">
        <input id={`${id}-ok`} type="checkbox" name="confirmed" aria-invalid={fe.confirmed ? true : undefined} className="mt-0.5 accent-[var(--accent)]" />
        <span>
          Je confirme que ce lien SasPay est à montant fixe, avec exactement ce prix et cette devise.
          <span className="block text-xs text-muted">La plateforme ne peut pas le vérifier : si tu changes le prix dans SasPay, change-le aussi ici.</span>
        </span>
      </label>
      {fe.confirmed && <p className="text-xs text-danger">{fe.confirmed}</p>}
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton className="w-fit">Enregistrer le lien</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? "Lien enregistré." : ""}</p>
      </div>
    </form>
  );
}

export function RemoveLinkButton({ workspaceId, productId }: { workspaceId: string; productId: string }) {
  const [state, action] = useActionState(removeLinkAction.bind(null, workspaceId, productId), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-8 text-danger!">Retirer le lien</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <input id={id} readOnly value={value} onFocus={(e) => e.currentTarget.select()} className={`${select} min-w-0 font-mono text-xs!`} />
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          }}
        >
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
    </div>
  );
}

export function SecretForm({ workspaceId, hasSecret }: { workspaceId: string; hasSecret: boolean }) {
  const [state, action] = useActionState(saveSecretAction.bind(null, workspaceId), {});
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <TextField
        label={hasSecret ? "Remplacer le secret de signature" : "Secret de signature du webhook"}
        name="secret"
        type="password"
        autoComplete="off"
        key={state.ok ? "done" : "edit"}
        error={state.fieldErrors?.secret ?? (state.fieldErrors ? undefined : state.error)}
        hint="Le secret affiché par SasPay à la création du webhook. Ce n’est pas ta clé API : ne colle jamais une clé sk_live ou sk_test."
      />
      <div className="flex items-center gap-3">
        <SubmitButton className="w-fit">Enregistrer le secret</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? "Secret enregistré, chiffré. Il ne sera plus affiché." : ""}</p>
      </div>
    </form>
  );
}

export function ClearSecretButton({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState(clearSecretAction.bind(null, workspaceId), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-8 text-danger!">Supprimer le secret</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function RotateUrlButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(rotateUrlAction.bind(null, workspaceId), {});
  return (
    <>
      <Button variant="ghost" className="h-8" onClick={() => setOpen(true)}>Changer d’adresse</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Générer une nouvelle adresse ?" description="L’adresse actuelle cessera aussitôt de fonctionner. Tu devras coller la nouvelle dans ton tableau de bord SasPay.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton>Générer</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

const ATTESTATION = "J’ai vérifié dans mon tableau de bord SasPay que ce paiement est réussi, du bon montant, et qu’il vient de cet acheteur.";

type Buyer = { firstName: string | null; phone: string | null };

/** The buyer's links, shown once: one tap hands them to WhatsApp, or copy them. */
export function SendLinks({ links, days, maxDownloads, buyer }: { links: { title: string; url: string }[]; days: number; maxDownloads?: number; buyer: Buyer }) {
  return (
    <div className="flex flex-col gap-3">
      <a
        href={whatsappShareUrl(buyer.phone, deliveryMessage(buyer.firstName, links, days))}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClass("primary", "h-11 w-full")}
      >
        Envoyer sur WhatsApp
      </a>
      <p className="text-xs text-muted">
        WhatsApp s’ouvre avec le message prêt{buyer.phone ? "" : " ; choisis l’acheteur dans tes contacts"}. Rien n’est envoyé tant que tu n’appuies pas sur « Envoyer » dans WhatsApp.
      </p>
      {links.map((l) => <CopyField key={l.url} label={l.title} value={l.url} />)}
      <p className="text-xs text-muted">Valables {days} jours{maxDownloads ? `, ${maxDownloads} téléchargements chacun` : ""}. Ils ne s’affichent qu’une fois.</p>
    </div>
  );
}

/** Confirm a payment checked in SasPay, and prepare the buyer's delivery in the same step. */
export function ConfirmPaidButton({ workspaceId, orderId, label, buyer }: { workspaceId: string; orderId: string; label: string; buyer: Buyer }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LinksState, FormData>(confirmAndPrepareAction.bind(null, workspaceId, orderId), {});
  const close = () => {
    setOpen(false);
    if (state.ok) router.refresh();
  };
  return (
    <>
      <Button className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>Confirmer et envoyer</Button>
      <Dialog open={open} onClose={close} title={state.ok ? "Paiement confirmé" : `Confirmer le paiement de ${label} ?`}
        description={state.ok ? undefined : "La commande passera à « payée (confirmée par toi) » et le lien de téléchargement de l’acheteur sera préparé. Cette action est enregistrée à ton nom. Aucun événement n’est envoyé à Meta."}>
        {state.ok ? (
          <div className="flex flex-col gap-4">
            {state.links ? (
              <SendLinks links={state.links} days={state.days ?? 7} maxDownloads={state.maxDownloads} buyer={buyer} />
            ) : (
              <p role="status" className="text-sm">Paiement confirmé. {state.notice ?? ""}</p>
            )}
            <div className="flex justify-end"><Button variant="secondary" onClick={close}>Fermer</Button></div>
          </div>
        ) : (
          <form action={action} className="flex flex-col gap-4">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="attested" className="mt-0.5 accent-[var(--accent)]" />
              <span>{ATTESTATION}</span>
            </label>
            <div className="flex flex-col gap-1">
              <label htmlFor={`${id}-note`} className="text-sm font-medium">Référence SasPay ou note (facultatif)</label>
              <input id={`${id}-note`} name="note" maxLength={300} className={select} />
            </div>
            <FormError message={state.error} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={close}>Fermer</Button>
              <SubmitButton>Confirmer et préparer l’envoi</SubmitButton>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

export function CancelOrderButton({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const [state, action] = useActionState(cancelOrderAction.bind(null, workspaceId, orderId), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-7 px-2 text-xs">Annuler</SubmitButton>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function ReconcileForm({ workspaceId, eventId, orders }: { workspaceId: string; eventId: number; orders: { id: string; label: string }[] }) {
  const id = useId();
  const [state, action] = useActionState(reconcileAction.bind(null, workspaceId, eventId), {});
  const [ignoreState, ignore] = useActionState(ignoreEventAction.bind(null, workspaceId, eventId), {});
  return (
    <div className="flex flex-col gap-3">
      <form action={action} className="flex flex-col gap-2">
        <label htmlFor={`${id}-order`} className="text-xs font-medium">Commande correspondante</label>
        <select id={`${id}-order`} name="orderId" className={select} disabled={orders.length === 0}>
          {orders.length === 0 ? <option>Aucune commande en attente</option> : orders.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <label className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="attested" className="mt-0.5 accent-[var(--accent)]" />
          <span>{ATTESTATION}</span>
        </label>
        <input name="note" placeholder="Note (facultatif)" maxLength={300} className={select} />
        <FormError message={state.error} />
        <SubmitButton variant="secondary" className="w-fit" disabled={orders.length === 0}>Rapprocher et confirmer</SubmitButton>
      </form>
      <form action={ignore} className="flex flex-wrap items-center gap-2">
        <input name="note" placeholder="Pourquoi l’ignorer ? (ex. vente hors offre)" maxLength={300} className={`${select} max-w-sm`} />
        <SubmitButton variant="ghost" className="h-8">Ignorer</SubmitButton>
        <FormError message={ignoreState.error} />
      </form>
    </div>
  );
}

export function RawBody({ body }: { body: string }) {
  return <pre tabIndex={0} className={`${textarea} max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]`}>{body}</pre>;
}
