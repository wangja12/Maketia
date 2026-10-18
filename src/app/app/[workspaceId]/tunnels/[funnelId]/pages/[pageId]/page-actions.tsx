"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { createVariantAction, deletePageAction, duplicatePageAction, restoreVersionAction } from "./actions";

export function VariantButton({ pageId, full }: { pageId: string; full: boolean }) {
  const [state, action] = useActionState(createVariantAction.bind(null, pageId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <SubmitButton variant="secondary" className="w-full" disabled={full}>Créer une variante</SubmitButton>
      {full && <p className="text-xs text-muted">4 variantes maximum par page.</p>}
      <FormError message={state.error} />
    </form>
  );
}

export function DuplicateButton({ pageId }: { pageId: string }) {
  const [state, action] = useActionState(duplicatePageAction.bind(null, pageId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <SubmitButton variant="secondary" className="w-full">Dupliquer en nouvelle page</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function RestoreButton({ pageId, baseVersion, version }: { pageId: string; baseVersion: number; version: number }) {
  const [state, action] = useActionState(restoreVersionAction.bind(null, pageId, baseVersion, version), {});
  return (
    <form action={action}>
      <SubmitButton variant="ghost" className="h-7 px-2 text-xs">Restaurer</SubmitButton>
      {state.error && <p role="alert" className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}

export function DeletePageButton({ pageId, label }: { pageId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deletePageAction.bind(null, pageId), {});
  return (
    <>
      <Button variant="ghost" className="w-full text-danger!" onClick={() => setOpen(true)}>Supprimer cette page</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Supprimer cette page ?" description={`« ${label} » et tout son historique seront définitivement supprimés.`}>
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Supprimer</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
