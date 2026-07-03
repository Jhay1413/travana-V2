import { useQuery } from "@tanstack/react-query";
import { trainingApi } from "./training.api";
import type { TrainingCourse, CourseWithContent, MyCourseStatus, MyEnrollment, QuizView } from "../types/training.types";

export const trainingKeys = {
  all: ["training-courses"] as const,
  lists: () => [...trainingKeys.all, "list"] as const,
  list: () => [...trainingKeys.lists()] as const,
  details: () => [...trainingKeys.all, "detail"] as const,
  detail: (id: string) => [...trainingKeys.details(), id] as const,
  myStatuses: () => [...trainingKeys.all, "my-status"] as const,
  myStatus: (courseId: string) => [...trainingKeys.myStatuses(), courseId] as const,
  myEnrollments: () => [...trainingKeys.all, "my-enrollments"] as const,
  // Admin (authoring) list — every status, separate cache slot from the
  // learner `list()` (published-only) so publish/archive can invalidate
  // both independently.
  adminLists: () => [...trainingKeys.all, "admin-list"] as const,
  adminList: () => [...trainingKeys.adminLists()] as const,
  quizzes: () => [...trainingKeys.all, "quiz"] as const,
  quiz: (courseId: string) => [...trainingKeys.quizzes(), courseId] as const,
};

export function useTrainingCourses() {
  return useQuery<TrainingCourse[]>({
    queryKey: trainingKeys.list(),
    queryFn: trainingApi.listPublishedCourses,
  });
}

export function useTrainingCourse(id: string) {
  return useQuery<TrainingCourse>({
    queryKey: trainingKeys.detail(id),
    queryFn: () => trainingApi.getCourse(id),
    enabled: !!id,
  });
}

/** Full learner content view: course + ordered lessons (+ each lesson's assets). */
export function useCourseContent(id: string) {
  return useQuery<CourseWithContent>({
    queryKey: trainingKeys.detail(id),
    queryFn: () => trainingApi.getCourseWithContent(id),
    enabled: !!id,
  });
}

/** The current user's enrollments (course id + status) — for the "My Courses" filter. */
export function useMyEnrollments() {
  return useQuery<MyEnrollment[]>({
    queryKey: trainingKeys.myEnrollments(),
    queryFn: trainingApi.listMyEnrollments,
  });
}

/** Current user's enrollment + per-lesson progress for a course. */
export function useMyCourseStatus(courseId: string) {
  return useQuery<MyCourseStatus>({
    queryKey: trainingKeys.myStatus(courseId),
    queryFn: () => trainingApi.getMyStatus(courseId),
    enabled: !!courseId,
  });
}

/**
 * A course's quiz + questions. Role-aware: `platform_admin` gets `isCorrect`
 * on every choice (the authoring builder), any other staff (learner) never
 * does — grading/feedback for them comes only from the attempt `results`.
 * `quiz: null` means the course has no quiz yet.
 */
export function useQuiz(courseId: string) {
  return useQuery<QuizView>({
    queryKey: trainingKeys.quiz(courseId),
    queryFn: () => trainingApi.getQuiz(courseId),
    enabled: !!courseId,
  });
}
