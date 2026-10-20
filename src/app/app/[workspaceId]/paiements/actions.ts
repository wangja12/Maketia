"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { requireUser } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { SecretsKeyMissingError } from "@/server/secrets";
import { clearSigningSecret, ignoreWebhookEvent, reconcileWebhookEvent, rotateWebhookUrl, setSigningSecret } from "@/server/payments/saspay-webhooks";
import { createDownloadLinks, deleteProductFile, revokeDownloadGrant } from "@/server/files/files";
import { cancelOrder, confirmOrderPaidManually, createProduct, removeProductPaymentLink, setProductActive, setProductPaymentLink } from "@/server/payments/service";

const path = (workspaceId: string) => `/app/${workspaceId}/paiements`;

async function run(workspaceId: string, fn: (userId: string) => Promise<unknown>, values?: Record<string, string>): Promise<ActionState> {
  const user = await requireUser();
  try {
    await fn(user.id);
  } catch (e) {
    if (e instanceof SecretsKeyMissingError) return { error: e.message, values };
    return toActionState(e, values);
  }
  revalidatePath(path(workspaceId));
  return { ok: true };
}

export async function createProductAction(workspaceId: string, _prev: ActionState, form: FormData) {
  const values = { name: String(form.get("name") ?? ""), price: String(form.get("price") ?? ""), currency: String(form.get("currency") ?? ""), kind: String(form.get("kind") ?? "no_delivery") };
  return run(workspaceId, (u) => createProduct(getDb(), u, workspaceId, values), values);
}

export async function toggleProductAction(workspaceId: string, productId: string, active: boolean, _prev: ActionState) {
  return run(workspaceId, (u) => setProductActive(getDb(), u, productId, active));
}

export async function saveLinkAction(workspaceId: string, productId: string, _prev: ActionState, form: FormData) {
  const values = { url: String(form.get("url") ?? ""), price: String(form.get("price") ?? ""), currency: String(form.get("currency") ?? "") };
  return run(
    workspaceId,
    (u) => setProductPaymentLink(getDb(), u, productId, { ...values, phoneRequired: form.get("phoneRequired") === "on", confirmed: form.get("confirmed") === "on" }),
    values,
  );
}

export async function removeLinkAction(workspaceId: string, productId: string, _prev: ActionState) {
  return run(workspaceId, (u) => removeProductPaymentLink(getDb(), u, productId));
}

export async function saveSecretAction(workspaceId: string, _prev: ActionState, form: FormData) {
  // The secret is never echoed back into the form.
  return run(workspaceId, (u) => setSigningSecret(getDb(), u, workspaceId, String(form.get("secret") ?? "")));
}

export async function clearSecretAction(workspaceId: string, _prev: ActionState) {
  return run(workspaceId, (u) => clearSigningSecret(getDb(), u, workspaceId));
}

export async function rotateUrlAction(workspaceId: string, _prev: ActionState) {
  return run(workspaceId, (u) => rotateWebhookUrl(getDb(), u, workspaceId));
}

export async function confirmPaidAction(workspaceId: string, orderId: string, _prev: ActionState, form: FormData) {
  return run(workspaceId, (u) => confirmOrderPaidManually(getDb(), u, orderId, { attested: form.get("attested") === "on", note: String(form.get("note") ?? "") }));
}

export async function cancelOrderAction(workspaceId: string, orderId: string, _prev: ActionState) {
  return run(workspaceId, (u) => cancelOrder(getDb(), u, orderId));
}

export async function reconcileAction(workspaceId: string, eventId: number, _prev: ActionState, form: FormData) {
  return run(workspaceId, (u) =>
    reconcileWebhookEvent(getDb(), u, eventId, { orderId: String(form.get("orderId") ?? ""), attested: form.get("attested") === "on", note: String(form.get("note") ?? "") }),
  );
}

export async function ignoreEventAction(workspaceId: string, eventId: number, _prev: ActionState, form: FormData) {
  return run(workspaceId, (u) => ignoreWebhookEvent(getDb(), u, eventId, String(form.get("note") ?? "")));
}

export async function deleteFileAction(workspaceId: string, fileId: string, _prev: ActionState) {
  return run(workspaceId, (u) => deleteProductFile(getDb(), u, fileId));
}

export async function revokeGrantAction(workspaceId: string, grantId: string, _prev: ActionState) {
  return run(workspaceId, (u) => revokeDownloadGrant(getDb(), u, grantId));
}

export type LinksState = ActionState & { links?: { title: string; fileName: string; url: string }[]; days?: number; maxDownloads?: number };

/** Returns the links once: only their hashes are stored. */
export async function createLinksAction(workspaceId: string, orderId: string, _prev: LinksState): Promise<LinksState> {
  const user = await requireUser();
  try {
    const result = await createDownloadLinks(getDb(), user.id, orderId);
    revalidatePath(path(workspaceId));
    return { ok: true, ...result };
  } catch (e) {
    return toActionState(e);
  }
}
