"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import { createLinksAction, deleteFileAction, revokeGrantAction, type LinksState } from "./actions";
import { CopyField } from "./forms";
import { deliveryMessage, whatsappShareUrl } from "@/lib/whatsapp";
import { buttonClass } from "@/components/ui/button";

/** Sends the file as the request body (no size-limited form encoding), then refreshes the list. */
export function FileUploader({ productId, replace, maxMb, accepted }: { productId: string; replace?: { id: string; title: string }; maxMb: number; accepted: string }) {
  const id = useId();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ kind: "idle" | "sending" | "done" | "error"; message?: string }>({ kind: "idle" });
  const tooBig = file !== null && file.size > maxMb * 1024 * 1024;

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!file || tooBig) return;
    setStatus({ kind: "sending" });
    const params = new URLSearchParams({ product: productId, title: String(new FormData(form).get("title") ?? "") });
    if (replace) params.set("replace", replace.id);
    try {
      const res = await fetch(`/api/files/upload?${params}`, { method: "POST", body: file, headers: { "x-file-name": encodeURIComponent(file.name), "content-type": "application/octet-stream" } });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) return setStatus({ kind: "error", message: json.error ?? "Envoi impossible. Réessayez." });
      setStatus({ kind: "done", message: replace ? "Nouvelle version enregistrée." : "Fichier enregistré." });
      setFile(null);
      form.reset();
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Connexion interrompue. Réessayez." });
    }
  }

  return (
    <form onSubmit={send} className="flex flex-col gap-2" noValidate>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-file`} className="text-xs font-medium">{replace ? `Nouvelle version de « ${replace.title} »` : "Fichier à livrer"}</label>
          <input id={`${id}-file`} type="file" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setStatus({ kind: "idle" }); }}
            aria-describedby={`${id}-help`} className="text-sm file:mr-2 file:rounded-control file:border file:border-border-strong file:bg-surface file:px-2 file:py-1" />
        </div>
        {!replace && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-title`} className="text-xs font-medium">Titre affiché (facultatif)</label>
            <input id={`${id}-title`} name="title" maxLength={120} className="h-9 rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised sm:h-8 sm:text-sm" />
          </div>
        )}
      </div>
      <p id={`${id}-help`} className={`text-xs ${tooBig ? "text-danger" : "text-muted"}`}>
        {tooBig ? `Fichier trop lourd : ${maxMb} Mo maximum.` : `${accepted}, ${maxMb} Mo maximum. Le fichier reste privé : il n’a pas d’adresse publique.`}
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" pending={status.kind === "sending"} disabled={!file || tooBig}>{replace ? "Remplacer" : "Envoyer le fichier"}</Button>
        <p role="status" className={`text-xs ${status.kind === "error" ? "text-danger" : "text-success"}`}>{status.message ?? ""}</p>
      </div>
    </form>
  );
}

export function DeleteFileButton({ workspaceId, fileId, title }: { workspaceId: string; fileId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteFileAction.bind(null, workspaceId, fileId), {});
  return (
    <>
      <Button variant="ghost" className="h-7 px-2 text-xs text-danger!" onClick={() => setOpen(true)}>Supprimer</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Supprimer « ${title} » ?`}
        description="Le fichier est effacé du stockage et les liens de téléchargement déjà donnés cessent de fonctionner. Cette action est irréversible.">
        <form action={action} className="flex flex-col gap-4">
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Supprimer définitivement</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Creates the buyer's download links and shows them once, to copy and send yourself. */
export function DownloadLinksButton({ workspaceId, orderId, buyer }: { workspaceId: string; orderId: string; buyer: { firstName: string | null; phone: string | null } }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<LinksState, FormData>(createLinksAction.bind(null, workspaceId, orderId), {});
  return (
    <>
      <Button variant="secondary" className="h-7 px-2 text-xs" onClick={() => setOpen(true)}>Liens de téléchargement</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Liens de téléchargement de l’acheteur"
        description="Chaque lien est personnel, expire et a un nombre de téléchargements limité. Il ne s’affiche qu’une fois : envoyez-le sur WhatsApp ou copiez-le. L’envoi automatique n’est pas encore disponible.">
        <div className="flex flex-col gap-4">
          {state.links ? (
            <>
              <a
                href={whatsappShareUrl(buyer.phone, deliveryMessage(buyer.firstName, state.links, state.days ?? 7))}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("primary", "h-11 w-full")}
              >
                Envoyer sur WhatsApp
              </a>
              <p className="text-xs text-muted">
                WhatsApp s’ouvre avec le message prêt{buyer.phone ? "" : " ; choisissez l’acheteur dans vos contacts"}. Rien n’est envoyé tant que vous n’appuyez pas sur « Envoyer » dans WhatsApp.
              </p>
              {state.links.map((l) => <CopyField key={l.url} label={l.title} value={l.url} />)}
              <p className="text-xs text-muted">Valables {state.days} jours, {state.maxDownloads} téléchargements chacun.</p>
            </>
          ) : (
            <form action={action} className="flex flex-col gap-3">
              <FormError message={state.error} />
              <SubmitButton className="w-fit">Créer les liens</SubmitButton>
            </form>
          )}
          <div className="flex justify-end"><Button variant="secondary" onClick={() => setOpen(false)}>Fermer</Button></div>
        </div>
      </Dialog>
    </>
  );
}

export function RevokeGrantButton({ workspaceId, grantId }: { workspaceId: string; grantId: string }) {
  const [state, action] = useActionState(revokeGrantAction.bind(null, workspaceId, grantId), {});
  return (
    <form action={action} className="inline">
      <SubmitButton variant="ghost" className="h-6 px-1.5 text-xs">Révoquer</SubmitButton>
      {state.error && <span className="text-xs text-danger"> {state.error}</span>}
    </form>
  );
}
