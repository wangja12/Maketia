import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/db";
import { mcpAuditLog, mcpTokens, users } from "@/db/schema";
import { NotFoundError, ValidationError } from "./errors";
import { fieldErrorsOf } from "./validation";
import { can, isUuid, requireMembership } from "./workspaces";

const TOKEN_PREFIX = "tia_";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const createSchema = z.object({
  name: z.string().trim().min(1, "Nommez la connexion (ex. Claude Desktop)").max(60, "60 caractères maximum"),
  access: z.enum(["read", "write"]),
});

/** Returns the raw token once; only its hash is stored. */
export async function createMcpToken(db: Db, userId: string, workspaceId: string, input: unknown) {
  const member = await requireMembership(db, userId, workspaceId, "read");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Vérifiez les champs", fieldErrorsOf(parsed.error));
  if (parsed.data.access === "write" && !can(member.role, "edit")) {
    throw new ValidationError("Votre rôle est en lecture seule : créez une connexion en lecture.", { access: "Lecture seule pour votre rôle" });
  }
  const token = TOKEN_PREFIX + randomBytes(32).toString("base64url");
  const [row] = await db
    .insert(mcpTokens)
    .values({ workspaceId, userId, name: parsed.data.name, access: parsed.data.access, tokenHash: hashToken(token) })
    .returning();
  return { token, row };
}

export async function listMcpTokens(db: Db, userId: string, workspaceId: string) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select({
      id: mcpTokens.id,
      name: mcpTokens.name,
      access: mcpTokens.access,
      userId: mcpTokens.userId,
      lastUsedAt: mcpTokens.lastUsedAt,
      revokedAt: mcpTokens.revokedAt,
      createdAt: mcpTokens.createdAt,
    })
    .from(mcpTokens)
    .where(eq(mcpTokens.workspaceId, workspaceId))
    .orderBy(desc(mcpTokens.createdAt));
}

/** The creator can revoke their own token; owners and admins can revoke any in the workspace. */
export async function revokeMcpToken(db: Db, userId: string, tokenId: string) {
  if (!isUuid(tokenId)) throw new NotFoundError();
  const [token] = await db.select().from(mcpTokens).where(eq(mcpTokens.id, tokenId));
  if (!token) throw new NotFoundError();
  const member = await requireMembership(db, userId, token.workspaceId, "read");
  if (token.userId !== userId && !can(member.role, "delete")) throw new NotFoundError();
  await db.update(mcpTokens).set({ revokedAt: sql`now()` }).where(and(eq(mcpTokens.id, tokenId), isNull(mcpTokens.revokedAt)));
}

export type McpContext = {
  tokenId: string;
  tokenName: string;
  userId: string;
  workspaceId: string;
  /** Effective rights: the token's access capped by the user's current role. */
  canWrite: boolean;
};

/** Resolves a bearer token to its context, or null if unknown, revoked or no longer a member. */
export async function authenticateMcpToken(db: Db, token: string): Promise<McpContext | null> {
  if (!token.startsWith(TOKEN_PREFIX)) return null;
  const [row] = await db
    .select()
    .from(mcpTokens)
    .where(and(eq(mcpTokens.tokenHash, hashToken(token)), isNull(mcpTokens.revokedAt)));
  if (!row) return null;
  const [owner] = await db.select({ suspendedAt: users.suspendedAt }).from(users).where(eq(users.id, row.userId));
  if (!owner || owner.suspendedAt) return null;
  let role;
  try {
    role = (await requireMembership(db, row.userId, row.workspaceId, "read")).role;
  } catch {
    return null;
  }
  await db.update(mcpTokens).set({ lastUsedAt: sql`now()` }).where(eq(mcpTokens.id, row.id));
  return {
    tokenId: row.id,
    tokenName: row.name,
    userId: row.userId,
    workspaceId: row.workspaceId,
    canWrite: row.access === "write" && can(role, "edit"),
  };
}

export const RATE_LIMIT_PER_MINUTE = 120;

/** Counted from the audit log, so the limit holds across server instances. */
export async function isRateLimited(db: Db, tokenId: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mcpAuditLog)
    .where(and(eq(mcpAuditLog.tokenId, tokenId), gt(mcpAuditLog.createdAt, sql`now() - interval '1 minute'`)));
  return n >= RATE_LIMIT_PER_MINUTE;
}

export async function recordMcpCall(
  db: Db,
  ctx: McpContext,
  entry: { tool: string; kind?: "read" | "write" | "design"; resourceId?: string | null; ok: boolean; error?: string | null; durationMs?: number },
) {
  await db.insert(mcpAuditLog).values({
    tokenId: ctx.tokenId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    tool: entry.tool,
    kind: entry.kind ?? "read",
    durationMs: entry.durationMs ?? null,
    resourceId: entry.resourceId ?? null,
    ok: entry.ok,
    error: entry.error?.slice(0, 500) ?? null,
  });
}

export async function listMcpAudit(db: Db, userId: string, workspaceId: string, limit = 50) {
  await requireMembership(db, userId, workspaceId, "read");
  return db
    .select({
      id: mcpAuditLog.id,
      tool: mcpAuditLog.tool,
      resourceId: mcpAuditLog.resourceId,
      ok: mcpAuditLog.ok,
      error: mcpAuditLog.error,
      createdAt: mcpAuditLog.createdAt,
      tokenName: mcpTokens.name,
    })
    .from(mcpAuditLog)
    .leftJoin(mcpTokens, eq(mcpTokens.id, mcpAuditLog.tokenId))
    .where(eq(mcpAuditLog.workspaceId, workspaceId))
    .orderBy(desc(mcpAuditLog.createdAt))
    .limit(limit);
}
