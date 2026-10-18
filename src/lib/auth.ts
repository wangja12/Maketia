import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/db";
import { createSession, invalidateSessionToken, validateSessionToken } from "@/server/sessions";

export const SESSION_COOKIE = "session";

/** Current user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSessionToken(getDb(), token);
});

/** For pages and actions that need a signed-in user. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}

/** Only callable from Server Actions or Route Handlers (cookies are read-only while rendering). */
export async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(getDb(), userId);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await invalidateSessionToken(getDb(), token);
  store.delete(SESSION_COOKIE);
}
