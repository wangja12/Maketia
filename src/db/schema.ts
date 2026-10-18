import {
  boolean,
  bigserial,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  index,
} from "drizzle-orm/pg-core";

import type { FunnelBrief } from "@/server/brief";
import type { PageContent } from "@/server/page-schema";

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Stored lowercased; uniqueness is enforced by the database.
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the token held in the cookie: a database leak does not leak live sessions.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const memberRole = pgEnum("member_role", [
  "owner",
  "admin",
  "editor",
  "viewer",
]);

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index("workspace_members_user_idx").on(t.userId),
  ],
);

export const funnelStatus = pgEnum("funnel_status", [
  "draft",
  "published",
  "archived",
]);

export const funnels = pgTable(
  "funnels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: funnelStatus("status").notNull().default("draft"),
    // Offer description filled in by the user; read by external agents through MCP.
    brief: jsonb("brief").$type<FunnelBrief>(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("funnels_workspace_slug_idx").on(t.workspaceId, t.slug)],
);

export const pageKind = pgEnum("page_kind", [
  "landing",
  "sales",
  "offer",
  "order",
  "checkout",
  "thank_you",
  "confirmation",
  "upsell",
  "other",
]);

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: pageKind("kind").notNull(),
    // Pages that are variants of each other share a group (the id of the first page).
    variantGroupId: uuid("variant_group_id").notNull(),
    variantLabel: text("variant_label").notNull().default("A"),
    currentVersion: integer("current_version").notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("pages_funnel_idx").on(t.funnelId),
    uniqueIndex("pages_group_label_idx").on(t.variantGroupId, t.variantLabel),
  ],
);

export const authorKind = pgEnum("author_kind", ["user", "agent"]);

/** Immutable: a change always appends a version, so nothing is overwritten silently. */
export const pageVersions = pgTable(
  "page_versions",
  {
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    content: jsonb("content").$type<PageContent>().notNull(),
    authorKind: authorKind("author_kind").notNull(),
    authorUserId: uuid("author_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    mcpTokenId: uuid("mcp_token_id").references(() => mcpTokens.id, {
      onDelete: "set null",
    }),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.pageId, t.version] })],
);

export const mcpAccess = pgEnum("mcp_access", ["read", "write"]);

export const mcpTokens = pgTable(
  "mcp_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    // The agent acts as this user; their current role still applies on every call.
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    access: mcpAccess("access").notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("mcp_tokens_workspace_idx").on(t.workspaceId)],
);

export const mcpAuditLog = pgTable(
  "mcp_audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tokenId: uuid("token_id").references(() => mcpTokens.id, {
      onDelete: "set null",
    }),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    tool: text("tool").notNull(),
    resourceId: text("resource_id"),
    ok: boolean("ok").notNull(),
    error: text("error"),
    createdAt: createdAt(),
  },
  (t) => [
    index("mcp_audit_workspace_idx").on(t.workspaceId, t.createdAt),
    index("mcp_audit_token_idx").on(t.tokenId, t.createdAt),
  ],
);

export type MemberRole = (typeof memberRole.enumValues)[number];
export type Funnel = typeof funnels.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageKind = (typeof pageKind.enumValues)[number];
export type McpToken = typeof mcpTokens.$inferSelect;
