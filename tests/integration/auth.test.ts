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
