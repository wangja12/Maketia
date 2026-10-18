"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { signUpAction } from "../actions";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, {});
  const v = state.values ?? {};
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      {/* Field errors are shown inline; the banner only covers form-level failures. */}
      <FormError message={state.fieldErrors ? undefined : state.error} />
      <TextField label="Nom" name="name" autoComplete="name" required defaultValue={v.name} key={`n-${v.name}`} error={fe.name} />
      <TextField label="E-mail" name="email" type="email" autoComplete="email" required defaultValue={v.email} key={`e-${v.email}`} error={fe.email} />
      <TextField
        label="Mot de passe"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        hint="10 caractères minimum."
        error={fe.password}
      />
      <SubmitButton className="mt-2 w-full">Créer mon compte</SubmitButton>
    </form>
  );
}
