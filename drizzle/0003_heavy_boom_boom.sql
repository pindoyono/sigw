CREATE TABLE "dapodik_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"base_url" text NOT NULL,
	"npsn" varchar(20) NOT NULL,
	"token" text NOT NULL,
	"last_synced_at" timestamp,
	"last_sync_summary" jsonb,
	"created_by" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dapodik_configs_school_id_unique" UNIQUE("school_id")
);
--> statement-breakpoint
ALTER TABLE "classes" ADD COLUMN "dapodik_id" uuid;--> statement-breakpoint
ALTER TABLE "dapodik_configs" ADD CONSTRAINT "dapodik_configs_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dapodik_configs" ADD CONSTRAINT "dapodik_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_dapodik_id_unique" UNIQUE("dapodik_id");