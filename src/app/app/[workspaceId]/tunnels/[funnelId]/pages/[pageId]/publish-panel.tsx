"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { publishAction, unpublishAction } from "./actions";

type Live = { version: number; path: string; url: string } | null;

/**
 * Publishing is a person's decision: the review items must each be ticked, and blocking
 * check failures disable the button. The server enforces both again.
 */
export function PublishPanel({
  pageId,
  version,
  currentVersion,
  live,
  defaultPath,
  review,
  blocked,
}: {
  pageId: string;
  version: number;
  currentVersion: number;
  live: Live;
  defaultPath: string;
  review: string[];
  blocked: boolean;
}) {
  const id = useId();
  const [state, action] = useActionState(publishAction.bind(null, pageId, version), {});
  const [checked, setChecked] = useState<boolean[]>(() => review.map(() => false));
  const allChecked = checked.every(Boolean);
  const path = state.values?.path ?? live?.path ?? defaultPath;

  return (
    <section aria-labelledby={`${id}-title`} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised">
      <h2 id={`${id}-title`} className="text-sm font-semibold">Publication</h2>
      {live ? (
        <p className="text-sm">
          <span className="font-medium text-success">En ligne</span> · version {live.version} ·{" "}
          <a href={live.url} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-4 [overflow-wrap:anywhere]">
            {live.url}
          </a>
          {live.version !== currentVersion && (
            <span className="mt-1 block text-xs text-muted">La version actuelle (v{currentVersion}) n’est pas encore en ligne.</span>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted">Pas en ligne. Les visiteurs ne voient rien tant que tu ne publies pas.</p>
      )}

      <form action={action} className="flex flex-col gap-3" noValidate>
        <FormError message={state.fieldErrors?.path ? undefined : state.error} />
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-path`} className="text-xs font-medium">Adresse dans le site</label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted">/</span>
            <input id={`${id}-path`} name="path" defaultValue={path} key={path} placeholder="(accueil)" maxLength={48}
              aria-invalid={state.fieldErrors?.path ? true : undefined}
              className="h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:h-8 sm:text-sm" />
          </div>
          <p className={`text-xs ${state.fieldErrors?.path ? "text-danger" : "text-muted"}`}>
            {state.fieldErrors?.path ?? "Vide = page d’accueil. Une page déjà en ligne à cette adresse sera remplacée."}
          </p>
        </div>

        <fieldset className="flex flex-col gap-1.5" disabled={blocked}>
          <legend className="mb-1 text-xs font-medium">Revue humaine (obligatoire)</legend>
          <input type="hidden" name="reviewCount" value={review.length} />
          {review.map((item, i) => (
            <label key={item} className="flex items-start gap-2 text-xs">
              <input type="checkbox" name="review" value={i} checked={checked[i]}
                onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                className="mt-0.5 accent-[var(--accent)]" />
              <span>{item}</span>
            </label>
          ))}
        </fieldset>
        {blocked && <p className="text-xs text-danger">Corrige d’abord les contrôles bloquants ci-dessus.</p>}
        <SubmitButton disabled={blocked || !allChecked} className="w-full">
          {live?.version === version ? `Republier la version ${version}` : `Publier la version ${version}`}
        </SubmitButton>
        {/* Shown only after the server confirmed. */}
        <p role="status" className="text-xs text-success">{state.ok ? "Publié." : ""}</p>
      </form>
      {live && <UnpublishButton pageId={pageId} url={live.url} />}
    </section>
  );
}

function UnpublishButton({ pageId, url }: { pageId: string; url: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(unpublishAction.bind(null, pageId), {});
  return (
    <>
      <Button variant="ghost" className="w-full text-danger!" onClick={() => setOpen(true)}>Dépublier</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Dépublier cette page ?" description={`${url} ne sera plus accessible aux visiteurs. Tu pourras republier à tout moment.`}>
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Dépublier</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
