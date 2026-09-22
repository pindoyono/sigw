ALTER TABLE "dapodik_configs" ADD COLUMN "cf_access_client_id" text;--> statement-breakpoint
ALTER TABLE "dapodik_configs" ADD COLUMN "cf_access_client_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "dapodik_ptk_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "must_change_password" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_dapodik_ptk_id_unique" UNIQUE("dapodik_ptk_id");