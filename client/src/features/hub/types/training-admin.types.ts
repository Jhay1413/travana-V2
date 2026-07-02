import type { LessonType } from "./training.types";

/**
 * A lesson being authored in-memory while its parent course doesn't exist on
 * the server yet (course create-mode). Held entirely in React state and only
 * sent to the API once the course form is submitted — see
 * `TrainingCourseEditor`'s create-mode submit handler, which creates the
 * course, then each draft lesson in order, then uploads any staged graphics
 * files against the newly-created lesson id.
 */
export interface DraftLesson {
  /** Client-only id used for list keys/reordering; never sent to the server. */
  tempId: string;
  title: string;
  description: string;
  type: LessonType;
  isRequired: boolean;
  /** Video lessons: the `playbackUrl` returned by `uploadVideoToS3`, set once the upload finishes (upload happens during authoring, independent of the course/lesson id). */
  videoUrl: string | null;
  /** Graphics lessons: images staged locally; uploaded via `uploadAssets` right after the lesson is created on submit. */
  files: File[];
}
