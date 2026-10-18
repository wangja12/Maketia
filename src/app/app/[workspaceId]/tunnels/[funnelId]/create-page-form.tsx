"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormError } from "@/components/ui/form-error";
import { PAGE_KIND_LABELS } from "@/server/page-templates";
import { createPageAction } from "./actions";

const control =
  "h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] shadow-raised transition-[border-color] duration-150 placeholder:text-muted aria-invalid:border-danger sm:h-9 sm:text-sm";

export function CreatePageForm({ funnelId }: { funnelId: string }) {
  const [state, action] = useActionState(createPageAction.bind(null, funnelId), {});
  const v = state.values ?? {};
  return (
    <form action={action} className="flex flex-col gap-3 rounded-card border border-border p-4" noValidate>
      <h3 className="text-sm font-semibold">Nouvelle page</h3>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-name" className="text-sm font-medium">Nom</label>
          <input id="page-name" name="name" required maxLength={80} placeholder="Ex. Page de vente" defaultValue={v.name} key={`n-${v.name}`}
            aria-invalid={state.fieldErrors?.name ? true : undefined} className={control} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="page-kind" className="text-sm font-medium">Modèle</label>
          <select id="page-kind" name="kind" defaultValue={v.kind || "sales"} key={`k-${v.kind}`} className={control}>
            {(Object.keys(PAGE_KIND_LABELS) as (keyof typeof PAGE_KIND_LABELS)[]).map((k) => (
              <option key={k} value={k}>{PAGE_KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <SubmitButton>Créer la page</SubmitButton>
      </div>
      {state.fieldErrors?.name && <p role="alert" className="text-xs text-danger">{state.fieldErrors.name}</p>}
    </form>
  );
}
