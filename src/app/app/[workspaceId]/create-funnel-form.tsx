"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { createFunnelAction } from "./actions";

export function CreateFunnelForm({ workspaceId }: { workspaceId: string }) {
  const [state, action] = useActionState(createFunnelAction.bind(null, workspaceId), {});
  const error = state.fieldErrors?.name ?? state.error;
  return (
    <form action={action} className="flex flex-col gap-1.5" noValidate>
      <label htmlFor="new-funnel-name" className="text-sm font-medium">
        Nouvelle offre
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="new-funnel-name"
          name="name"
          required
          maxLength={80}
          placeholder="Ex. Formation Excel pour débutants"
          // React resets the form after the action; restore the text only when it failed.
          defaultValue={state.values?.name}
          key={state.values?.name ?? "empty"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "new-funnel-error" : undefined}
          className="h-10 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] shadow-raised transition-[border-color] duration-150 placeholder:text-muted aria-invalid:border-danger sm:h-9 sm:flex-1 sm:text-sm"
        />
        <SubmitButton>Créer l’offre</SubmitButton>
      </div>
      {error && (
        <p id="new-funnel-error" role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
