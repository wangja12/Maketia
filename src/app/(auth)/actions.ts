"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { endSession, startSession } from "@/lib/auth";
import { toActionState, type ActionState } from "@/lib/action-state";
import { clientIp } from "@/lib/public-forms";
import { signIn, signUp } from "@/server/accounts";

export async function signUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const values = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") };
  let workspaceId: string;
  try {
    const result = await signUp(getDb(), { ...values, password: String(form.get("password") ?? "") });
    await startSession(result.userId);
    workspaceId = result.workspaceId;
  } catch (e) {
    return toActionState(e, values);
  }
  redirect(`/app/${workspaceId}`);
}

export async function signInAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  try {
    const userId = await signIn(getDb(), { email, password, ip: clientIp({ headers: await headers() }) });
    // Same message for unknown e-mail and wrong password: do not reveal which accounts exist.
    if (!userId) return { error: "E-mail ou mot de passe incorrect.", values: { email } };
    await startSession(userId);
  } catch (e) {
    return toActionState(e, { email });
  }
  redirect("/app");
}

export async function signOutAction() {
  await endSession();
  redirect("/connexion");
}
