"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { addDomainAction, removeDomainAction, setSubdomainAction, verifyDomainAction } from "./actions";

const control =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:h-8 sm:text-sm";

export function SubdomainForm({ funnelId, subdomain, suffix }: { funnelId: string; subdomain: string | null; suffix: string }) {
  const id = useId();
  const [state, action] = useActionState(setSubdomainAction.bind(null, funnelId), {});
  const value = state.values?.subdomain ?? subdomain ?? "";
  return (
    <form action={action} className="flex flex-col gap-1.5" noValidate>
      <label htmlFor={id} className="text-xs font-medium">Sous-domaine</label>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-sm">
          <input id={id} name="subdomain" defaultValue={value} key={value} placeholder="mon-offre" maxLength={32}
            aria-invalid={state.fieldErrors?.subdomain ? true : undefined} aria-describedby={`${id}-help`} className={control} />
          <span className="shrink-0 text-muted">{suffix}</span>
        </div>
        <SubmitButton variant="secondary" className="h-8">Changer</SubmitButton>
      </div>
      <p id={`${id}-help`} className={`text-xs ${state.fieldErrors?.subdomain || state.error ? "text-danger" : "text-muted"}`}>
        {state.fieldErrors?.subdomain ?? state.error ?? (state.ok ? "Sous-domaine enregistré. L’ancienne adresse ne fonctionne plus." : "Attribué automatiquement à la première publication si vide.")}
      </p>
    </form>
  );
}

export function AddDomainForm({ funnelId }: { funnelId: string }) {
  const id = useId();
  const [state, action] = useActionState(addDomainAction.bind(null, funnelId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5" noValidate>
      <label htmlFor={id} className="text-xs font-medium">Ajouter un domaine</label>
      <div className="flex gap-2">
        <input id={id} name="hostname" placeholder="www.mon-site.com" defaultValue={state.ok ? "" : state.values?.hostname}
          key={state.ok ? "done" : state.values?.hostname} aria-invalid={state.fieldErrors?.hostname ? true : undefined} className={control} />
        <SubmitButton variant="secondary" className="h-8">Ajouter</SubmitButton>
      </div>
      {(state.fieldErrors?.hostname || state.error) && <p role="alert" className="text-xs text-danger">{state.fieldErrors?.hostname ?? state.error}</p>}
    </form>
  );
}

export function VerifyDomainButton({ domainId }: { domainId: string }) {
  const [state, action] = useActionState(verifyDomainAction.bind(null, domainId), {});
  return (
    <form action={action}>
      <SubmitButton variant="secondary" className="h-8">Vérifier maintenant</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function RemoveDomainButton({ domainId, hostname }: { domainId: string; hostname: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(removeDomainAction.bind(null, domainId), {});
  return (
    <>
      <Button variant="ghost" className="h-8 text-danger!" onClick={() => setOpen(true)}>Retirer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Retirer ${hostname} ?`} description="Le domaine cessera immédiatement d’afficher tes pages. Les enregistrements DNS restent chez ton registraire.">
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
