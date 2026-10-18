"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { SecretsKeyMissingError } from "@/server/secrets";
import {
  createProduct,
  refreshOrderForUser,
  removeProvider,
  saveProvider,
  setProductActive,
  verifyProvider,
} from "@/server/payments/service";

const path = (workspaceId: string) => `/app/${workspaceId}/paiements`;

export async function saveProviderAction(workspaceId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { country: String(form.get("country") ?? ""), environment: String(form.get("environment") ?? "sandbox") };
  try {
    // Credentials are never echoed back into the form.
    await saveProvider(getDb(), user.id, workspaceId, { ...values, apiKey: String(form.get("apiKey") ?? ""), apiPassword: String(form.get("apiPassword") ?? "") });
  } catch (e) {
    if (e instanceof SecretsKeyMissingError) return { error: e.message, values };
    return toActionState(e, values);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function verifyProviderAction(workspaceId: string, providerId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await verifyProvider(getDb(), user.id, providerId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function removeProviderAction(workspaceId: string, providerId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await removeProvider(getDb(), user.id, providerId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function createProductAction(workspaceId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { name: String(form.get("name") ?? ""), price: String(form.get("price") ?? ""), currency: String(form.get("currency") ?? "XOF") };
  try {
    await createProduct(getDb(), user.id, workspaceId, values);
  } catch (e) {
    return toActionState(e, values);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function toggleProductAction(workspaceId: string, productId: string, active: boolean, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await setProductActive(getDb(), user.id, productId, active);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function refreshOrderAction(workspaceId: string, orderId: string, _prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  try {
    await refreshOrderForUser(getDb(), user.id, orderId);
  } catch (e) {
    return toActionState(e);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}
