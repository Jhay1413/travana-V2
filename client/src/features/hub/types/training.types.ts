/**
 * Client-side mirror of the `training_course` row shape returned by
 * `server/v2/modules/training`. Field names/casing copied verbatim from
 * `shared/schema.ts` (search "=== Training / LMS ===") since the API
 * returns raw Drizzle rows, not camelCased DTOs.
 */
export type CourseStatus = "draft" | "published" | "archived";
export type CourseVisibility = "global" | "org";

export interface TrainingCourse {
  id: string;
  org_id: string | null;
  branch_id: string | null;
  visibility: CourseVisibility;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  status: CourseStatus;
  passing_score: number;
  require_content_before_quiz: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type LessonType = "video" | "graphics";

export interface TrainingLesson {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  type: LessonType;
  position: number;
  is_required: boolean;
  video_url: string | null;
  video_duration_sec: number | null;
  created_at: string;
  updated_at: string;
}

export interface TrainingLessonAsset {
  id: string;
  lesson_id: string;
  asset_url: string;
  caption: string | null;
  position: number;
}

/** A lesson with its ordered graphics assets attached (empty array for video lessons). */
export interface LessonWithAssets extends TrainingLesson {
  assets: TrainingLessonAsset[];
}

/** Single cohesive course-read shape: course + its ordered lessons (+ each lesson's assets). */
export interface CourseWithContent extends TrainingCourse {
  lessons: LessonWithAssets[];
}

export interface TrainingEnrollment {
  id: string;
  course_id: string;
  user_id: string;
  org_id: string | null;
  status: "in_progress" | "completed";
  enrolled_at: string;
  completed_at: string | null;
}

export interface TrainingLessonProgress {
  id: string;
  enrollment_id: string;
  lesson_id: string;
  completed: boolean;
  progress_pct: number;
  last_viewed_at: string | null;
}

export interface LessonProgress {
  lessonId: string;
  completed: boolean;
  progressPct: number;
}

/**
 * === Quiz (Phase 3) ===
 * Mirrors `server/v2/modules/training/training.types.ts` (search "Quiz
 * (Phase 3)"). `isCorrect` is only ever present on choices for
 * `platform_admin` (the authoring builder) — the learner runner never
 * receives it and must grade purely from the attempt `results`.
 */
export type QuestionType = "single" | "multiple";

export interface QuizChoiceView {
  id: string;
  text: string;
  position: number;
  isCorrect?: boolean;
}

export interface QuizQuestionView {
  id: string;
  text: string;
  type: QuestionType;
  points: number;
  position: number;
  choices: QuizChoiceView[];
}

/** `quiz: null` (with empty `questions`) means the course has no quiz yet. */
export interface QuizView {
  quiz: { id: string; title: string | null; shuffleQuestions: boolean } | null;
  questions: QuizQuestionView[];
}

export interface QuizChoiceInput {
  text: string;
  isCorrect: boolean;
}

export interface QuizQuestionInput {
  text: string;
  type: QuestionType;
  points?: number;
  choices: QuizChoiceInput[];
}

/** PUT body for the full replace-upsert of a course's quiz. */
export interface UpsertQuizInput {
  title?: string | null;
  shuffleQuestions?: boolean;
  questions: QuizQuestionInput[];
}

export interface QuizAttemptAnswer {
  questionId: string;
  choiceIds: string[];
}

export interface QuizAttemptQuestionResult {
  questionId: string;
  correct: boolean;
  correctChoiceIds: string[];
  selectedChoiceIds: string[];
}

export interface QuizCertificateView {
  certificate_no: string | null;
  issued_at: string;
}

export interface QuizAttemptResult {
  attemptNumber: number;
  scorePct: number;
  passed: boolean;
  passingScore: number;
  courseCompleted: boolean;
  certificate: QuizCertificateView | null;
  results: QuizAttemptQuestionResult[];
}

export interface MyCourseStatus {
  enrolled: boolean;
  lessonProgress: LessonProgress[];
  contentComplete: boolean;
  hasQuiz: boolean;
  quizPassed: boolean;
  bestScorePct: number | null;
  attemptCount: number;
  courseCompleted: boolean;
  certificate: QuizCertificateView | null;
}

export interface UpdateLessonProgressInput {
  progressPct?: number;
  completed?: boolean;
}

/**
 * === Admin (authoring, platform_admin only) ===
 * Input payload shapes mirror `server/v2/modules/training/*.validator.ts`
 * (camelCase, since these are request bodies, unlike the raw snake_case
 * response row types above).
 */
export interface CreateCourseInput {
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  visibility: CourseVisibility;
  orgId?: string | null;
  passingScore?: number;
  requireContentBeforeQuiz?: boolean;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export interface CreateLessonInput {
  title: string;
  description?: string | null;
  type: LessonType;
  position?: number;
  isRequired?: boolean;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
}

export type UpdateLessonInput = Partial<CreateLessonInput>;

export interface ReorderLessonsInput {
  order: { id: string; position: number }[];
}

export interface AddAssetsInput {
  assets: { assetUrl: string; caption?: string | null; position?: number }[];
}

export interface PresignVideoInput {
  fileName: string;
  contentType: string;
}

export interface PresignVideoResult {
  uploadUrl: string;
  key: string;
  playbackUrl: string;
}
