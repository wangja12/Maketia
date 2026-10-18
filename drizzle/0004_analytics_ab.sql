CREATE TYPE "public"."event_type" AS ENUM('page_view', 'cta_click', 'checkout_submitted', 'order_paid');--> statement-breakpoint
CREATE TYPE "public"."experiment_goal" AS ENUM('order_paid', 'checkout_submitted', 'cta_click');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('draft', 'running', 'stopped');--> statement-breakpoint
CREATE TABLE "events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"workspace_id" uuid NOT NULL,
	"funnel_id" uuid NOT NULL,
	"page_id" uuid,
	"variant_label" text,
	"experiment_id" uuid,
	"type" "event_type" NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text,
	"dedup_key" text NOT NULL,
	"order_id" uuid,
	"amount" integer,
	"currency" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiment_arms" (
	"experiment_id" uuid NOT NULL,
	"page_id" uuid NOT NULL,
	"variant_label" text NOT NULL,
	"version" integer,
	"weight" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_arms_experiment_id_page_id_pk" PRIMARY KEY("experiment_id","page_id")
);
--> statement-breakpoint
CREATE TABLE "experiment_assignments" (
	"experiment_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"page_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "experiment_assignments_experiment_id_visitor_id_pk" PRIMARY KEY("experiment_id","visitor_id")
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"funnel_id" uuid NOT NULL,
	"variant_group_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" "experiment_goal" NOT NULL,
	"status" "experiment_status" DEFAULT 'draft' NOT NULL,
	"path" text,
	"winner_page_id" uuid,
	"created_by" uuid,
	"started_at" timestamp with time zone,
	"stopped_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "visitor_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "experiment_id" uuid;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_arms" ADD CONSTRAINT "experiment_arms_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_arms" ADD CONSTRAINT "experiment_arms_page_id_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiment_assignments" ADD CONSTRAINT "experiment_assignments_experiment_id_experiments_id_fk" FOREIGN KEY ("experiment_id") REFERENCES "public"."experiments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_funnel_id_funnels_id_fk" FOREIGN KEY ("funnel_id") REFERENCES "public"."funnels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_winner_page_id_pages_id_fk" FOREIGN KEY ("winner_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedup_idx" ON "events" USING btree ("type","funnel_id","visitor_id","dedup_key");--> statement-breakpoint
CREATE INDEX "events_funnel_time_idx" ON "events" USING btree ("funnel_id","created_at");--> statement-breakpoint
CREATE INDEX "events_experiment_idx" ON "events" USING btree ("experiment_id","type");--> statement-breakpoint
CREATE INDEX "experiments_funnel_idx" ON "experiments" USING btree ("funnel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "experiments_running_path_idx" ON "experiments" USING btree ("funnel_id","path") WHERE "experiments"."status" = 'running';