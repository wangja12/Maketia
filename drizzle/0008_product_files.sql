CREATE TABLE "download_grants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"file_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"max_downloads" integer NOT NULL,
	"downloads" integer DEFAULT 0 NOT NULL,
	"last_download_at" timestamp with time zone,
	"created_by" uuid,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "download_grants_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "product_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"title" text NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_files_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_file_id_product_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."product_files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_grants" ADD CONSTRAINT "download_grants_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "download_grants_order_idx" ON "download_grants" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "product_files_product_idx" ON "product_files" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_files_workspace_idx" ON "product_files" USING btree ("workspace_id");