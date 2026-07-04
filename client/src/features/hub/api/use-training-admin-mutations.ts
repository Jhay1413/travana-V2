import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { trainingApi } from "./training.api";
import { trainingKeys } from "./use-training-queries";
import type {
  TrainingCourse,
  TrainingLessonAsset,
  CreateCourseInput,
  UpdateCourseInput,
  CreateLessonInput,
  UpdateLessonInput,
  UpsertQuizInput,
} from "../types/training.types";

/** Admin course list: every course in scope, any status (platform_admin only). */
export function useAdminCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: trainingKeys.adminList(),
    queryFn: trainingApi.adminListCourses,
  });
}

export function useCreateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateCourseInput) => trainingApi.createCourse(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.adminList() });
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateCourseInput) => trainingApi.updateCourse(id, body),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.adminList() });
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(id) });
    },
  });
}

export function usePublishCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.publishCourse(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.adminList() });
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(id) });
      // Publishing changes what learners see in the published-only list.
      queryClient.invalidateQueries({ queryKey: trainingKeys.list() });
    },
  });
}

export function useArchiveCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.archiveCourse(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.adminList() });
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(id) });
      // Archiving removes the course from the learner's published list too.
      queryClient.invalidateQueries({ queryKey: trainingKeys.list() });
    },
  });
}

/** Permanently delete a course (platform_admin). Irreversible — cascades to all its content, enrollments and certificates. */
export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => trainingApi.deleteCourse(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.adminList() });
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(id) });
      // A deleted course must also disappear from the learner's published list
      // and their enrollments.
      queryClient.invalidateQueries({ queryKey: trainingKeys.list() });
      queryClient.invalidateQueries({ queryKey: trainingKeys.myEnrollments() });
    },
  });
}

export function useCreateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, ...body }: { courseId: string } & CreateLessonInput) =>
      trainingApi.createLesson(courseId, body),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; courseId: string } & UpdateLessonInput) =>
      trainingApi.updateLesson(id, body),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) => trainingApi.deleteLesson(id),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useReorderLessons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, order }: { courseId: string; order: { id: string; position: number }[] }) =>
      trainingApi.reorderLessons(courseId, order),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useAddAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      lessonId,
      assets,
    }: {
      lessonId: string;
      courseId: string;
      assets: { assetUrl: string; caption?: string | null; position?: number }[];
    }) => trainingApi.addAssets(lessonId, assets),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useUploadAssets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, files }: { lessonId: string; courseId: string; files: File[] }) =>
      trainingApi.uploadAssets(lessonId, files),
    onSuccess: (_data: TrainingLessonAsset[], { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; courseId: string }) => trainingApi.deleteAsset(id),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}

/** Full replace-upsert of a course's quiz (authoring, `platform_admin` only). */
export function useUpsertQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, ...input }: { courseId: string } & UpsertQuizInput) =>
      trainingApi.upsertQuiz(courseId, input),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.quiz(courseId) });
    },
  });
}
