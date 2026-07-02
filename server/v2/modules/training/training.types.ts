export type {
  TrainingCourse,
  InsertTrainingCourse,
  TrainingLesson,
  InsertTrainingLesson,
  TrainingLessonAsset,
  InsertTrainingLessonAsset,
  TrainingEnrollment,
  TrainingLessonProgress,
  TrainingQuiz,
  InsertTrainingQuiz,
  TrainingQuestion,
  InsertTrainingQuestion,
  TrainingChoice,
  InsertTrainingChoice,
  TrainingQuizAttempt,
  InsertTrainingQuizAttempt,
  TrainingCertificate,
  InsertTrainingCertificate,
} from '@shared/schema';
import type { TrainingLesson, TrainingLessonAsset, TrainingCourse } from '@shared/schema';

export interface CreateCourseInput {
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  visibility: 'global' | 'org';
  // Only meaningful when visibility === 'org'. All authors are platform_admin
  // in v1, so orgId is the only signal for which tenant an org-scoped course
  // belongs to.
  orgId?: string | null;
  passingScore?: number;
  requireContentBeforeQuiz?: boolean;
}

export type UpdateCourseInput = Partial<CreateCourseInput>;

export type CourseListItem = import('@shared/schema').TrainingCourse;

// === Lessons & assets (Phase 2) ===

export interface CreateLessonInput {
  title: string;
  description?: string | null;
  type: 'video' | 'graphics';
  position?: number;
  isRequired?: boolean;
  videoUrl?: string | null;
  videoDurationSec?: number | null;
}

export type UpdateLessonInput = Partial<CreateLessonInput>;

export interface LessonReorderEntry {
  id: string;
  position: number;
}

export interface CreateAssetInput {
  assetUrl: string;
  caption?: string | null;
  position?: number;
}

/** A lesson with its ordered graphics assets attached (empty array for video lessons). */
export interface LessonWithAssets extends TrainingLesson {
  assets: TrainingLessonAsset[];
}

/** Single cohesive course-read shape: course + its ordered lessons (+ each lesson's assets). */
export interface CourseWithContent extends TrainingCourse {
  lessons: LessonWithAssets[];
}

// === Uploads (Phase 2) ===

export interface PresignUploadInput {
  fileName: string;
  contentType: string;
  kind: 'video';
}

export interface PresignUploadResult {
  uploadUrl: string;
  key: string;
  playbackUrl: string;
}

// === Enrollment & progress (Phase 2) ===

export interface LessonProgressInput {
  progressPct?: number;
  completed?: boolean;
}

export interface LessonProgressStatus {
  lessonId: string;
  completed: boolean;
  progressPct: number;
}

export interface QuizCertificateView {
  certificate_no: string | null;
  issued_at: Date;
}

export interface MyCourseStatus {
  enrolled: boolean;
  lessonProgress: LessonProgressStatus[];
  contentComplete: boolean;
  hasQuiz: boolean;
  quizPassed: boolean;
  bestScorePct: number | null;
  attemptCount: number;
  courseCompleted: boolean;
  certificate: QuizCertificateView | null;
}

// === Quiz (Phase 3) ===

export type QuestionType = 'single' | 'multiple';

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

export interface UpsertQuizInput {
  title?: string | null;
  shuffleQuestions?: boolean;
  questions: QuizQuestionInput[];
}

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

export interface SubmitQuizAnswer {
  questionId: string;
  choiceIds: string[];
}

export interface SubmitQuizInput {
  answers: SubmitQuizAnswer[];
}

export interface QuizAttemptQuestionResult {
  questionId: string;
  correct: boolean;
  correctChoiceIds: string[];
  selectedChoiceIds: string[];
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
