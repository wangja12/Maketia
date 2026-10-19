"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { addTagAction, deleteContactAction, deleteSegmentAction, removeTagAction, saveSegmentAction, setStatusAction } from "./actions";

const control =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:h-8 sm:text-sm";

export function SaveSegmentForm({ workspaceId, filters }: { workspaceId: string; filters: Record<string, string> }) {
  const id = useId();
  const [state, action] = useActionState(saveSegmentAction.bind(null, workspaceId, filters), {});
  return (
    <form action={action} className="flex flex-col gap-1.5" noValidate>
      <label htmlFor={id} className="text-xs font-medium">Enregistrer ces filtres comme segment</label>
      <div className="flex gap-2">
        <input id={id} name="name" defaultValue={state.ok ? "" : state.values?.name} key={state.ok ? "saved" : "edit"} placeholder="Clients VIP d’Abidjan" maxLength={60}
          aria-invalid={state.error ? true : undefined} className={control} />
        <SubmitButton variant="secondary" className="h-8 shrink-0">Enregistrer</SubmitButton>
      </div>
      <p role="status" className={`text-xs ${state.error ? "text-danger" : "text-muted"}`}>
        {state.error ?? (state.ok ? "Segment enregistré. Il se met à jour tout seul." : "Un segment recalcule ses contacts à chaque ouverture.")}
      </p>
    </form>
  );
}

export function DeleteSegmentButton({ workspaceId, segmentId, name }: { workspaceId: string; segmentId: string; name: string }) {
  const [, action] = useActionState(deleteSegmentAction.bind(null, workspaceId, segmentId), {});
  return (
    <form action={action}>
      <button type="submit" aria-label={`Supprimer le segment ${name}`} className="pressable rounded-control px-1.5 text-muted [@media(hover:hover)_and_(pointer:fine)]:hover:text-danger">×</button>
    </form>
  );
}

export function StatusForm({ workspaceId, contactId, status, options }: { workspaceId: string; contactId: string; status: string; options: [string, string][] }) {
  const id = useId();
  const [state, action] = useActionState(setStatusAction.bind(null, workspaceId, contactId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium">Statut</label>
      <div className="flex gap-2">
        <select id={id} name="status" defaultValue={status} key={status} className={control}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <SubmitButton variant="secondary" className="h-8 shrink-0">Changer</SubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

export function TagsEditor({ workspaceId, contactId, tags, canEdit }: { workspaceId: string; contactId: string; tags: string[]; canEdit: boolean }) {
  const id = useId();
  const [state, action] = useActionState(addTagAction.bind(null, workspaceId, contactId), {});
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
        {tags.length === 0 && <li className="text-sm text-muted">Aucun tag</li>}
        {tags.map((t) => (
          <li key={t} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-sunken pl-2.5 pr-1 text-xs">
            {t}
            {canEdit && <RemoveTag workspaceId={workspaceId} contactId={contactId} tag={t} />}
          </li>
        ))}
      </ul>
      {canEdit && (
        <form action={action} className="flex flex-col gap-1" noValidate>
          <label htmlFor={id} className="sr-only">Nouveau tag</label>
          <div className="flex gap-2">
            <input id={id} name="tag" placeholder="Nouveau tag" maxLength={30} key={state.ok ? tags.join() : "edit"} defaultValue={state.ok ? "" : state.values?.tag}
              aria-invalid={state.error ? true : undefined} className={control} />
            <SubmitButton variant="secondary" className="h-8 shrink-0">Ajouter</SubmitButton>
          </div>
          {state.error && <p className="text-xs text-danger">{state.error}</p>}
        </form>
      )}
    </div>
  );
}

function RemoveTag({ workspaceId, contactId, tag }: { workspaceId: string; contactId: string; tag: string }) {
  const [, action] = useActionState(removeTagAction.bind(null, workspaceId, contactId, tag), {});
  return (
    <form action={action}>
      <button type="submit" aria-label={`Retirer le tag ${tag}`} className="pressable inline-flex size-5 items-center justify-center rounded-full text-muted [@media(hover:hover)_and_(pointer:fine)]:hover:bg-border">×</button>
    </form>
  );
}

export function DeleteContactButton({ workspaceId, contactId, name }: { workspaceId: string; contactId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteContactAction.bind(null, workspaceId, contactId), {});
  return (
    <>
      <Button variant="ghost" className="text-danger!" onClick={() => setOpen(true)}>Supprimer ce contact</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Supprimer ${name} ?`}
        description="Ses coordonnées et son historique sont effacés définitivement. Ses commandes sont conservées pour la comptabilité, sans nom, e-mail ni téléphone. Cette action est irréversible.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Supprimer définitivement</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
