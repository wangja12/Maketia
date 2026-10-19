"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FormError } from "@/components/ui/form-error";
import { SubmitButton } from "@/components/ui/submit-button";
import type { Plan } from "@/db/schema";
import { createPlanAction, reactivateUserAction, setWorkspacePlanAction, suspendUserAction, updatePlanAction, updateSettingsAction } from "./actions";

const control =
  "h-9 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:h-8 sm:text-sm";

export function SuspendButton({ userId, email }: { userId: string; email: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(suspendUserAction.bind(null, userId), {});
  return (
    <>
      <Button variant="danger" onClick={() => setOpen(true)}>Suspendre le compte</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Suspendre ${email} ?`}
        description="Ses sessions sont fermées et ses connexions MCP cessent de fonctionner. Ses données et ses pages publiées sont conservées. Vous pourrez réactiver le compte.">
        <form action={action} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1">
            <label htmlFor={id} className="text-sm font-medium">Motif (enregistré dans le journal)</label>
            <textarea id={id} name="reason" rows={3} maxLength={300} defaultValue={state.values?.reason} aria-invalid={state.fieldErrors?.reason ? true : undefined}
              className="rounded-control border border-border-strong bg-surface p-2.5 text-[16px] shadow-raised aria-invalid:border-danger sm:text-sm" />
          </div>
          <FormError message={state.error} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton variant="danger">Suspendre</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}

export function ReactivateButton({ userId }: { userId: string }) {
  const [state, action] = useActionState(reactivateUserAction.bind(null, userId), {});
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <SubmitButton variant="secondary">Réactiver le compte</SubmitButton>
      <FormError message={state.error} />
    </form>
  );
}

export function WorkspacePlanForm({ userId, workspaceId, planId, plans }: { userId: string; workspaceId: string; planId: string; plans: { id: string; name: string }[] }) {
  const id = useId();
  const [state, action] = useActionState(setWorkspacePlanAction.bind(null, userId, workspaceId), {});
  return (
    <form action={action} className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium">Plan</label>
      <div className="flex gap-2">
        <select id={id} name="planId" defaultValue={planId} className={control}>
          {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <SubmitButton variant="secondary" className="h-8 shrink-0">Attribuer</SubmitButton>
      </div>
      <FormError message={state.error} />
      <p role="status" className="text-xs text-success">{state.ok ? "Plan attribué." : ""}</p>
    </form>
  );
}

const LIMIT_FIELDS = [
  ["funnels", "Tunnels"],
  ["variantsPerPage", "Variantes par page (1 à 4)"],
  ["customDomains", "Domaines personnalisés"],
  ["mcpWritesPerMonth", "Modifications MCP / mois"],
  ["analyticsEventsPerMonth", "Événements mesurés / mois"],
] as const;

/** Create (no plan) or edit a plan. Empty number = unlimited (limits) or not set (price). */
export function PlanForm({ plan }: { plan?: Plan }) {
  const id = useId();
  const [state, action] = useActionState(plan ? updatePlanAction.bind(null, plan.id) : createPlanAction, {});
  const v = (k: string, fallback: string) => state.values?.[k] ?? fallback;
  const num = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
  const field = (name: string, label: string, value: string, extra: Record<string, unknown> = {}) => (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-${name}`} className="text-xs font-medium">{label}</label>
      <input id={`${id}-${name}`} name={name} defaultValue={value} aria-invalid={state.fieldErrors?.[name] ? true : undefined} className={control} {...extra} />
      {state.fieldErrors?.[name] && <p className="text-xs text-danger">{state.fieldErrors[name]}</p>}
    </div>
  );
  return (
    <form action={action} className="flex flex-col gap-3" noValidate>
      <FormError message={state.fieldErrors && Object.keys(state.fieldErrors).length ? undefined : state.error} />
      <div className="grid gap-3 sm:grid-cols-2">
        {field("name", "Nom", v("name", plan?.name ?? ""), { maxLength: 60 })}
        {field("code", "Code (unique)", v("code", plan?.code ?? ""), { maxLength: 30 })}
        {field("priceMonthly", "Prix mensuel (vide = à définir)", v("priceMonthly", num(plan?.priceMonthly)), { inputMode: "numeric" })}
        {field("currency", "Devise (XOF, XAF…)", v("currency", plan?.currency ?? ""), { maxLength: 3 })}
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-xs font-medium text-muted">Limites (vide = illimité)</legend>
        {LIMIT_FIELDS.map(([k, label]) => field(k, label, v(k, num(plan?.limits[k])), { inputMode: "numeric" }))}
      </fieldset>
      {plan && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="active" defaultChecked={plan.active} className="accent-[var(--accent)]" /> Actif (proposé)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="isDefault" defaultChecked={plan.isDefault} className="accent-[var(--accent)]" /> Plan par défaut</label>
        </div>
      )}
      <div className="flex items-center gap-3">
        <SubmitButton>{plan ? "Enregistrer" : "Créer le plan"}</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? (plan ? "Plan enregistré." : "Plan créé.") : ""}</p>
      </div>
    </form>
  );
}

export function SettingsForm({ signupsOpen }: { signupsOpen: boolean }) {
  const [state, action] = useActionState(updateSettingsAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="signupsOpen" defaultChecked={signupsOpen} className="mt-0.5 accent-[var(--accent)]" />
        <span>Inscriptions ouvertes<span className="block text-xs text-muted">Fermées : la page d’inscription refuse les nouveaux comptes. Les comptes existants ne sont pas touchés.</span></span>
      </label>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SubmitButton>Enregistrer</SubmitButton>
        <p role="status" className="text-xs text-success">{state.ok ? "Paramètres enregistrés." : ""}</p>
      </div>
    </form>
  );
}
