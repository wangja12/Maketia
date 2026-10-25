import { createHash } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { loginAttempts, platformSettings, users, workspaceMembers, workspaces } from "@/db/schema";
import { ForbiddenError, ValidationError } from "./errors";
import { fieldErrorsOf } from "./validation";

const signUpSchema = z.object({
  name: z.string().trim().min(1, "Indique ton nom").max(80, "80 caractères maximum"),
  email: z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide")),
  password: z
    .string()
    .min(10, "10 caractères minimum")
    .max(200, "200 caractères maximum"),
});

export type SignUpInput = z.input<typeof signUpSchema>;

// Precomputed so unknown e-mails cost as much as wrong passwords (no timing oracle).
let dummyHash: Promise<string> | undefined;

/** Creates the user and their first workspace, owned by them, in one transaction. */
export async function signUp(db: Db, input: SignUpInput) {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Vérifie les champs", fieldErrorsOf(parsed.error));
  }
  const { name, email, password } = parsed.data;
  const [settings] = await db.select({ signupsOpen: platformSettings.signupsOpen }).from(platformSettings);
  if (settings && !settings.signupsOpen) throw new ValidationError("Les inscriptions sont fermées pour le moment.");
  const passwordHash = await hash(password);

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name, email, passwordHash })
      .onConflictDoNothing({ target: users.email })
      .returning({ id: users.id });
    if (!user) {
      throw new ValidationError("Vérifie les champs", {
        email: "Un compte existe déjà avec cette adresse",
      });
    }
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name: `Espace de ${name}` })
      .returning({ id: workspaces.id });
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: workspace.id, userId: user.id, role: "owner" });
    return { userId: user.id, workspaceId: workspace.id };
  });
}

/**
 * Returns the user id when the credentials match, otherwise null. A suspended account is
 * told so, but only once the password is right (no hint about which accounts exist).
 */
export async function verifyCredentials(
  db: Db,
  email: string,
  password: string,
): Promise<string | null> {
  const [user] = await db
    .select({ id: users.id, passwordHash: users.passwordHash, suspendedAt: users.suspendedAt })
    .from(users)
    .where(eq(users.email, email.trim().toLowerCase()));
  if (!user) {
    dummyHash ??= hash("timing-equalizer");
    await verify(await dummyHash, password);
    return null;
  }
  if (!(await verify(user.passwordHash, password))) return null;
  if (user.suspendedAt) throw new ForbiddenError("Ce compte est suspendu. Contacte l’équipe de la plateforme.");
  return user.id;
}

export const LOGIN_LIMITS = { perEmail: 10, perIp: 50, windowMinutes: 15 };

const digest = (value: string) => createHash("sha256").update(`tunnels-ia:${value}`).digest("hex");

/**
 * Sign-in with brute-force limits: after too many failures for an account (or from one IP)
 * within 15 minutes, further attempts are refused without checking the password. The
 * message is the same whether the account exists or not.
 */
export async function signIn(db: Db, input: { email: string; password: string; ip: string | null }) {
  const emailHash = digest(input.email.trim().toLowerCase());
  const ipHash = input.ip ? digest(input.ip) : null;
  const since = sql`now() - make_interval(mins => ${LOGIN_LIMITS.windowMinutes})`;
  const failures = (where: ReturnType<typeof eq>) =>
    db.select({ n: count() }).from(loginAttempts).where(and(where, eq(loginAttempts.success, false), gt(loginAttempts.createdAt, since)));
  const [[byEmail], [byIp]] = await Promise.all([
    failures(eq(loginAttempts.emailHash, emailHash)),
    ipHash ? failures(eq(loginAttempts.ipHash, ipHash)) : Promise.resolve([{ n: 0 }]),
  ]);
  if (byEmail.n >= LOGIN_LIMITS.perEmail || byIp.n >= LOGIN_LIMITS.perIp) {
    throw new ValidationError(`Trop de tentatives de connexion. Réessaie dans ${LOGIN_LIMITS.windowMinutes} minutes.`);
  }
  let userId: string | null;
  try {
    userId = await verifyCredentials(db, input.email, input.password);
  } catch (e) {
    // Suspended account: the password was right, so it is not a guessing failure.
    if (e instanceof ForbiddenError) await db.insert(loginAttempts).values({ emailHash, ipHash, success: true });
    throw e;
  }
  await db.insert(loginAttempts).values({ emailHash, ipHash, success: userId !== null });
  return userId;
}
