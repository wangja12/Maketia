import { createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { sessions, users } from "@/db/schema";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SessionUser = { id: string; email: string; name: string; isPlatformAdmin: boolean };

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session and returns the raw token. Only its hash is stored. */
export async function createSession(db: Db, userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export async function validateSessionToken(
  db: Db,
  token: string,
): Promise<SessionUser | null> {
  const id = hashToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      isPlatformAdmin: users.isPlatformAdmin,
      suspendedAt: users.suspendedAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id));
  if (!row) return null;
  // Expired, or the account was suspended since: the session is over.
  if (row.expiresAt.getTime() <= Date.now() || row.suspendedAt) {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, isPlatformAdmin: row.isPlatformAdmin };
}

export async function invalidateSessionToken(db: Db, token: string) {
  await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
}
