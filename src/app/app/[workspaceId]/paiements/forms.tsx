"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import {
  createProductAction,
  refreshOrderAction,
  removeProviderAction,
  saveProviderAction,
  toggleProductAction,
  verifyProviderAction,
} from "./actions";

const select = "h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] shadow-raised sm:h-9 sm:text-sm";

export function ProviderForm({ workspaceId, countries }: { workspaceId: string; countries: { code: string; name: string; currency: string }[] }) {
  const id = useId();
  const [state, action] = useActionState(saveProviderAction.bind(null, workspaceId), {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-country`} className="text-sm font-medium">Pays du compte marchand</label>
          <select id={`${id}-country`} name="country" defaultValue={state.values?.country ?? "CI"} className={select}>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.currency})</option>)}
          </select>
          {fe.country && <p className="text-xs text-danger">{fe.country}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-env`} className="text-sm font-medium">Environnement</label>
          <select id={`${id}-env`} name="environment" defaultValue={state.values?.environment ?? "sandbox"} className={select}>
            <option value="sandbox">Test (bac à sable)</option>
            <option value="production">Production</option>
          </select>
        </div>
      </div>
      <TextField label="Clé API (api_key)" name="apiKey" autoComplete="off" error={fe.apiKey} key={state.ok ? "k-done" : "k"} />
      <TextField label="Mot de passe API (api_password)" name="apiPassword" type="password" autoComplete="new-password" error={fe.apiPassword} key={state.ok ? "p-done" : "p"} />
      <p className="text-xs text-muted">Chiffrés avant enregistrement (AES-256-GCM), jamais réaffichés. Un compte CinetPay correspond à un pays.</p>
      <SubmitButton className="w-fit">Enregistrer le compte</SubmitButton>
      <p role="status" className="text-xs text-success">{state.ok ? "Compte enregistré. Vérifiez maintenant la connexion." : ""}</p>
    </form>
  );
}

export function VerifyProviderButton({ workspaceId, providerId }: { workspaceId: string; providerId: string }) {
  const [state, action] = useActionState(verifyProviderAction.bind(null, workspaceId, providerId), {});
  return (
    <form action={action}>
      <SubmitButton variant="secondary" className="h-8">Vérifier la connexion</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function RemoveProviderButton({ workspaceId, providerId, label }: { workspaceId: string; providerId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(removeProviderAction.bind(null, workspaceId, providerId), {});
  return (
    <>
      <Button variant="ghost" className="h-8 text-danger!" onClick={() => setOpen(true)}>Retirer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Retirer le compte ${label} ?`} description="Les formulaires de commande dans cette devise ne pourront plus encaisser. Les commandes existantes restent consultables.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Retirer</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ProductForm({ workspaceId, currencies }: { workspaceId: string; currencies: string[] }) {
  const id = useId();
  const [state, action] = useActionState(createProductAction.bind(null, workspaceId), {});
  const v = state.ok ? {} : (state.values ?? {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_9rem_7rem_auto] sm:items-end" noValidate>
      <TextField label="Nom du produit" name="name" defaultValue={v.name} key={`n${v.name}${state.ok}`} error={fe.name} />
      <TextField label="Prix" name="price" inputMode="numeric" defaultValue={v.price} key={`p${v.price}${state.ok}`} error={fe.price} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-cur`} className="text-sm font-medium">Devise</label>
        <select id={`${id}-cur`} name="currency" defaultValue={v.currency ?? "XOF"} className={select}>
          {currencies.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <SubmitButton>Ajouter</SubmitButton>
      {(fe.currency || (state.error && !state.fieldErrors)) && <p className="text-xs text-danger sm:col-span-4">{fe.currency ?? state.error}</p>}
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

export function RefreshOrderButton({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const [state, action] = useActionState(refreshOrderAction.bind(null, workspaceId, orderId), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-7 px-2 text-xs">Vérifier le statut</SubmitButton>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
