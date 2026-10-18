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
import { sql } from "drizzle-orm";

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
    // Public address <subdomain>.<PUBLIC_ROOT_DOMAIN>; unique on the whole platform, set at first publication.
    subdomain: text("subdomain").unique(),
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

/**
 * One row per publish action, never deleted: the history of what was live and when.
 * A path has at most one live row (unpublishedAt null), enforced by a partial unique index.
 */
export const publications = pgTable(
  "publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    // "" is the home page of the site; otherwise one lowercase segment.
    path: text("path").notNull(),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    unpublishedAt: timestamp("unpublished_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("publications_live_path_idx").on(t.funnelId, t.path).where(sql`${t.unpublishedAt} is null`),
    index("publications_page_idx").on(t.pageId),
  ],
);

export const domainStatus = pgEnum("domain_status", ["pending", "verified", "misconfigured"]);

export const domains = pgTable(
  "domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    hostname: text("hostname").notNull(),
    // Proves ownership: must appear in a TXT record only the domain owner can create.
    verificationToken: text("verification_token").notNull(),
    status: domainStatus("status").notNull().default("pending"),
    lastError: text("last_error"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // Several workspaces may claim a hostname, but only one can hold it verified.
    uniqueIndex("domains_verified_hostname_idx").on(t.hostname).where(sql`${t.status} = 'verified'`),
    uniqueIndex("domains_workspace_hostname_idx").on(t.workspaceId, t.hostname),
  ],
);

export const paymentProviderKind = pgEnum("payment_provider_kind", ["cinetpay"]);
export const providerEnvironment = pgEnum("provider_environment", ["sandbox", "production"]);
export const connectionStatus = pgEnum("connection_status", ["unverified", "verified", "failed"]);

/** A merchant account of a payment provider. Credentials are encrypted at rest (AES-256-GCM). */
export const paymentProviders = pgTable(
  "payment_providers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    provider: paymentProviderKind("provider").notNull(),
    environment: providerEnvironment("environment").notNull(),
    // One CinetPay account serves one country (and its currency).
    country: text("country").notNull(),
    credentials: text("credentials").notNull(),
    status: connectionStatus("status").notNull().default("unverified"),
    lastError: text("last_error"),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payment_providers_workspace_idx").on(t.workspaceId, t.provider, t.country)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Whole units of the currency (XOF, XAF, GNF and CDF are charged without decimals).
    price: integer("price").notNull(),
    currency: text("currency").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("products_workspace_idx").on(t.workspaceId)],
);

export const orderStatus = pgEnum("order_status", ["started", "pending", "paid", "failed", "expired"]);

/**
 * An end customer's order. "paid" is set only from the provider's own status API,
 * never from a browser redirect or the content of a webhook.
 */
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id").references(() => funnels.id, { onDelete: "set null" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    variantLabel: text("variant_label"),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    status: orderStatus("status").notNull().default("started"),
    providerId: uuid("provider_id").references(() => paymentProviders.id, { onDelete: "set null" }),
    // Our reference sent to the provider (≤ 30 characters).
    merchantTransactionId: text("merchant_transaction_id").notNull().unique(),
    providerTransactionId: text("provider_transaction_id"),
    // SHA-256 of the notify_token returned at initialization; webhooks must present the token.
    notifyTokenHash: text("notify_token_hash"),
    paymentUrl: text("payment_url"),
    providerStatus: text("provider_status"),
    customerFirstName: text("customer_first_name").notNull(),
    customerLastName: text("customer_last_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    // For abuse limits only: SHA-256 of the client IP, never the IP itself.
    ipHash: text("ip_hash"),
    // Attribution: the anonymous visitor and the experiment the order came from.
    visitorId: text("visitor_id"),
    experimentId: uuid("experiment_id"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("orders_workspace_idx").on(t.workspaceId, t.createdAt),
    index("orders_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/** Append-only trail of everything that happened to an order's payment. */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    providerStatus: text("provider_status"),
    detail: text("detail"),
    createdAt: createdAt(),
  },
  (t) => [index("payment_events_order_idx").on(t.orderId, t.createdAt)],
);

export const experimentStatus = pgEnum("experiment_status", ["draft", "running", "stopped"]);
export const experimentGoal = pgEnum("experiment_goal", ["order_paid", "checkout_submitted", "cta_click"]);

/** A/B test on one path of a funnel, between 2 and 4 pages of the same variant group. */
export const experiments = pgTable(
  "experiments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    variantGroupId: uuid("variant_group_id").notNull(),
    name: text("name").notNull(),
    // Chosen before starting and never changed afterwards (no goal-switching after the fact).
    goal: experimentGoal("goal").notNull(),
    status: experimentStatus("status").notNull().default("draft"),
    path: text("path"),
    winnerPageId: uuid("winner_page_id").references(() => pages.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    stoppedAt: timestamp("stopped_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("experiments_funnel_idx").on(t.funnelId),
    // One running test per path.
    uniqueIndex("experiments_running_path_idx").on(t.funnelId, t.path).where(sql`${t.status} = 'running'`),
  ],
);

export const experimentArms = pgTable(
  "experiment_arms",
  {
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    pageId: uuid("page_id")
      .notNull()
      .references(() => pages.id, { onDelete: "cascade" }),
    variantLabel: text("variant_label").notNull(),
    // Frozen when the experiment starts (or when the arm is added to a running one).
    version: integer("version"),
    // Relative traffic share, 1–100.
    weight: integer("weight").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.pageId] })],
);

/** Sticky assignment: a visitor sees the same arm for the whole experiment. */
export const experimentAssignments = pgTable(
  "experiment_assignments",
  {
    experimentId: uuid("experiment_id")
      .notNull()
      .references(() => experiments.id, { onDelete: "cascade" }),
    visitorId: text("visitor_id").notNull(),
    pageId: uuid("page_id").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.experimentId, t.visitorId] })],
);

export const eventType = pgEnum("event_type", ["page_view", "cta_click", "checkout_submitted", "order_paid"]);

/**
 * Measured events only: page views and clicks come from the visitor's browser with a
 * server-signed token; checkouts and payments are written by the server itself.
 * The unique index makes every event count once.
 */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    funnelId: uuid("funnel_id")
      .notNull()
      .references(() => funnels.id, { onDelete: "cascade" }),
    pageId: uuid("page_id").references(() => pages.id, { onDelete: "set null" }),
    variantLabel: text("variant_label"),
    experimentId: uuid("experiment_id").references(() => experiments.id, { onDelete: "set null" }),
    type: eventType("type").notNull(),
    visitorId: text("visitor_id").notNull(),
    sessionId: text("session_id"),
    dedupKey: text("dedup_key").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    amount: integer("amount"),
    currency: text("currency"),
    source: text("source"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("events_dedup_idx").on(t.type, t.funnelId, t.visitorId, t.dedupKey),
    index("events_funnel_time_idx").on(t.funnelId, t.createdAt),
    index("events_experiment_idx").on(t.experimentId, t.type),
  ],
);

export type MemberRole = (typeof memberRole.enumValues)[number];
export type Funnel = typeof funnels.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type PageKind = (typeof pageKind.enumValues)[number];
export type McpToken = typeof mcpTokens.$inferSelect;
export type Publication = typeof publications.$inferSelect;
export type PaymentProvider = typeof paymentProviders.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Experiment = typeof experiments.$inferSelect;
export type ExperimentArm = typeof experimentArms.$inferSelect;
export type Domain = typeof domains.$inferSelect;
