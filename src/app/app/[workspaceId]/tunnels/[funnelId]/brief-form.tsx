"use client";

import { useActionState, useId } from "react";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { PRODUCT_TYPE_LABELS, type FunnelBrief } from "@/server/brief";
import { saveBriefAction } from "./actions";

const control =
  "w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] shadow-raised transition-[border-color] duration-150 placeholder:text-muted aria-invalid:border-danger disabled:opacity-60 sm:text-sm";

type Field = { name: keyof FunnelBrief; label: string; placeholder?: string; rows?: number };

const FIELDS: Field[] = [
  { name: "productName", label: "Nom du produit ou de l’offre" },
  { name: "audience", label: "Public cible", placeholder: "Ex. commerçants qui débutent sur Excel", rows: 2 },
  { name: "problem", label: "Problème principal du client", rows: 2 },
  { name: "promise", label: "Promesse commerciale", rows: 2 },
  { name: "benefits", label: "Bénéfices", placeholder: "Un par ligne", rows: 3 },
  { name: "goal", label: "Objectif de l’offre", placeholder: "Ex. vendre l’e-book, récolter des contacts" },
  { name: "style", label: "Style visuel souhaité", placeholder: "Ex. sobre, couleurs chaudes" },
  { name: "notes", label: "Description libre et témoignages réels", placeholder: "Colle ici les vrais témoignages que tu autorises à utiliser.", rows: 4 },
];

export function BriefForm({ funnelId, brief, readOnly }: { funnelId: string; brief: FunnelBrief | null; readOnly: boolean }) {
  const [state, action] = useActionState(saveBriefAction.bind(null, funnelId), {});
  const id = useId();
  const v: Partial<Record<keyof FunnelBrief, string>> = state.values ?? brief ?? {};
  const fe = state.fieldErrors ?? {};
  // Remount fields when the saved values change so defaultValue stays in sync.
  const k = JSON.stringify(v);

  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <fieldset disabled={readOnly} className="flex flex-col gap-3">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-type`} className="text-sm font-medium">Type de produit</label>
            <select id={`${id}-type`} name="productType" defaultValue={v.productType ?? "autre"} key={`t${k}`} className={`${control} h-10 sm:h-9`}>
              {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-currency`} className="text-sm font-medium">Devise</label>
            <input id={`${id}-currency`} name="currency" maxLength={3} placeholder="XOF" defaultValue={v.currency} key={`c${k}`}
              aria-invalid={fe.currency ? true : undefined} aria-describedby={fe.currency ? `${id}-currency-err` : undefined}
              className={`${control} h-10 uppercase sm:h-9`} />
          </div>
        </div>
        {fe.currency && <p id={`${id}-currency-err`} className="-mt-1 text-xs text-danger">{fe.currency}</p>}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-price`} className="text-sm font-medium">Prix</label>
          <input id={`${id}-price`} name="price" maxLength={40} placeholder="Ex. 15 000" defaultValue={v.price} key={`p${k}`} className={`${control} h-10 sm:h-9`} />
        </div>
        {FIELDS.map((f) => (
          <div key={f.name} className="flex flex-col gap-1.5">
            <label htmlFor={`${id}-${f.name}`} className="text-sm font-medium">{f.label}</label>
            {f.rows ? (
              <textarea id={`${id}-${f.name}`} name={f.name} rows={f.rows} placeholder={f.placeholder} defaultValue={v[f.name]} key={`${f.name}${k}`}
                className={`${control} resize-y py-2`} />
            ) : (
              <input id={`${id}-${f.name}`} name={f.name} placeholder={f.placeholder} defaultValue={v[f.name]} key={`${f.name}${k}`}
                className={`${control} h-10 sm:h-9`} />
            )}
          </div>
        ))}
      </fieldset>
      {!readOnly && (
        <div className="flex items-center gap-3">
          <SubmitButton>Enregistrer la fiche</SubmitButton>
          {/* Shown only after the server confirmed the save. */}
          <p role="status" className="text-sm text-success">{state.ok ? "Fiche enregistrée." : ""}</p>
        </div>
      )}
    </form>
  );
}
