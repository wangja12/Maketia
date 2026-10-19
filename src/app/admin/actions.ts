"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { createPlan, reactivateUser, setWorkspacePlan, suspendUser, updatePlan, updatePlatformSettings } from "@/server/admin";

/* Every server function re-checks that the caller is a platform admin. */

async function run(path: string, fn: (adminId: string) => Promise<unknown>, values?: Record<string, string>): Promise<ActionState> {
  const user = await requireUser();
  try {
    await fn(user.id);
  } catch (e) {
    return toActionState(e, values);
  }
  revalidatePath(path);
  return { ok: true };
}

const PLAN_FIELDS = ["code", "name", "priceMonthly", "currency", "funnels", "variantsPerPage", "customDomains", "mcpWritesPerMonth", "analyticsEventsPerMonth"];
const planValues = (form: FormData) => Object.fromEntries(PLAN_FIELDS.map((k) => [k, String(form.get(k) ?? "")]));

export async function suspendUserAction(userId: string, _prev: ActionState, form: FormData) {
  const reason = String(form.get("reason") ?? "");
  return run(`/admin/utilisateurs/${userId}`, (a) => suspendUser(getDb(), a, userId, reason), { reason });
}

export async function reactivateUserAction(userId: string, _prev: ActionState) {
  return run(`/admin/utilisateurs/${userId}`, (a) => reactivateUser(getDb(), a, userId));
}

export async function setWorkspacePlanAction(userId: string, workspaceId: string, _prev: ActionState, form: FormData) {
  return run(`/admin/utilisateurs/${userId}`, (a) => setWorkspacePlan(getDb(), a, workspaceId, String(form.get("planId") ?? "")));
}

export async function createPlanAction(_prev: ActionState, form: FormData) {
  const values = planValues(form);
  return run("/admin/plans", (a) => createPlan(getDb(), a, values), values);
}

export async function updatePlanAction(planId: string, _prev: ActionState, form: FormData) {
  const values = planValues(form);
  return run("/admin/plans", (a) => updatePlan(getDb(), a, planId, { ...values, active: form.get("active") === "on", isDefault: form.get("isDefault") === "on" }), values);
}

export async function updateSettingsAction(_prev: ActionState, form: FormData) {
  return run("/admin/parametres", (a) => updatePlatformSettings(getDb(), a, { signupsOpen: form.get("signupsOpen") === "on" }));
}
