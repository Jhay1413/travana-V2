import axios from "@/api/client/axios-client";
import rawAxios from "axios";
import { API_V2 } from "@/api/endpoints";
import type {
  TrainingCourse,
  CourseWithContent,
  TrainingEnrollment,
  TrainingLessonProgress,
  MyCourseStatus,
  MyEnrollment,
  UpdateLessonProgressInput,
  TrainingSection,
  TrainingLesson,
  TrainingLessonAsset,
  CreateCourseInput,
  UpdateCourseInput,
  CreateSectionInput,
  UpdateSectionInput,
  CreateLessonInput,
  UpdateLessonInput,
  PresignVideoInput,
  PresignVideoResult,
  QuizView,
  UpsertQuizInput,
  QuizAttemptAnswer,
  QuizAttemptResult,
} from "../types/training.types";

// NOTE: the shared response interceptor (see api/client/interceptors.ts)
// already unwraps `{ success, message, data }` envelopes to just `data`,
// so `response.data` below IS the course / course[] payload.

const BASE = `${API_V2}/training/courses`;
const SECTIONS_BASE = `${API_V2}/training/sections`;
const LESSONS_BASE = `${API_V2}/training/lessons`;
const ASSETS_BASE = `${API_V2}/training/assets`;
const UPLOADS_BASE = `${API_V2}/training/uploads`;

export const trainingApi = {
  async listPublishedCourses(): Promise<TrainingCourse[]> {
    const { data } = await axios.get<TrainingCourse[]>(BASE);
    return data ?? [];
  },

  async getCourse(id: string): Promise<TrainingCourse> {
    const { data } = await axios.get<TrainingCourse>(`${BASE}/${id}`);
    return data;
  },

  /** Same endpoint as `getCourse`, but retyped for the learner content view
   * (course + ordered sections, each with its ordered lessons + assets). */
  async getCourseWithContent(id: string): Promise<CourseWithContent> {
    const { data } = await axios.get<CourseWithContent>(`${BASE}/${id}`);
    return data;
  },

  /** Idempotent: 201 on first enroll, 200 if already enrolled. */
  async enroll(courseId: string): Promise<TrainingEnrollment> {
    const { data } = await axios.post<TrainingEnrollment>(`${BASE}/${courseId}/enroll`);
    return data;
  },

  async getMyStatus(courseId: string): Promise<MyCourseStatus> {
    const { data } = await axios.get<MyCourseStatus>(`${BASE}/${courseId}/my-status`);
    return data;
  },

  /** The current user's enrollments (course id + status) for the "My Courses" filter. */
  async listMyEnrollments(): Promise<MyEnrollment[]> {
    const { data } = await axios.get<MyEnrollment[]>(`${API_V2}/training/my-courses`);
    return data ?? [];
  },

  async updateLessonProgress(
    lessonId: string,
    input: UpdateLessonProgressInput,
  ): Promise<TrainingLessonProgress> {
    const { data } = await axios.patch<TrainingLessonProgress>(`${LESSONS_BASE}/${lessonId}/progress`, input);
    return data;
  },

  /** Role-aware: `platform_admin` gets `isCorrect` on choices, learners never do. */
  async getQuiz(courseId: string): Promise<QuizView> {
    const { data } = await axios.get<QuizView>(`${BASE}/${courseId}/quiz`);
    return data;
  },

  /** Learner: submit answers, graded server-side. Unlimited retakes. */
  async submitQuizAttempt(courseId: string, answers: QuizAttemptAnswer[]): Promise<QuizAttemptResult> {
    const { data } = await axios.post<QuizAttemptResult>(`${BASE}/${courseId}/quiz/attempts`, { answers });
    return data;
  },

  /** A LESSON's quiz — same role-aware shape as `getQuiz`, keyed by lesson id. */
  async getLessonQuiz(lessonId: string): Promise<QuizView> {
    const { data } = await axios.get<QuizView>(`${LESSONS_BASE}/${lessonId}/quiz`);
    return data;
  },

  /** Learner: submit a lesson-quiz attempt; passing marks the lesson complete. */
  async submitLessonQuizAttempt(lessonId: string, answers: QuizAttemptAnswer[]): Promise<QuizAttemptResult> {
    const { data } = await axios.post<QuizAttemptResult>(`${LESSONS_BASE}/${lessonId}/quiz/attempts`, { answers });
    return data;
  },

  /** A SECTION's quiz — same role-aware shape as `getQuiz`, keyed by section id. */
  async getSectionQuiz(sectionId: string): Promise<QuizView> {
    const { data } = await axios.get<QuizView>(`${SECTIONS_BASE}/${sectionId}/quiz`);
    return data;
  },

  /** Learner: submit a section-quiz attempt; passing a required one counts toward content completion. */
  async submitSectionQuizAttempt(sectionId: string, answers: QuizAttemptAnswer[]): Promise<QuizAttemptResult> {
    const { data } = await axios.post<QuizAttemptResult>(`${SECTIONS_BASE}/${sectionId}/quiz/attempts`, { answers });
    return data;
  },

  // === Admin (authoring, platform_admin only) ===

  /** Full replace-upsert of a course's quiz. */
  async upsertQuiz(courseId: string, input: UpsertQuizInput): Promise<QuizView> {
    const { data } = await axios.put<QuizView>(`${BASE}/${courseId}/quiz`, input);
    return data;
  },

  /** Full replace-upsert of a LESSON's quiz. */
  async upsertLessonQuiz(lessonId: string, input: UpsertQuizInput): Promise<QuizView> {
    const { data } = await axios.put<QuizView>(`${LESSONS_BASE}/${lessonId}/quiz`, input);
    return data;
  },

  /** Full replace-upsert of a SECTION's quiz. */
  async upsertSectionQuiz(sectionId: string, input: UpsertQuizInput): Promise<QuizView> {
    const { data } = await axios.put<QuizView>(`${SECTIONS_BASE}/${sectionId}/quiz`, input);
    return data;
  },

  /** Every course in scope, any status (draft/published/archived). */
  async adminListCourses(): Promise<TrainingCourse[]> {
    const { data } = await axios.get<TrainingCourse[]>(`${BASE}/admin`);
    return data ?? [];
  },

  async createCourse(body: CreateCourseInput): Promise<TrainingCourse> {
    const { data } = await axios.post<TrainingCourse>(BASE, body);
    return data;
  },

  async updateCourse(id: string, body: UpdateCourseInput): Promise<TrainingCourse> {
    const { data } = await axios.patch<TrainingCourse>(`${BASE}/${id}`, body);
    return data;
  },

  async publishCourse(id: string): Promise<TrainingCourse> {
    const { data } = await axios.post<TrainingCourse>(`${BASE}/${id}/publish`);
    return data;
  },

  async archiveCourse(id: string): Promise<TrainingCourse> {
    const { data } = await axios.post<TrainingCourse>(`${BASE}/${id}/archive`);
    return data;
  },

  /** Permanently delete a course (platform_admin). Cascades to lessons, quiz, enrollments, certificates. */
  async deleteCourse(id: string): Promise<void> {
    await axios.delete(`${BASE}/${id}`);
  },

  /** Presign a direct-to-S3 PUT for a video lesson (Option A, single PUT — see plan §5). */
  async presignVideo(input: PresignVideoInput): Promise<PresignVideoResult> {
    const { data } = await axios.post<PresignVideoResult>(`${UPLOADS_BASE}/presign`, {
      ...input,
      kind: "video" as const,
    });
    return data;
  },

  /** Presign a direct-to-S3 PUT for a course thumbnail image (same flow as video). */
  async presignImage(input: PresignVideoInput): Promise<PresignVideoResult> {
    const { data } = await axios.post<PresignVideoResult>(`${UPLOADS_BASE}/presign`, {
      ...input,
      kind: "image" as const,
    });
    return data;
  },

  // Sections (course → sections → lessons)

  async createSection(courseId: string, body: CreateSectionInput): Promise<TrainingSection> {
    const { data } = await axios.post<TrainingSection>(`${BASE}/${courseId}/sections`, body);
    return data;
  },

  async updateSection(id: string, body: UpdateSectionInput): Promise<TrainingSection> {
    const { data } = await axios.patch<TrainingSection>(`${SECTIONS_BASE}/${id}`, body);
    return data;
  },

  /** Deleting a section cascades to its lessons, their assets/progress and the section's quiz. */
  async deleteSection(id: string): Promise<void> {
    await axios.delete(`${SECTIONS_BASE}/${id}`);
  },

  async reorderSections(courseId: string, order: { id: string; position: number }[]): Promise<TrainingSection[]> {
    const { data } = await axios.patch<TrainingSection[]>(`${BASE}/${courseId}/sections/reorder`, { order });
    return data;
  },

  /** Lessons are created within a SECTION. */
  async createLesson(sectionId: string, body: CreateLessonInput): Promise<TrainingLesson> {
    const { data } = await axios.post<TrainingLesson>(`${SECTIONS_BASE}/${sectionId}/lessons`, body);
    return data;
  },

  async updateLesson(id: string, body: UpdateLessonInput): Promise<TrainingLesson> {
    const { data } = await axios.patch<TrainingLesson>(`${LESSONS_BASE}/${id}`, body);
    return data;
  },

  async deleteLesson(id: string): Promise<void> {
    await axios.delete(`${LESSONS_BASE}/${id}`);
  },

  /** Reorder lessons WITHIN a section. */
  async reorderLessons(sectionId: string, order: { id: string; position: number }[]): Promise<TrainingLesson[]> {
    const { data } = await axios.patch<TrainingLesson[]>(`${SECTIONS_BASE}/${sectionId}/lessons/reorder`, { order });
    return data;
  },

  async addAssets(
    lessonId: string,
    assets: { assetUrl: string; caption?: string | null; position?: number }[],
  ): Promise<TrainingLessonAsset[]> {
    const { data } = await axios.post<TrainingLessonAsset[]>(`${LESSONS_BASE}/${lessonId}/assets`, { assets });
    return data;
  },

  /** Graphics/slide images for a lesson — multipart, field name `files` (≤20, 5MB each). */
  async uploadAssets(lessonId: string, files: File[]): Promise<TrainingLessonAsset[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const { data } = await axios.post<TrainingLessonAsset[]>(`${LESSONS_BASE}/${lessonId}/assets/upload`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  async deleteAsset(id: string): Promise<void> {
    await axios.delete(`${ASSETS_BASE}/${id}`);
  },
};

/**
 * Direct-to-S3 video upload (Option A — single presigned PUT, not resumable;
 * see docs/training-lms-plan.md §5). Uses a BARE axios instance (not the
 * app's `axios-client`) for the PUT itself: the request goes straight to S3,
 * which doesn't need — and would reject via CORS if sent — the app's session
 * cookies. `onProgress` is driven by real bytes-sent-to-S3, reaching 100%
 * exactly when the object is fully written.
 */
export async function uploadVideoToS3(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ playbackUrl: string; key: string }> {
  const { uploadUrl, key, playbackUrl } = await trainingApi.presignVideo({
    fileName: file.name,
    contentType: file.type,
  });

  await rawAxios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { playbackUrl, key };
}

/**
 * Direct-to-S3 course thumbnail image upload — same single presigned PUT flow
 * as {@link uploadVideoToS3}, using a bare axios instance so no app session
 * cookies are sent to S3. Returns the stored proxy URL to save as `thumbnailUrl`.
 */
export async function uploadImageToS3(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ playbackUrl: string; key: string }> {
  const { uploadUrl, key, playbackUrl } = await trainingApi.presignImage({
    fileName: file.name,
    contentType: file.type,
  });

  await rawAxios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type },
    onUploadProgress: (e) => {
      if (e.total) onProgress(Math.round((e.loaded / e.total) * 100));
    },
  });

  return { playbackUrl, key };
}
