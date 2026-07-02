import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, ImageIcon, Loader2, PlayCircle } from "lucide-react";
import { HubBadge, HubEmptyState, HubProgressBar } from "@/features/hub/components/hub-components";
import { useCourseContent, useMyCourseStatus } from "@/features/hub/api/use-training-queries";
import { useEnroll, useUpdateLessonProgress } from "@/features/hub/api/use-training-mutations";
import { TrainingVideoPlayer } from "./training-video-player";
import { TrainingGraphicsViewer } from "./training-graphics-viewer";
import { TrainingQuiz } from "./training-quiz";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LessonProgress } from "../types/training.types";

interface TrainingCourseViewProps {
  courseId: string;
}

/** Video lessons are marked complete once the learner has watched this much. */
const COMPLETE_THRESHOLD_PCT = 90;

/**
 * Learner content view for a single course: side lesson nav (with per-lesson
 * completion) + a main area that renders the selected lesson's video or
 * graphics content. Auto-enrolls (idempotent) on first open.
 */
export function TrainingCourseView({ courseId }: TrainingCourseViewProps) {
  const { data: course, isLoading: isCourseLoading, isError: isCourseError } = useCourseContent(courseId);
  const { data: status, isLoading: isStatusLoading } = useMyCourseStatus(courseId);
  const enroll = useEnroll();
  const updateProgress = useUpdateLessonProgress();

  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const hasRequestedEnrollRef = useRef(false);

  useEffect(() => {
    if (status && !status.enrolled && !hasRequestedEnrollRef.current) {
      hasRequestedEnrollRef.current = true;
      enroll.mutate(courseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, courseId]);

  const lessons = useMemo(() => course?.lessons ?? [], [course]);

  useEffect(() => {
    if (!selectedLessonId && lessons.length > 0) {
      setSelectedLessonId(lessons[0].id);
    }
  }, [lessons, selectedLessonId]);

  const progressByLessonId = useMemo(() => {
    const map = new Map<string, LessonProgress>();
    for (const p of status?.lessonProgress ?? []) map.set(p.lessonId, p);
    return map;
  }, [status]);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  const requiredLessons = lessons.filter((lesson) => lesson.is_required);
  const requiredCompletedCount = requiredLessons.filter(
    (lesson) => progressByLessonId.get(lesson.id)?.completed,
  ).length;

  const markLessonComplete = (lessonId: string) => {
    updateProgress.mutate({ lessonId, courseId, completed: true });
  };

  const handleVideoProgressPct = (lessonId: string) => (pct: number) => {
    updateProgress.mutate({
      lessonId,
      courseId,
      progressPct: pct,
      ...(pct >= COMPLETE_THRESHOLD_PCT ? { completed: true } : {}),
    });
  };

  if (isCourseLoading || isStatusLoading || !course) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-16 dark:border-slate-800 dark:bg-slate-900"
        data-testid="training-detail-loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isCourseError) {
    return <HubEmptyState title="Couldn't load this course" description="Please refresh the page to try again." />;
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3" data-testid="training-course-view">
      <div className="space-y-6 lg:col-span-2">
        {selectedLesson ? (
          <>
            {selectedLesson.type === "video" && selectedLesson.video_url ? (
              <TrainingVideoPlayer
                key={selectedLesson.id}
                url={selectedLesson.video_url}
                onProgressPct={handleVideoProgressPct(selectedLesson.id)}
                onEnded={() => markLessonComplete(selectedLesson.id)}
              />
            ) : selectedLesson.type === "graphics" ? (
              <TrainingGraphicsViewer
                key={selectedLesson.id}
                assets={selectedLesson.assets}
                onCompleted={() => markLessonComplete(selectedLesson.id)}
              />
            ) : (
              <div className="aspect-video rounded-xl bg-slate-900" data-testid="training-lesson-no-content" />
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">{selectedLesson.title}</h1>
                {progressByLessonId.get(selectedLesson.id)?.completed && <HubBadge variant="green">Completed</HubBadge>}
                {!selectedLesson.is_required && <HubBadge>Optional</HubBadge>}
              </div>
              {selectedLesson.description && (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{selectedLesson.description}</p>
              )}
            </div>
          </>
        ) : (
          <HubEmptyState title="No lessons yet" description="Check back soon for course content." />
        )}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Course Progress</h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400" data-testid="text-training-progress-count">
              {requiredCompletedCount}/{requiredLessons.length} required
            </span>
          </div>
          <div className="mt-3">
            <HubProgressBar
              value={requiredLessons.length > 0 ? (requiredCompletedCount / requiredLessons.length) * 100 : 0}
              size="sm"
            />
          </div>

          <TrainingQuiz courseId={courseId} requireContentBeforeQuiz={course.require_content_before_quiz} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lessons</h3>
          <div className="mt-3 space-y-1">
            {lessons.map((lesson) => {
              const progress = progressByLessonId.get(lesson.id);
              const isSelected = lesson.id === selectedLessonId;
              const LessonIcon = lesson.type === "video" ? PlayCircle : ImageIcon;
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => setSelectedLessonId(lesson.id)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    isSelected
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                      : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
                  )}
                  data-testid={`button-lesson-${lesson.id}`}
                >
                  {progress?.completed ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                  )}
                  <LessonIcon className="h-4 w-4 shrink-0" />
                  <span className="line-clamp-1 flex-1">{lesson.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
