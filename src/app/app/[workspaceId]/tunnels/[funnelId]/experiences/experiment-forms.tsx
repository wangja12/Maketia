"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { addArmAction, createExperimentAction, selectWinnerAction, startExperimentAction, stopExperimentAction, updateSplitAction } from "./actions";

const control =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:h-8 sm:text-sm";

type Variant = { id: string; label: string; name: string };
type Goal = { value: string; label: string };

/** Every item must be ticked; the submit button stays disabled until then. */
function useReview(items: string[]) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  const fieldset = (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1 text-xs font-medium">Revue humaine (obligatoire)</legend>
      {items.map((item, i) => (
        <label key={item} className="flex items-start gap-2 text-xs">
          <input type="checkbox" name="review" value={i} checked={checked[i]}
            onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
            className="mt-0.5 accent-[var(--accent)]" />
          <span>{item}</span>
        </label>
      ))}
    </fieldset>
  );
  return { fieldset, done: checked.every(Boolean) };
}

export function CreateExperimentForm({ funnelId, variants, goals }: { funnelId: string; variants: Variant[]; goals: Goal[] }) {
  const id = useId();
  const [state, action] = useActionState(createExperimentAction.bind(null, funnelId), {});
  const [selected, setSelected] = useState<string[]>(() => variants.slice(0, 4).map((v) => v.id));
  const tooMany = selected.length > 4;
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-name`} className="text-xs font-medium">Nom de l’expérience</label>
        <input id={`${id}-name`} name="name" defaultValue={state.values?.name ?? ""} maxLength={80} placeholder="Titre principal : promesse vs prix" className={control}
          aria-invalid={state.fieldErrors?.name ? true : undefined} />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-goal`} className="text-xs font-medium">Objectif mesuré</label>
        <select id={`${id}-goal`} name="goal" defaultValue={state.values?.goal ?? goals[0].value} className={control}>
          {goals.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <p className="text-xs text-muted">Fixé avant le démarrage : il ne change plus ensuite.</p>
      </div>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-medium">Variantes testées (2 à 4) et poids du trafic</legend>
        {variants.map((v) => (
          <div key={v.id} className="flex items-center gap-2 text-sm">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <input type="checkbox" name="arm" value={v.id} checked={selected.includes(v.id)}
                onChange={(e) => setSelected((s) => (e.target.checked ? [...s, v.id] : s.filter((x) => x !== v.id)))}
                className="accent-[var(--accent)]" />
              <span className="font-mono text-xs">{v.label}</span>
              <span className="truncate">{v.name}</span>
            </label>
            <input type="number" name={`weight_${v.id}`} defaultValue={50} min={1} max={100} aria-label={`Poids de la variante ${v.label}`}
              className={`${control} w-20! tabular-nums`} disabled={!selected.includes(v.id)} />
          </div>
        ))}
      </fieldset>
      {tooMany && <p className="text-xs text-danger">4 variantes maximum par expérience.</p>}
      <SubmitButton disabled={selected.length < 2 || tooMany}>Créer le brouillon</SubmitButton>
      <p className="text-xs text-muted">Rien n’est montré aux visiteurs tant que tu ne démarres pas l’expérience.</p>
    </form>
  );
}

export function SplitForm({ funnelId, experimentId, arms }: { funnelId: string; experimentId: string; arms: { pageId: string; label: string; weight: number }[] }) {
  const [state, action] = useActionState(updateSplitAction.bind(null, funnelId, experimentId), {});
  return (
    <form action={action} className="flex flex-col gap-2" noValidate>
      <FormError message={state.error} />
      <div className="flex flex-wrap gap-3">
        {arms.map((a) => (
          <label key={a.pageId} className="flex items-center gap-1.5 text-sm">
            <span className="font-mono text-xs">{a.label}</span>
            <input type="number" name={`weight_${a.pageId}`} defaultValue={a.weight} min={1} max={100} className={`${control} w-20! tabular-nums`} aria-label={`Poids de la variante ${a.label}`} />
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">Les visiteurs déjà assignés gardent leur variante ; seuls les nouveaux suivent la nouvelle répartition.</p>
      <div className="flex items-center gap-3">
        <SubmitButton variant="secondary">Enregistrer la répartition</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? "Répartition enregistrée." : ""}</p>
      </div>
    </form>
  );
}

export function StartForm({ funnelId, experimentId, review, blockedReason }: { funnelId: string; experimentId: string; review: string[]; blockedReason: string | null }) {
  const [state, action] = useActionState(startExperimentAction.bind(null, funnelId, experimentId), {});
  const { fieldset, done } = useReview(review);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      {fieldset}
      {blockedReason && <p className="text-xs text-danger">{blockedReason}</p>}
      <SubmitButton disabled={!done || Boolean(blockedReason)}>Démarrer l’expérience</SubmitButton>
    </form>
  );
}

export function AddArmForm({ funnelId, experimentId, candidates, running, review }: { funnelId: string; experimentId: string; candidates: Variant[]; running: boolean; review: string[] }) {
  const id = useId();
  const [state, action] = useActionState(addArmAction.bind(null, funnelId, experimentId), {});
  const { fieldset, done } = useReview(review);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-xs font-medium">Variante à ajouter</label>
        <select id={id} name="pageId" className={control}>
          {candidates.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.name}</option>)}
        </select>
      </div>
      {running && fieldset}
      <SubmitButton variant="secondary" disabled={running && !done}>Ajouter la variante</SubmitButton>
    </form>
  );
}

export function StopButton({ funnelId, experimentId }: { funnelId: string; experimentId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(stopExperimentAction.bind(null, funnelId, experimentId), {});
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>Arrêter l’expérience</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Arrêter l’expérience ?"
        description="Les visiteurs verront de nouveau la page publiée à cette adresse. Les résultats restent consultables ; tu pourras choisir un gagnant ensuite.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton>Arrêter</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function WinnerForm({ funnelId, experimentId, arms, review, warning }: { funnelId: string; experimentId: string; arms: Variant[]; review: string[]; warning: string | null }) {
  const id = useId();
  const [state, action] = useActionState(selectWinnerAction.bind(null, funnelId, experimentId), {});
  const { fieldset, done } = useReview(review);
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.error} />
      {warning && <p className="rounded-control bg-warning-soft px-3 py-2 text-xs text-warning">{warning}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-xs font-medium">Variante à publier</label>
        <select id={id} name="pageId" className={control}>
          {arms.map((v) => <option key={v.id} value={v.id}>{v.label} · {v.name}</option>)}
        </select>
      </div>
      {fieldset}
      <SubmitButton disabled={!done}>Publier cette variante et terminer</SubmitButton>
      <p role="status" className="text-xs text-success">{state.ok ? "Variante publiée. L’expérience est terminée." : ""}</p>
    </form>
  );
}
