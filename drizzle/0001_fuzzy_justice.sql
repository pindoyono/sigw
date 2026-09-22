CREATE TYPE "public"."psychometric_risk" AS ENUM('rendah', 'sedang', 'tinggi');--> statement-breakpoint
CREATE TABLE "psychometric_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instrument_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"item_scores" jsonb NOT NULL,
	"total_score" integer NOT NULL,
	"subscale_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_category" "psychometric_risk" NOT NULL,
	"notes" text,
	"filled_at" date NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "psychometric_instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"scale_min" integer DEFAULT 1 NOT NULL,
	"scale_max" integer DEFAULT 4 NOT NULL,
	"scale_labels" jsonb DEFAULT '[]'::jsonb,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "psychometric_instruments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "psychometric_assessments" ADD CONSTRAINT "psychometric_assessments_instrument_id_psychometric_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."psychometric_instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_assessments" ADD CONSTRAINT "psychometric_assessments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "psychometric_assessments" ADD CONSTRAINT "psychometric_assessments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;