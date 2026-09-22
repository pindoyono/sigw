ALTER TABLE "users" ADD COLUMN "nik" varchar(20);--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_nik_unique" UNIQUE("nik");