CREATE TYPE "public"."product_kind" AS ENUM('digital_file', 'service', 'booking', 'no_delivery');--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'payment_unmatched';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivery_queued';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivered';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'delivery_failed';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE 'cancelled';--> statement-breakpoint
CREATE TABLE "saspay_webhook_endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token" text NOT NULL,
	"signing_secret" text,
	"secret_updated_at" timestamp with time zone,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saspay_webhook_endpoints_workspace_id_unique" UNIQUE("workspace_id"),
	CONSTRAINT "saspay_webhook_endpoints_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "saspay_webhook_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"body_sha256" text NOT NULL,
	"raw_body" text NOT NULL,
	"signature_headers" jsonb NOT NULL,
	"verification" text NOT NULL,
	"event_type" text,
	"transaction_ref" text,
	"status" text DEFAULT 'to_reconcile' NOT NULL,
	"matched_order_id" uuid,
	"resolved_by" uuid,
	"resolved_at" timestamp with time zone,
	"note" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" text DEFAULT 'cinetpay' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "paid_via" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD COLUMN "saspay_link_hosts" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "kind" "product_kind" DEFAULT 'no_delivery' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "saspay_link_url" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "price_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "phone_required" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "saspay_webhook_endpoints" ADD CONSTRAINT "saspay_webhook_endpoints_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saspay_webhook_events" ADD CONSTRAINT "saspay_webhook_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saspay_webhook_events" ADD CONSTRAINT "saspay_webhook_events_matched_order_id_orders_id_fk" FOREIGN KEY ("matched_order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saspay_webhook_events" ADD CONSTRAINT "saspay_webhook_events_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saspay_events_dedup_idx" ON "saspay_webhook_events" USING btree ("workspace_id","body_sha256");--> statement-breakpoint
CREATE INDEX "saspay_events_workspace_idx" ON "saspay_webhook_events" USING btree ("workspace_id","received_at");