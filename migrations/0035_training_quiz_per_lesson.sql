ALTER TABLE "training_quiz" DROP CONSTRAINT "training_quiz_course_id_unique";--> statement-breakpoint
ALTER TABLE "training_quiz" ADD COLUMN "lesson_id" uuid;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_lesson_id_training_lesson_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."training_lesson"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "training_quiz_course_final_unique" ON "training_quiz" USING btree ("course_id") WHERE "training_quiz"."lesson_id" IS NULL;--> statement-breakpoint
ALTER TABLE "training_quiz" ADD CONSTRAINT "training_quiz_lesson_id_unique" UNIQUE("lesson_id");