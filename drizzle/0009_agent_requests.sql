CREATE TABLE "agent_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token_id" uuid,
	"requested_by" uuid,
	"kind" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"params" jsonb NOT NULL,
	"reason" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"result" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_token_id_mcp_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."mcp_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_requests" ADD CONSTRAINT "agent_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_requests_workspace_idx" ON "agent_requests" USING btree ("workspace_id","status","created_at");