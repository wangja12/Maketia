"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { signInAction } from "../actions";

export function SignInForm() {
  const [state, action] = useActionState(signInAction, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4" noValidate>
      <FormError message={state.error} />
      <TextField
        label="E-mail"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        key={`email-${state.values?.email ?? ""}`}
      />
      <TextField label="Mot de passe" name="password" type="password" autoComplete="current-password" required />
      <SubmitButton className="mt-2 w-full">Se connecter</SubmitButton>
    </form>
  );
}
