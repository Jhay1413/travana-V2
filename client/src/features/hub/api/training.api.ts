import axios from "@/api/client/axios-client";
import rawAxios from "axios";
import { API_V2 } from "@/api/endpoints";
import type {
  TrainingCourse,
  CourseWithContent,
  TrainingEnrollment,
  TrainingLessonProgress,
  MyCourseStatus,
  UpdateLessonProgressInput,
  TrainingLesson,
  TrainingLessonAsset,
  CreateCourseInput,
  UpdateCourseInput,
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
   * (course + ordered lessons, each with its ordered graphics assets). */
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

  // === Admin (authoring, platform_admin only) ===

  /** Full replace-upsert of a course's quiz. */
  async upsertQuiz(courseId: string, input: UpsertQuizInput): Promise<QuizView> {
    const { data } = await axios.put<QuizView>(`${BASE}/${courseId}/quiz`, input);
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

  /** Presign a direct-to-S3 PUT for a video lesson (Option A, single PUT — see plan §5). */
  async presignVideo(input: PresignVideoInput): Promise<PresignVideoResult> {
    const { data } = await axios.post<PresignVideoResult>(`${UPLOADS_BASE}/presign`, {
      ...input,
      kind: "video" as const,
    });
    return data;
  },

  async createLesson(courseId: string, body: CreateLessonInput): Promise<TrainingLesson> {
    const { data } = await axios.post<TrainingLesson>(`${BASE}/${courseId}/lessons`, body);
    return data;
  },

  async updateLesson(id: string, body: UpdateLessonInput): Promise<TrainingLesson> {
    const { data } = await axios.patch<TrainingLesson>(`${LESSONS_BASE}/${id}`, body);
    return data;
  },

  async deleteLesson(id: string): Promise<void> {
    await axios.delete(`${LESSONS_BASE}/${id}`);
  },

  async reorderLessons(courseId: string, order: { id: string; position: number }[]): Promise<TrainingLesson[]> {
    const { data } = await axios.patch<TrainingLesson[]>(`${BASE}/${courseId}/lessons/reorder`, { order });
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
