import { useMutation, useQueryClient } from "@tanstack/react-query";
import { trainingApi } from "./training.api";
import { trainingKeys } from "./use-training-queries";
import type {
  CourseWithContent,
  LessonProgress,
  MyCourseStatus,
  UpdateLessonProgressInput,
  QuizAttemptAnswer,
} from "../types/training.types";

/** Idempotent enroll (201 new / 200 existing) — safe to call on every course open. */
export function useEnroll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => trainingApi.enroll(courseId),
    onSuccess: (_data, courseId) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.myStatus(courseId) });
    },
  });
}

type ProgressVars = { lessonId: string; courseId: string } & UpdateLessonProgressInput;

/**
 * Recompute `contentComplete` the same way the server does: every REQUIRED
 * lesson must be completed. We read the required-lesson set from the cached
 * course content (`trainingKeys.detail`); if it isn't cached yet we keep the
 * previous value and let the `onSettled` refetch reconcile.
 */
function recomputeContentComplete(
  queryClient: ReturnType<typeof useQueryClient>,
  courseId: string,
  lessonProgress: LessonProgress[],
  fallback: boolean,
): boolean {
  const content = queryClient.getQueryData<CourseWithContent>(trainingKeys.detail(courseId));
  if (!content) return fallback;
  const required = content.lessons.filter((l) => l.is_required);
  if (required.length === 0) return false;
  const completedIds = new Set(lessonProgress.filter((p) => p.completed).map((p) => p.lessonId));
  return required.every((l) => completedIds.has(l.id));
}

export function useUpdateLessonProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lessonId, courseId, ...input }: ProgressVars) =>
      trainingApi.updateLessonProgress(lessonId, input),

    // Optimistic: patch the myStatus cache immediately so checkmarks + the
    // progress bar move without waiting for the server round-trip.
    onMutate: async ({ lessonId, courseId, progressPct, completed }: ProgressVars) => {
      const key = trainingKeys.myStatus(courseId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MyCourseStatus>(key);
      if (!previous) return { previous, key };

      // Mirror the server rule (training-progress.service.ts): `completed`
      // is only touched when completed/progressPct is provided, and becomes
      // true when explicitly completed OR progressPct >= 90.
      const touchesCompleted = completed !== undefined || progressPct !== undefined;
      const nextCompleted = completed === true || (progressPct !== undefined && progressPct >= 90);

      const patchEntry = (p: LessonProgress): LessonProgress => ({
        ...p,
        progressPct: progressPct ?? p.progressPct,
        completed: touchesCompleted ? nextCompleted : p.completed,
      });

      const exists = previous.lessonProgress.some((p) => p.lessonId === lessonId);
      const lessonProgress = exists
        ? previous.lessonProgress.map((p) => (p.lessonId === lessonId ? patchEntry(p) : p))
        : [
            ...previous.lessonProgress,
            patchEntry({ lessonId, completed: false, progressPct: 0 }),
          ];

      queryClient.setQueryData<MyCourseStatus>(key, {
        ...previous,
        enrolled: true, // progress implies enrollment (server auto-enrolls)
        lessonProgress,
        contentComplete: recomputeContentComplete(queryClient, courseId, lessonProgress, previous.contentComplete),
      });

      return { previous, key };
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous);
    },

    // Reconcile with server truth (also picks up enrollment/completion side effects).
    onSettled: (_data, _err, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.myStatus(courseId) });
    },
  });
}

/**
 * Submit + server-side-grade a quiz attempt (unlimited retakes). Refreshes
 * `myStatus` (best score/attempt count/completion/certificate) and the
 * course content cache on success; the caller reads the returned
 * `QuizAttemptResult` directly to render the result screen.
 */
export function useSubmitQuizAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, answers }: { courseId: string; answers: QuizAttemptAnswer[] }) =>
      trainingApi.submitQuizAttempt(courseId, answers),
    onSuccess: (_data, { courseId }) => {
      queryClient.invalidateQueries({ queryKey: trainingKeys.myStatus(courseId) });
      queryClient.invalidateQueries({ queryKey: trainingKeys.detail(courseId) });
    },
  });
}
