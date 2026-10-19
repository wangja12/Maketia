"use client";

import { useActionState } from "react";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { choosePlanAction } from "./actions";

export function ChoosePlanButton({ workspaceId, planId, name }: { workspaceId: string; planId: string; name: string }) {
  const [state, action] = useActionState(choosePlanAction.bind(null, workspaceId, planId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <SubmitButton variant="secondary" className="w-full">Passer au plan {name}</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}
