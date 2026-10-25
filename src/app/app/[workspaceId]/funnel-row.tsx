"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import type { Funnel } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { StatusBadge } from "@/components/ui/status-badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { deleteFunnelAction, renameFunnelAction } from "./actions";

type RowFunnel = Pick<Funnel, "id" | "name" | "slug" | "status">;

export function FunnelRow({
  workspaceId,
  funnel,
  updatedLabel,
  canEdit,
  canDelete,
}: {
  workspaceId: string;
  funnel: RowFunnel;
  updatedLabel: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  // Forms stay mounted while the dialog animates out; a new key per opening resets them.
  const [opening, setOpening] = useState(0);
  const open = (d: "rename" | "delete") => {
    setOpening((n) => n + 1);
    setDialog(d);
  };
  const close = () => setDialog(null);

  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/app/${workspaceId}/tunnels/${funnel.id}`}
            className="truncate font-medium underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
            title={funnel.name}
          >
            {funnel.name}
          </Link>
          <StatusBadge status={funnel.status} />
        </div>
        <span className="truncate font-mono text-xs text-muted">
          /{funnel.slug} · modifiée le {updatedLabel}
        </span>
      </div>
      {(canEdit || canDelete) && (
        <div className="-ml-3.5 flex gap-1 sm:ml-0 sm:shrink-0">
          {canEdit && (
            <Button variant="ghost" onClick={() => open("rename")} aria-label={`Renommer ${funnel.name}`}>
              Renommer
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" onClick={() => open("delete")} aria-label={`Supprimer ${funnel.name}`}>
              Supprimer
            </Button>
          )}
        </div>
      )}

      <Dialog open={dialog === "rename"} onClose={close} title="Renommer l’offre">
        <RenameForm key={opening} funnel={funnel} onDone={close} />
      </Dialog>
      <Dialog
        open={dialog === "delete"}
        onClose={close}
        title="Supprimer cette offre ?"
        description={`« ${funnel.name} » sera définitivement supprimée. Cette action est irréversible.`}
      >
        <DeleteForm key={opening} funnelId={funnel.id} onCancel={close} />
      </Dialog>
    </li>
  );
}

function RenameForm({ funnel, onDone }: { funnel: RowFunnel; onDone: () => void }) {
  const [state, action] = useActionState(renameFunnelAction.bind(null, funnel.id), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const value = state.values?.name ?? funnel.name;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <TextField label="Nom" name="name" required maxLength={80} defaultValue={value} key={value} error={state.fieldErrors?.name} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Annuler
        </Button>
        <SubmitButton>Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

function DeleteForm({ funnelId, onCancel }: { funnelId: string; onCancel: () => void }) {
  const [state, action] = useActionState(deleteFunnelAction.bind(null, funnelId), {});
  // On success the row disappears with its dialog; only failures need handling here.
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <SubmitButton variant="danger">Supprimer</SubmitButton>
      </div>
    </form>
  );
}
