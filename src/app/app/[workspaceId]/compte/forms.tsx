"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { changePasswordAction, deleteAccountAction, signOutOthersAction, updateProfileAction } from "./actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState(updateProfileAction, {});
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <TextField label="Nom" name="name" defaultValue={state.values?.name ?? name} maxLength={80} autoComplete="name" error={state.fieldErrors?.name} />
      <div className="flex items-center gap-3">
        <SubmitButton className="w-fit">Enregistrer</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? "Profil enregistré." : ""}</p>
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePasswordAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-3" noValidate key={state.ok ? `ok-${state.values?.signedOut}` : "edit"}>
      <TextField label="Mot de passe actuel" name="currentPassword" type="password" autoComplete="current-password" error={fe.currentPassword} />
      <TextField label="Nouveau mot de passe" name="newPassword" type="password" autoComplete="new-password" hint="10 caractères minimum." error={fe.newPassword} />
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton className="w-fit">Changer le mot de passe</SubmitButton>
        <p role="status" className="text-xs text-success">
          {state.ok ? `Mot de passe changé. ${state.values?.signedOut === "0" ? "Aucun autre appareil n’était connecté." : `${state.values?.signedOut} autre(s) session(s) fermée(s).`}` : ""}
        </p>
      </div>
    </form>
  );
}

export function SignOutOthersButton({ others }: { others: number }) {
  const [state, action] = useActionState(signOutOthersAction, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <SubmitButton variant="secondary" disabled={others === 0 && !state.ok}>Déconnecter les autres appareils</SubmitButton>
      <p role="status" className="text-xs text-muted">{state.ok ? `${state.values?.signedOut} session(s) fermée(s).` : `${others} autre(s) session(s) active(s).`}</p>
    </form>
  );
}

export function DeleteAccountButton({ email, blocking, deleted }: { email: string; blocking: string[]; deleted: string[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteAccountAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)} disabled={blocking.length > 0}>Supprimer mon compte</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Supprimer définitivement ton compte ?"
        description={`Ton compte, tes sessions et tes connexions MCP sont supprimés.${deleted.length ? ` Ces espaces, dont tu es le seul membre, sont supprimés avec tout leur contenu (pages, contacts, commandes, fichiers) : ${deleted.join(", ")}.` : ""} Cette action est irréversible.`}>
        <form action={action} className="flex flex-col gap-4" noValidate>
          <TextField label={`Recopie ton e-mail (${email})`} name="confirmEmail" autoComplete="off" defaultValue={state.values?.confirmEmail} key={state.values?.confirmEmail} error={fe.confirmEmail} />
          <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" error={fe.currentPassword} />
          <FormError message={state.fieldErrors ? undefined : state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Supprimer définitivement</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
