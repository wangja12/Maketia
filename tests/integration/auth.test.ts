import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { sessions } from "@/db/schema";
import { signUp, verifyCredentials } from "@/server/accounts";
import { ValidationError } from "@/server/errors";
import {
  createSession,
  invalidateSessionToken,
  validateSessionToken,
} from "@/server/sessions";
import { listWorkspacesForUser } from "@/server/workspaces";
import { db } from "./db";

describe("sign up", () => {
  it("creates the user with an owned workspace", async () => {
    const { userId, workspaceId } = await signUp(db, {
      name: "Kofi",
      email: "  Kofi@Exemple.TEST ",
      password: "motdepasse-solide",
    });
    const list = await listWorkspacesForUser(db, userId);
    expect(list).toEqual([{ id: workspaceId, name: "Espace de Kofi", role: "owner" }]);
  });

  it("rejects a duplicate e-mail regardless of case", async () => {
    await signUp(db, { name: "A", email: "a@exemple.test", password: "motdepasse-solide" });
    await expect(
      signUp(db, { name: "B", email: "A@EXEMPLE.test", password: "motdepasse-solide" }),
    ).rejects.toMatchObject({ fieldErrors: { email: expect.any(String) } });
  });

  it("rejects short passwords and invalid e-mails", async () => {
    const err = await signUp(db, { name: "", email: "nope", password: "court" }).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.fieldErrors).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("credentials and sessions", () => {
  it("verifies the right password only", async () => {
    const { userId } = await signUp(db, {
      name: "Fatou",
      email: "fatou@exemple.test",
      password: "motdepasse-solide",
    });
    expect(await verifyCredentials(db, "FATOU@exemple.test", "motdepasse-solide")).toBe(userId);
    expect(await verifyCredentials(db, "fatou@exemple.test", "mauvais-mdp")).toBeNull();
    expect(await verifyCredentials(db, "inconnu@exemple.test", "motdepasse-solide")).toBeNull();
  });

  it("stores only the token hash and resolves the user", async () => {
    const { userId } = await signUp(db, {
      name: "Moussa",
      email: "moussa@exemple.test",
      password: "motdepasse-solide",
    });
    const { token } = await createSession(db, userId);
    const stored = await db.select().from(sessions);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).not.toBe(token);

    expect(await validateSessionToken(db, token)).toMatchObject({ id: userId, name: "Moussa" });
    expect(await validateSessionToken(db, "faux-jeton")).toBeNull();

    await invalidateSessionToken(db, token);
    expect(await validateSessionToken(db, token)).toBeNull();
  });

  it("rejects and deletes expired sessions", async () => {
    const { userId } = await signUp(db, {
      name: "Ama",
      email: "ama@exemple.test",
      password: "motdepasse-solide",
    });
    const { token } = await createSession(db, userId);
    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, userId));
    expect(await validateSessionToken(db, token)).toBeNull();
    expect(await db.select().from(sessions)).toHaveLength(0);
  });
});

describe("sign-in brute-force limits", () => {
  it("locks an account after repeated failures, whatever the password, and per IP", async () => {
    const { signIn, LOGIN_LIMITS } = await import("@/server/accounts");
    const { userId } = await signUp(db, { name: "Ama", email: "ama@exemple.test", password: "motdepasse-solide" });
    expect(await signIn(db, { email: "ama@exemple.test", password: "motdepasse-solide", ip: "10.0.0.1" })).toBe(userId);
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) {
      expect(await signIn(db, { email: "AMA@exemple.test", password: `faux-${i}`, ip: `10.0.1.${i}` })).toBeNull();
    }
    // Even the right password is refused now, from any IP.
    await expect(signIn(db, { email: "ama@exemple.test", password: "motdepasse-solide", ip: "10.9.9.9" })).rejects.toThrow("Trop de tentatives");
    // Unknown accounts get the same treatment (no hint about which e-mails exist).
    for (let i = 0; i < LOGIN_LIMITS.perEmail; i++) await signIn(db, { email: "inconnu@exemple.test", password: "x", ip: null });
    await expect(signIn(db, { email: "inconnu@exemple.test", password: "x", ip: null })).rejects.toThrow("Trop de tentatives");
    // One IP guessing many accounts is stopped too.
    for (let i = 0; i < LOGIN_LIMITS.perIp; i++) await signIn(db, { email: `cible${i}@exemple.test`, password: "x", ip: "10.6.6.6" });
    await expect(signIn(db, { email: "autre@exemple.test", password: "x", ip: "10.6.6.6" })).rejects.toThrow("Trop de tentatives");
  });
});

describe("account settings", () => {
  it("changes profile and password (current one required) and signs out other sessions", async () => {
    const { updateProfile, changePassword } = await import("@/server/account-settings");
    const { createSession } = await import("@/server/sessions");
    const { userId } = await signUp(db, { name: "Ali", email: "ali@exemple.test", password: "motdepasse-solide" });
    await updateProfile(db, userId, { name: "  Ali Traoré " });
    const keep = await createSession(db, userId);
    const other = await createSession(db, userId);
    await expect(changePassword(db, userId, { currentPassword: "faux", newPassword: "nouveau-mdp-solide" }, keep.token)).rejects.toThrow("incorrect");
    await expect(changePassword(db, userId, { currentPassword: "motdepasse-solide", newPassword: "court" }, keep.token)).rejects.toThrow();
    expect(await changePassword(db, userId, { currentPassword: "motdepasse-solide", newPassword: "nouveau-mdp-solide" }, keep.token)).toBe(1);
    expect(await validateSessionToken(db, keep.token)).toMatchObject({ name: "Ali Traoré" });
    expect(await validateSessionToken(db, other.token)).toBeNull();
    expect(await verifyCredentials(db, "ali@exemple.test", "nouveau-mdp-solide")).toBe(userId);
  });

  it("deletes the account and its solo workspaces, but never leaves a shared workspace without owner", async () => {
    const { deleteAccount, accountDeletionPlan } = await import("@/server/account-settings");
    const { workspaceMembers, workspaces, funnels } = await import("@/db/schema");
    const { createFunnel } = await import("@/server/funnels");
    const { eq } = await import("drizzle-orm");
    const a = await signUp(db, { name: "Awa", email: "awa-del@exemple.test", password: "motdepasse-solide" });
    const b = await signUp(db, { name: "Bob", email: "bob-del@exemple.test", password: "motdepasse-solide" });
    await createFunnel(db, a.userId, a.workspaceId, { name: "Solo" });
    // Bob is an editor of Awa’s workspace: Awa is its only owner.
    await db.insert(workspaceMembers).values({ workspaceId: a.workspaceId, userId: b.userId, role: "editor" });
    expect((await accountDeletionPlan(db, a.userId)).blocking.map((w) => w.id)).toEqual([a.workspaceId]);
    await expect(deleteAccount(db, a.userId, { password: "motdepasse-solide", confirmEmail: "awa-del@exemple.test" })).rejects.toThrow("seul propriétaire");

    await db.delete(workspaceMembers).where(eq(workspaceMembers.userId, b.userId));
    await expect(deleteAccount(db, a.userId, { password: "faux", confirmEmail: "awa-del@exemple.test" })).rejects.toThrow("incorrect");
    await expect(deleteAccount(db, a.userId, { password: "motdepasse-solide", confirmEmail: "autre@exemple.test" })).rejects.toThrow();
    expect(await deleteAccount(db, a.userId, { password: "motdepasse-solide", confirmEmail: "AWA-DEL@exemple.test" })).toEqual({ deletedWorkspaces: 1 });
    expect(await db.select().from(workspaces).where(eq(workspaces.id, a.workspaceId))).toEqual([]);
    expect(await db.select().from(funnels).where(eq(funnels.workspaceId, a.workspaceId))).toEqual([]);
    expect(await verifyCredentials(db, "awa-del@exemple.test", "motdepasse-solide")).toBeNull();
    // Bob's own workspace is untouched.
    expect(await db.select().from(workspaces).where(eq(workspaces.id, b.workspaceId))).toHaveLength(1);
  });
});
