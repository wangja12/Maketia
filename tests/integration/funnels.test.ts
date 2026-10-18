import { describe, expect, it } from "vitest";
import { workspaceMembers } from "@/db/schema";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors";
import {
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  renameFunnel,
  slugify,
} from "@/server/funnels";
import { db, makeUser } from "./db";

describe("slugify", () => {
  it("strips accents and symbols", () => {
    expect(slugify("Formation Élevage & Pêche !")).toBe("formation-elevage-peche");
    expect(slugify("***")).toBe("tunnel");
  });
});

describe("funnels in a workspace", () => {
  it("creates, lists, renames and deletes", async () => {
    const { userId, workspaceId } = await makeUser();
    const a = await createFunnel(db, userId, workspaceId, { name: "E-book cuisine" });
    const b = await createFunnel(db, userId, workspaceId, { name: "E-book cuisine" });
    expect([a.slug, b.slug]).toEqual(["e-book-cuisine", "e-book-cuisine-2"]);
    expect(a.status).toBe("draft");

    await renameFunnel(db, userId, a.id, { name: "  Cuisine sénégalaise  " });
    expect((await getFunnel(db, userId, a.id)).name).toBe("Cuisine sénégalaise");

    await deleteFunnel(db, userId, b.id);
    const list = await listFunnels(db, userId, workspaceId);
    expect(list.map((f) => f.id)).toEqual([a.id]);
  });

  it("validates the name", async () => {
    const { userId, workspaceId } = await makeUser();
    await expect(createFunnel(db, userId, workspaceId, { name: "   " })).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(
      createFunnel(db, userId, workspaceId, { name: "x".repeat(81) }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("tenant isolation", () => {
  it("hides another workspace's data behind NotFound", async () => {
    const alice = await makeUser("Alice");
    const bob = await makeUser("Bob");
    const funnel = await createFunnel(db, alice.userId, alice.workspaceId, { name: "Secret" });

    await expect(listFunnels(db, bob.userId, alice.workspaceId)).rejects.toBeInstanceOf(NotFoundError);
    await expect(createFunnel(db, bob.userId, alice.workspaceId, { name: "Intrus" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(getFunnel(db, bob.userId, funnel.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(renameFunnel(db, bob.userId, funnel.id, { name: "Piraté" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteFunnel(db, bob.userId, funnel.id)).rejects.toBeInstanceOf(NotFoundError);

    expect((await getFunnel(db, alice.userId, funnel.id)).name).toBe("Secret");
    expect(await listFunnels(db, bob.userId, bob.workspaceId)).toEqual([]);
  });

  it("treats malformed ids as not found", async () => {
    const { userId } = await makeUser();
    await expect(listFunnels(db, userId, "pas-un-uuid")).rejects.toBeInstanceOf(NotFoundError);
    await expect(getFunnel(db, userId, "'; DROP TABLE funnels; --")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("enforces roles inside a shared workspace", async () => {
    const owner = await makeUser("Owner");
    const viewer = await makeUser("Viewer");
    const editor = await makeUser("Editor");
    await db.insert(workspaceMembers).values([
      { workspaceId: owner.workspaceId, userId: viewer.userId, role: "viewer" },
      { workspaceId: owner.workspaceId, userId: editor.userId, role: "editor" },
    ]);
    const funnel = await createFunnel(db, owner.userId, owner.workspaceId, { name: "Partagé" });

    expect(await listFunnels(db, viewer.userId, owner.workspaceId)).toHaveLength(1);
    await expect(createFunnel(db, viewer.userId, owner.workspaceId, { name: "Non" })).rejects.toBeInstanceOf(ForbiddenError);
    await expect(renameFunnel(db, viewer.userId, funnel.id, { name: "Non" })).rejects.toBeInstanceOf(ForbiddenError);

    await renameFunnel(db, editor.userId, funnel.id, { name: "Édité" });
    await expect(deleteFunnel(db, editor.userId, funnel.id)).rejects.toBeInstanceOf(ForbiddenError);
    await deleteFunnel(db, owner.userId, funnel.id);
  });
});
