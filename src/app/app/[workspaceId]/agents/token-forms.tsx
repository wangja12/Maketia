"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/text-field";
import { createTokenAction, revokeTokenAction, type TokenState } from "./actions";

export function CreateTokenForm({ workspaceId, serverUrl, canWrite }: { workspaceId: string; serverUrl: string; canWrite: boolean }) {
  const [state, action] = useActionState<TokenState, FormData>(createTokenAction.bind(null, workspaceId), {});
  return (
    <div className="flex flex-col gap-4">
      <form action={action} className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-raised" noValidate>
        <h3 className="text-sm font-semibold">Nouvelle connexion</h3>
        <FormError message={state.fieldErrors ? undefined : state.error} />
        <TextField label="Nom" name="name" placeholder="Ex. Claude Desktop d’Awa" maxLength={60} required
          defaultValue={state.token ? "" : state.values?.name} key={state.token ?? state.values?.name ?? "n"} error={state.fieldErrors?.name} />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-sm font-medium">Droits de l’agent</legend>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="access" value="write" defaultChecked={canWrite} disabled={!canWrite} className="mt-1 accent-[var(--accent)]" />
            <span><span className="font-medium">Lecture et modification</span> — crée et modifie des pages (jamais de publication ni de suppression).</span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input type="radio" name="access" value="read" defaultChecked={!canWrite} className="mt-1 accent-[var(--accent)]" />
            <span><span className="font-medium">Lecture seule</span> — consulte les tunnels, pages et contrôles.</span>
          </label>
          {state.fieldErrors?.access && <p className="text-xs text-danger">{state.fieldErrors.access}</p>}
        </fieldset>
        <SubmitButton className="w-fit">Créer la connexion</SubmitButton>
      </form>

      {state.token && <TokenReveal token={state.token} serverUrl={serverUrl} />}
    </div>
  );
}

function TokenReveal({ token, serverUrl }: { token: string; serverUrl: string }) {
  const claudeCode = `claude mcp add --transport http tunnels-ia ${serverUrl} --header "Authorization: Bearer ${token}"`;
  const json = JSON.stringify(
    { mcpServers: { "tunnels-ia": { type: "http", url: serverUrl, headers: { Authorization: `Bearer ${token}` } } } },
    null,
    2,
  );
  return (
    <section role="status" aria-label="Jeton créé" className="flex flex-col gap-3 rounded-card border border-accent p-4">
      <p className="text-sm">
        <span className="font-semibold">Copiez ce jeton maintenant.</span> Il ne sera plus jamais affiché. Traitez-le comme un mot de passe.
      </p>
      <CopyBlock label="Jeton" value={token} />
      <CopyBlock label="Claude Code (testé)" value={claudeCode} />
      <CopyBlock label="Clients acceptant une configuration JSON avec en-têtes HTTP" value={json} />
    </section>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">{label}</span>
        <Button
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copié" : "Copier"}
        </Button>
      </div>
      <pre className="overflow-x-auto rounded-control bg-surface-sunken p-3 font-mono text-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{value}</pre>
    </div>
  );
}

export function RevokeButton({ workspaceId, tokenId, name }: { workspaceId: string; tokenId: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(revokeTokenAction.bind(null, workspaceId, tokenId), {});
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} aria-label={`Révoquer ${name}`}>Révoquer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Révoquer cette connexion ?" description={`L’agent « ${name} » perdra l’accès immédiatement. Son historique reste consultable.`}>
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Révoquer</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
