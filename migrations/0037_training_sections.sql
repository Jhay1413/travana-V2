CREATE TABLE "training_section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL,
	"title" varchar NOT NULL,
	"description" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "training_quiz_course_final_unique";--> statement-breakpoint
ALTER TABLE "training_section" ADD CONSTRAINT "training_section_course_id_training_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."training_course"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_lesson" ADD COLUMN "section_id" uuid;--> statement-breakpoint
-- Backfill: every course that already has lessons gets one default section
-- ("Section 1") and its existing lessons move into it, keeping their order.
INSERT INTO "training_section" ("course_id", "title", "position")
SELECT DISTINCT "course_id", 'Section 1', 0 FROM "training_lesson";--> statement-breakpoint
UPDATE "training_lesson" l
SET "section_id" = s."id"
FROM "training_section" s
WHERE s."course_id" = l."course_id";--> statement-breakpoint
ALTER TABLE "training_lesson" ALTER COLUMN "section_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD COLUMN "section_id" uuid;--> statement-breakpoint
ALTER TABLE "training_lesson" ADD CONSTRAINT "training_lesson_section_id_training_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."training_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_section_id_training_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."training_section"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_quiz_course_final_unique" ON "training_quiz" USING btree ("course_id") WHERE "training_quiz"."lesson_id" IS NULL AND "training_quiz"."section_id" IS NULL;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_section_id_unique" UNIQUE("section_id");--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_single_target_check" CHECK ("training_quiz"."lesson_id" IS NULL OR "training_quiz"."section_id" IS NULL);
