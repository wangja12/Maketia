"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requireUser, SESSION_COOKIE } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { changePassword, deleteAccount, updateProfile } from "@/server/account-settings";
import { invalidateOtherSessions } from "@/server/sessions";

const currentToken = async () => (await cookies()).get(SESSION_COOKIE)?.value ?? null;

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { name: String(form.get("name") ?? "") };
  try {
    await updateProfile(getDb(), user.id, values);
  } catch (e) {
    return toActionState(e, values);
  }
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    const signedOut = await changePassword(getDb(), user.id, { currentPassword: form.get("currentPassword"), newPassword: form.get("newPassword") }, await currentToken());
    return { ok: true, values: { signedOut: String(signedOut) } };
  } catch (e) {
    return toActionState(e);
  }
}

export async function signOutOthersAction(_prev: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const n = await invalidateOtherSessions(getDb(), user.id, await currentToken());
  return { ok: true, values: { signedOut: String(n) } };
}

export async function deleteAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireUser();
  const values = { confirmEmail: String(form.get("confirmEmail") ?? "") };
  try {
    await deleteAccount(getDb(), user.id, { password: form.get("password"), confirmEmail: values.confirmEmail });
  } catch (e) {
    return toActionState(e, values);
  }
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/connexion?compte=supprime");
}
