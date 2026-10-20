import { hash, verify } from "@node-rs/argon2";
import { and, count, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { productFiles, users, workspaceMembers, workspaces } from "@/db/schema";
import { NotFoundError, ValidationError } from "./errors";
import { fileStorage } from "./files/storage";
import { invalidateOtherSessions } from "./sessions";
import { fieldErrorsOf } from "./validation";

/*
 * The signed-in person's own account: profile, password, sessions, deletion.
 * Every sensitive change asks for the current password again.
 */

async function requireUserRow(db: Db, userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) throw new NotFoundError();
  return user;
}

async function checkPassword(db: Db, userId: string, password: unknown) {
  const user = await requireUserRow(db, userId);
  if (typeof password !== "string" || !(await verify(user.passwordHash, password))) {
    throw new ValidationError("Mot de passe actuel incorrect.", { currentPassword: "Mot de passe actuel incorrect" });
  }
  return user;
}

export async function getAccount(db: Db, userId: string) {
  const { id, name, email, createdAt } = await requireUserRow(db, userId);
  return { id, name, email, createdAt };
}

export async function updateProfile(db: Db, userId: string, input: { name: unknown }) {
  const parsed = z.object({ name: z.string().trim().min(1, "Indiquez votre nom").max(80, "80 caractères maximum") }).safeParse(input);
  if (!parsed.success) throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  await db.update(users).set({ name: parsed.data.name }).where(eq(users.id, userId));
}

/** New password; every other session is signed out (a stolen session stops working). */
export async function changePassword(db: Db, userId: string, input: { currentPassword: unknown; newPassword: unknown }, currentSessionToken: string | null) {
  await checkPassword(db, userId, input.currentPassword);
  const next = z.string().min(10, "10 caractères minimum").max(200, "200 caractères maximum").safeParse(input.newPassword);
  if (!next.success) throw new ValidationError("Vérifiez les champs", { newPassword: next.error.issues[0].message });
  if (next.data === input.currentPassword) throw new ValidationError("Vérifiez les champs", { newPassword: "Choisissez un mot de passe différent de l’actuel" });
  await db.update(users).set({ passwordHash: await hash(next.data) }).where(eq(users.id, userId));
  return invalidateOtherSessions(db, userId, currentSessionToken);
}

/**
 * What deleting the account would remove, so the person can decide. Workspaces where they are
 * the only member go with the account; a workspace shared with others blocks the deletion if
 * they are its only owner (ownership must be handed over first).
 */
export async function accountDeletionPlan(db: Db, userId: string) {
  const memberships = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId));
  const deleted: { id: string; name: string }[] = [];
  const blocking: { id: string; name: string }[] = [];
  for (const m of memberships) {
    const [{ others }] = await db.select({ others: count() }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, m.id), ne(workspaceMembers.userId, userId)));
    if (others === 0) deleted.push({ id: m.id, name: m.name });
    else if (m.role === "owner") {
      const [{ owners }] = await db
        .select({ owners: count() })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, m.id), eq(workspaceMembers.role, "owner"), ne(workspaceMembers.userId, userId)));
      if (owners === 0) blocking.push({ id: m.id, name: m.name });
    }
  }
  return { deleted, blocking };
}

/**
 * Irreversible: removes the account, its sessions and tokens, and every workspace where the
 * person was alone (pages, contacts, orders, files…). Requires the password and the typed e-mail.
 */
export async function deleteAccount(db: Db, userId: string, input: { password: unknown; confirmEmail: unknown }) {
  const user = await checkPassword(db, userId, input.password);
  if (typeof input.confirmEmail !== "string" || input.confirmEmail.trim().toLowerCase() !== user.email) {
    throw new ValidationError("Vérifiez les champs", { confirmEmail: "Recopiez exactement votre adresse e-mail" });
  }
  if (user.isPlatformAdmin) {
    const admins = await db.select({ id: users.id }).from(users).where(and(eq(users.isPlatformAdmin, true), ne(users.id, userId)));
    if (admins.length === 0) throw new ValidationError("Vous êtes le seul administrateur de la plateforme : nommez-en un autre avant de supprimer votre compte.");
  }
  const plan = await accountDeletionPlan(db, userId);
  if (plan.blocking.length) {
    throw new ValidationError(`Vous êtes le seul propriétaire de : ${plan.blocking.map((w) => w.name).join(", ")}. Transmettez la propriété avant de supprimer votre compte.`);
  }
  const ids = plan.deleted.map((w) => w.id);
  const files = ids.length ? await db.select({ key: productFiles.storageKey }).from(productFiles).where(inArray(productFiles.workspaceId, ids)) : [];
  await db.transaction(async (tx) => {
    if (ids.length) await tx.delete(workspaces).where(inArray(workspaces.id, ids));
    await tx.delete(users).where(eq(users.id, userId));
  });
  // Stored files go after the rows: a failure here leaves orphan files, never dangling rows.
  for (const f of files) await fileStorage().remove(f.key).catch(() => {});
  return { deletedWorkspaces: plan.deleted.length };
}
