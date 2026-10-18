CREATE TYPE "public"."connection_status" AS ENUM('unverified', 'verified', 'failed');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('started', 'pending', 'paid', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."payment_provider_kind" AS ENUM('cinetpay');--> statement-breakpoint
CREATE TYPE "public"."provider_environment" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"funnel_id" uuid,
	"page_id" uuid,
	"variant_label" text,
	"product_id" uuid,
	"product_name" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "order_status" DEFAULT 'started' NOT NULL,
	"provider_id" uuid,
	"merchant_transaction_id" text NOT NULL,
	"provider_transaction_id" text,
	"notify_token_hash" text,
	"payment_url" text,
	"provider_status" text,
	"customer_first_name" text NOT NULL,
	"customer_last_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text,
	"ip_hash" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_merchant_transaction_id_unique" UNIQUE("merchant_transaction_id")
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"provider_status" text,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"provider" "payment_provider_kind" NOT NULL,
	"environment" "provider_environment" NOT NULL,
	"country" text NOT NULL,
	"credentials" text NOT NULL,
	"status" "connection_status" DEFAULT 'unverified' NOT NULL,
	"last_error" text,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"currency" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_provider_id_payment_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."payment_providers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_providers" ADD CONSTRAINT "payment_providers_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_workspace_idx" ON "orders" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_ip_idx" ON "orders" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "payment_events_order_idx" ON "payment_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_providers_workspace_idx" ON "payment_providers" USING btree ("workspace_id","provider","country");--> statement-breakpoint
CREATE INDEX "products_workspace_idx" ON "products" USING btree ("workspace_id");