"use client";

import { useActionState, useState } from "react";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { decideRequestAction } from "./actions";

/** Approve (after the review list, for anything that goes public) or reject an agent's request. */
export function DecideRequest({ workspaceId, requestId, review }: { workspaceId: string; requestId: string; review: string[] }) {
  const [approveState, approve] = useActionState(decideRequestAction.bind(null, workspaceId, requestId, true, review.length), {});
  const [rejectState, reject] = useActionState(decideRequestAction.bind(null, workspaceId, requestId, false, 0), {});
  const [checked, setChecked] = useState<boolean[]>(() => review.map(() => false));
  return (
    <div className="flex flex-col gap-3">
      <form action={approve} className="flex flex-col gap-2">
        {review.length > 0 && (
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-xs font-medium">Revue humaine (obligatoire)</legend>
            {review.map((item, i) => (
              <label key={item} className="flex items-start gap-2 text-xs">
                <input type="checkbox" name="review" value={i} checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} className="mt-0.5 accent-[var(--accent)]" />
                <span>{item}</span>
              </label>
            ))}
          </fieldset>
        )}
        <FormError message={approveState.error} />
        <SubmitButton className="w-fit" disabled={!checked.every(Boolean)}>Approuver et exécuter</SubmitButton>
      </form>
      <form action={reject} className="flex flex-wrap items-center gap-2">
        <input name="note" placeholder="Motif du refus (facultatif)" maxLength={300}
          className="h-9 min-w-0 flex-1 rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised sm:h-8 sm:text-sm" />
        <SubmitButton variant="ghost" className="h-8">Refuser</SubmitButton>
        <FormError message={rejectState.error} />
      </form>
    </div>
  );
}
