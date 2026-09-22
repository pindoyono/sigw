CREATE TYPE "public"."achievement_category" AS ENUM('akademik', 'non_akademik');--> statement-breakpoint
CREATE TYPE "public"."attendance_status" AS ENUM('hadir', 'sakit', 'izin', 'alpa');--> statement-breakpoint
CREATE TYPE "public"."collaborator_type" AS ENUM('guru_bk', 'wali_kelas', 'guru_mapel', 'lainnya');--> statement-breakpoint
CREATE TYPE "public"."education_level" AS ENUM('tk', 'sd', 'smp', 'sma_smk');--> statement-breakpoint
CREATE TYPE "public"."gender" AS ENUM('laki_laki', 'perempuan');--> statement-breakpoint
CREATE TYPE "public"."parent_relation" AS ENUM('kandung', 'tiri');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('aman', 'waspada', 'berisiko_tinggi');--> statement-breakpoint
CREATE TYPE "public"."service_orientation" AS ENUM('akademik', 'kompetensi_keterampilan', 'karakter');--> statement-breakpoint
CREATE TYPE "public"."smart_goal_status" AS ENUM('berjalan', 'tercapai', 'tidak_tercapai');--> statement-breakpoint
CREATE TYPE "public"."ticket_category" AS ENUM('akademik', 'sosial_karakter', 'belum_ditentukan');--> statement-breakpoint
CREATE TYPE "public"."ticket_severity" AS ENUM('ringan', 'sedang', 'berat');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('baru', 'koordinasi_awal', 'jalur_a_akademik', 'jalur_b_bk', 'pelibatan_orang_tua', 'eskalasi_kepala_sekolah', 'implementasi', 'evaluasi', 'selesai');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'kepala_sekolah', 'guru_wali', 'guru_bk', 'wali_kelas', 'guru_mapel');--> statement-breakpoint
CREATE TABLE "academic_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject" varchar(100) NOT NULL,
	"term" varchar(20) NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"recorded_at" date DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"retrieved_chunk_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_document" varchar(255) NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"status" "attendance_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_year_id" uuid NOT NULL,
	"name" varchar(50) NOT NULL,
	"wali_kelas_id" uuid
);
--> statement-breakpoint
CREATE TABLE "collaboration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"ticket_id" uuid,
	"log_date" date NOT NULL,
	"collaborator_type" "collaborator_type" NOT NULL,
	"collaborator_name" varchar(255),
	"collaboration_forms" jsonb DEFAULT '[]'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consultation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"ticket_id" uuid,
	"log_date" date NOT NULL,
	"problem_discussed" text NOT NULL,
	"advice_follow_up" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discipline_points" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"date" date NOT NULL,
	"points" integer NOT NULL,
	"reason" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ews_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"attendance_rate" numeric(5, 2) NOT NULL,
	"academic_trend" numeric(6, 2) NOT NULL,
	"discipline_score" integer NOT NULL,
	"sentiment_trend" numeric(4, 3),
	"risk_score" numeric(5, 2) NOT NULL,
	"risk_level" "risk_level" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_guidance_participants" (
	"session_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	CONSTRAINT "group_guidance_participants_session_id_student_id_pk" PRIMARY KEY("session_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "group_guidance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"time_range" varchar(50),
	"service_orientation" "service_orientation" NOT NULL,
	"topic" varchar(255) NOT NULL,
	"technique" varchar(255),
	"experientation_notes" jsonb DEFAULT '[]'::jsonb,
	"result_notes" jsonb DEFAULT '[]'::jsonb,
	"follow_up_notes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guru_wali_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"sk_number" varchar(100),
	"sk_file_url" text,
	"start_date" date NOT NULL,
	"end_date" date,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "home_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"ticket_id" uuid,
	"visit_date" date NOT NULL,
	"time_range" varchar(50),
	"service_orientation" "service_orientation",
	"family_met" varchar(255),
	"other_parties_involved" varchar(255),
	"problem_summary" jsonb DEFAULT '[]'::jsonb,
	"follow_up_plan" jsonb DEFAULT '[]'::jsonb,
	"special_notes" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(20) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"npsn" varchar(20),
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "smart_goal_checkins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"smart_goal_id" uuid NOT NULL,
	"checkin_date" date DEFAULT now() NOT NULL,
	"progress_percent" integer NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "smart_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"specific_desc" text,
	"measurable_target" varchar(255),
	"achievable_notes" text,
	"relevant_notes" text,
	"deadline" date,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"status" "smart_goal_status" DEFAULT 'berjalan' NOT NULL,
	"semester" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_academic_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"level" "education_level" NOT NULL,
	"school_name" varchar(255),
	"entry_year" integer,
	"exit_year" integer
);
--> statement-breakpoint
CREATE TABLE "student_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"level" "education_level" NOT NULL,
	"category" "achievement_category" NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_guardians" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"father_name" varchar(255),
	"father_job" varchar(150),
	"father_ethnicity" varchar(100),
	"father_relation" "parent_relation",
	"mother_name" varchar(255),
	"mother_job" varchar(150),
	"mother_ethnicity" varchar(100),
	"mother_relation" "parent_relation",
	"parent_phone" varchar(30),
	CONSTRAINT "student_guardians_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "student_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"extracurriculars" jsonb DEFAULT '[]'::jsonb,
	"career_aspirations" jsonb DEFAULT '[]'::jsonb,
	"further_study_aspiration" varchar(255),
	"favorite_subjects" jsonb DEFAULT '[]'::jsonb,
	"weak_subjects" jsonb DEFAULT '[]'::jsonb,
	"hobbies" jsonb DEFAULT '[]'::jsonb,
	"skills_mastered" jsonb DEFAULT '[]'::jsonb,
	"skills_wanted" jsonb DEFAULT '[]'::jsonb,
	"obstacles" jsonb,
	"discipline_notes" text,
	"empathy_notes" text,
	"emotion_regulation_notes" text,
	"self_reflection" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "student_profiles_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"class_id" uuid,
	"nisn" varchar(20) NOT NULL,
	"full_name" varchar(255) NOT NULL,
	"nickname" varchar(100),
	"gender" "gender" NOT NULL,
	"birth_place" varchar(100),
	"birth_date" date,
	"religion" varchar(50),
	"address" text,
	"child_order" integer,
	"siblings_count" integer,
	"phone" varchar(30),
	"social_media" varchar(255),
	"chronic_illness" jsonb DEFAULT '[]'::jsonb,
	"photo_url" text,
	"enrolled_at" date DEFAULT now(),
	"graduated_at" date,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "students_nisn_unique" UNIQUE("nisn")
);
--> statement-breakpoint
CREATE TABLE "ticket_collaborators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role_in_ticket" varchar(100),
	"tagged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" "ticket_status",
	"to_status" "ticket_status" NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"reporter_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"category" "ticket_category" DEFAULT 'belum_ditentukan' NOT NULL,
	"severity" "ticket_severity" DEFAULT 'ringan' NOT NULL,
	"status" "ticket_status" DEFAULT 'baru' NOT NULL,
	"home_visit_required" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"role" "user_role" NOT NULL,
	"nip" varchar(40),
	"phone" varchar(30),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "weekly_reflections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_start_date" date NOT NULL,
	"mood_scale" integer,
	"content" text NOT NULL,
	"sentiment_score" numeric(4, 3),
	"risk_flag" boolean DEFAULT false NOT NULL,
	"ai_analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_plan_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"activity_name" varchar(255) NOT NULL,
	"category" varchar(50) NOT NULL,
	"planned_months" jsonb DEFAULT '[]'::jsonb,
	"evidence_type" varchar(255)
);
--> statement-breakpoint
ALTER TABLE "academic_scores" ADD CONSTRAINT "academic_scores_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_logs" ADD CONSTRAINT "ai_chat_logs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_logs" ADD CONSTRAINT "ai_chat_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classes" ADD CONSTRAINT "classes_wali_kelas_id_users_id_fk" FOREIGN KEY ("wali_kelas_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_logs" ADD CONSTRAINT "collaboration_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_logs" ADD CONSTRAINT "collaboration_logs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_logs" ADD CONSTRAINT "collaboration_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_logs" ADD CONSTRAINT "consultation_logs_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_logs" ADD CONSTRAINT "consultation_logs_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consultation_logs" ADD CONSTRAINT "consultation_logs_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discipline_points" ADD CONSTRAINT "discipline_points_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ews_snapshots" ADD CONSTRAINT "ews_snapshots_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guidance_participants" ADD CONSTRAINT "group_guidance_participants_session_id_group_guidance_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."group_guidance_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guidance_participants" ADD CONSTRAINT "group_guidance_participants_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_guidance_sessions" ADD CONSTRAINT "group_guidance_sessions_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guru_wali_assignments" ADD CONSTRAINT "guru_wali_assignments_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guru_wali_assignments" ADD CONSTRAINT "guru_wali_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visits" ADD CONSTRAINT "home_visits_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visits" ADD CONSTRAINT "home_visits_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "home_visits" ADD CONSTRAINT "home_visits_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_years" ADD CONSTRAINT "school_years_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_goal_checkins" ADD CONSTRAINT "smart_goal_checkins_smart_goal_id_smart_goals_id_fk" FOREIGN KEY ("smart_goal_id") REFERENCES "public"."smart_goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_goals" ADD CONSTRAINT "smart_goals_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "smart_goals" ADD CONSTRAINT "smart_goals_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_academic_history" ADD CONSTRAINT "student_academic_history_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_achievements" ADD CONSTRAINT "student_achievements_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_guardians" ADD CONSTRAINT "student_guardians_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_collaborators" ADD CONSTRAINT "ticket_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_events" ADD CONSTRAINT "ticket_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reflections" ADD CONSTRAINT "weekly_reflections_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_plan_items" ADD CONSTRAINT "work_plan_items_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_plan_items" ADD CONSTRAINT "work_plan_items_school_year_id_school_years_id_fk" FOREIGN KEY ("school_year_id") REFERENCES "public"."school_years"("id") ON DELETE cascade ON UPDATE no action;