CREATE TYPE "public"."author_kind" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TYPE "public"."mcp_access" AS ENUM('read', 'write');--> statement-breakpoint
CREATE TYPE "public"."page_kind" AS ENUM('landing', 'sales', 'offer', 'order', 'checkout', 'thank_you', 'confirmation', 'upsell', 'other');--> statement-breakpoint
CREATE TABLE "mcp_audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"token_id" uuid,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid,
	"tool" text NOT NULL,
	"resource_id" text,
	"ok" boolean NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"access" "mcp_access" NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "page_versions" (
	"page_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"content" jsonb NOT NULL,
	"author_kind" "author_kind" NOT NULL,
	"author_user_id" uuid,
	"mcp_token_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_versions_page_id_version_pk" PRIMARY KEY("page_id","version")
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" "page_kind" NOT NULL,
	"variant_group_id" uuid NOT NULL,
	"variant_label" text DEFAULT 'A' NOT NULL,
	"current_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "funnels" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_token_id_mcp_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_audit_log" ADD CONSTRAINT "mcp_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_tokens" ADD CONSTRAINT "mcp_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "page_versions" ADD CONSTRAINT "page_versions_mcp_token_id_mcp_tokens_id_fk" FOREIGN KEY ("mcp_token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mcp_audit_workspace_idx" ON "mcp_audit_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_audit_token_idx" ON "mcp_audit_log" USING btree ("token_id","created_at");--> statement-breakpoint
CREATE INDEX "mcp_tokens_workspace_idx" ON "mcp_tokens" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "pages_funnel_idx" ON "pages" USING btree ("funnel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_group_label_idx" ON "pages" USING btree ("variant_group_id","variant_label");