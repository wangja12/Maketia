import { and, asc, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { workspaceMembers, workspaces, type MemberRole } from "@/db/schema";
import { ForbiddenError, NotFoundError } from "./errors";

export type Permission = "read" | "edit" | "delete";

const grants: Record<MemberRole, readonly Permission[]> = {
  owner: ["read", "edit", "delete"],
  admin: ["read", "edit", "delete"],
  editor: ["read", "edit"],
  viewer: ["read"],
};

export function can(role: MemberRole, permission: Permission) {
  return grants[role].includes(permission);
}

export async function listWorkspacesForUser(db: Db, userId: string) {
  return db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(asc(workspaceMembers.createdAt));
}

/**
 * Every workspace-scoped read or write goes through here.
 * Non-members get NotFound, not Forbidden: we do not confirm the workspace exists.
 */
export async function requireMembership(
  db: Db,
  userId: string,
  workspaceId: string,
  permission: Permission = "read",
) {
  if (!isUuid(workspaceId)) throw new NotFoundError();
  const [row] = await db
    .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        eq(workspaceMembers.workspaceId, workspaceId),
      ),
    );
  if (!row) throw new NotFoundError();
  if (!can(row.role, permission)) throw new ForbiddenError();
  return row;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Guards against malformed ids reaching Postgres, which would raise instead of returning no row. */
export function isUuid(value: string) {
  return UUID_RE.test(value);
}
