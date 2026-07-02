CREATE TYPE "public"."course_status_enum" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."course_visibility_enum" AS ENUM('global', 'org');--> statement-breakpoint
CREATE TYPE "public"."enrollment_status_enum" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."lesson_type_enum" AS ENUM('video', 'graphics');--> statement-breakpoint
CREATE TYPE "public"."question_type_enum" AS ENUM('single', 'multiple');--> statement-breakpoint
CREATE TABLE "training_certificate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"course_id" uuid NOT NULL,
	"org_id" uuid,
	"score_pct" integer,
	"issued_at" timestamp DEFAULT now() NOT NULL,
	"certificate_no" varchar,
	CONSTRAINT "training_certificate_enrollment_id_unique" UNIQUE("enrollment_id")
);
--> statement-breakpoint
CREATE TABLE "training_choice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_course" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"branch_id" uuid,
	"visibility" "course_visibility_enum" DEFAULT 'global' NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"status" "course_status_enum" DEFAULT 'draft' NOT NULL,
	"passing_score" integer DEFAULT 80 NOT NULL,
	"require_content_before_quiz" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_enrollment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"org_id" uuid,
	"status" "enrollment_status_enum" DEFAULT 'in_progress' NOT NULL,
	"enrolled_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	CONSTRAINT "training_enrollment_course_id_user_id_unique" UNIQUE("course_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "training_lesson" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"type" "lesson_type_enum" NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_required" boolean DEFAULT true NOT NULL,
	"video_url" text,
	"video_duration_sec" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_lesson_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"asset_url" text NOT NULL,
	"caption" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"progress_pct" integer DEFAULT 0 NOT NULL,
	"last_viewed_at" timestamp,
	CONSTRAINT "training_lesson_progress_enrollment_id_lesson_id_unique" UNIQUE("enrollment_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "training_question" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"text" text NOT NULL,
	"type" "question_type_enum" DEFAULT 'single' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"points" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_quiz" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "training_quiz_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
CREATE TABLE "training_quiz_attempt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"score_pct" integer,
	"passed" boolean,
	"answers_snapshot" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"submitted_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "training_certificate" ADD CONSTRAINT "training_certificate_enrollment_id_training_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificate" ADD CONSTRAINT "training_certificate_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificate" ADD CONSTRAINT "training_certificate_course_id_training_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_certificate" ADD CONSTRAINT "training_certificate_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_choice" ADD CONSTRAINT "training_choice_question_id_training_question_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."training_question"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_course" ADD CONSTRAINT "training_course_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_course_id_training_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_enrollment" ADD CONSTRAINT "training_enrollment_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson" ADD CONSTRAINT "training_lesson_course_id_training_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_asset" ADD CONSTRAINT "training_lesson_asset_lesson_id_training_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_enrollment_id_training_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson_progress" ADD CONSTRAINT "training_lesson_progress_lesson_id_training_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_question" ADD CONSTRAINT "training_question_quiz_id_training_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."training_quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_course_id_training_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_quiz_attempt" ADD CONSTRAINT "training_quiz_attempt_enrollment_id_training_enrollment_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."training_enrollment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_quiz_attempt" ADD CONSTRAINT "training_quiz_attempt_quiz_id_training_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."training_quiz"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_quiz_attempt" ADD CONSTRAINT "training_quiz_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;