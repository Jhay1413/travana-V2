import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, HelpCircle, ImageIcon, Loader2, Lock, PlayCircle } from "lucide-react";
import { HubBadge, HubEmptyState, HubProgressBar } from "@/features/hub/components/hub-components";
import { useCourseContent, useMyCourseStatus } from "@/features/hub/api/use-training-queries";
import { useEnroll, useUpdateLessonProgress } from "@/features/hub/api/use-training-mutations";
import { TrainingVideoPlayer } from "./training-video-player";
import { TrainingGraphicsViewer } from "./training-graphics-viewer";
import { TrainingQuiz, TrainingLessonQuiz, TrainingSectionQuiz, TrainingQuizRunnerDialog } from "./training-quiz";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { LessonProgress, LessonWithAssets, SectionProgress } from "../types/training.types";

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

  // Finished-lesson quiz prompt: shown once per lesson when its content is
  // done and the lesson has an unpassed quiz. "Take the quiz" hands off to
  // the runner dialog.
  const [quizPromptLesson, setQuizPromptLesson] = useState<LessonWithAssets | null>(null);
  const [quizRunnerLesson, setQuizRunnerLesson] = useState<LessonWithAssets | null>(null);
  const promptedLessonIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (status && !status.enrolled && !hasRequestedEnrollRef.current) {
      hasRequestedEnrollRef.current = true;
      enroll.mutate(courseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, courseId]);

  const sections = useMemo(() => course?.sections ?? [], [course]);
  // Flat lesson list in course order (sections by position, lessons within).
  const lessons = useMemo(() => sections.flatMap((s) => s.lessons), [sections]);

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

  const sectionProgressById = useMemo(() => {
    const map = new Map<string, SectionProgress>();
    for (const p of status?.sectionProgress ?? []) map.set(p.sectionId, p);
    return map;
  }, [status]);

  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

  // Sequential progression, mirroring the server rules (`assertLessonUnlocked`
  // / `assertSectionQuizUnlocked`): walking sections in order (each section's
  // quiz sits after its lessons), everything after an incomplete REQUIRED
  // lesson or an unpassed REQUIRED section quiz is locked — optional lessons
  // and optional quizzes never block.
  const { lockedLessonIds, lockedSectionQuizIds } = useMemo(() => {
    const lockedLessons = new Set<string>();
    const lockedQuizzes = new Set<string>();
    let blocked = false;
    for (const section of sections) {
      for (const lesson of section.lessons) {
        if (blocked) lockedLessons.add(lesson.id);
        if (lesson.is_required && !progressByLessonId.get(lesson.id)?.completed) blocked = true;
      }
      if (section.has_quiz) {
        if (blocked) lockedQuizzes.add(section.id);
        if (section.quiz_required && !sectionProgressById.get(section.id)?.quizPassed) blocked = true;
      }
    }
    return { lockedLessonIds: lockedLessons, lockedSectionQuizIds: lockedQuizzes };
  }, [sections, progressByLessonId, sectionProgressById]);

  const requiredLessons = lessons.filter((lesson) => lesson.is_required);
  const requiredCompletedCount = requiredLessons.filter(
    (lesson) => progressByLessonId.get(lesson.id)?.completed,
  ).length;

  // When a lesson's content finishes and the lesson has a quiz the learner
  // hasn't passed, surface the prompt (once per lesson per visit).
  const maybePromptLessonQuiz = (lessonId: string) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    if (!lesson?.has_quiz) return;
    if (progressByLessonId.get(lessonId)?.quizPassed) return;
    if (promptedLessonIdsRef.current.has(lessonId)) return;
    promptedLessonIdsRef.current.add(lessonId);
    setQuizPromptLesson(lesson);
  };

  const markLessonComplete = (lessonId: string) => {
    updateProgress.mutate({ lessonId, courseId, completed: true });
    maybePromptLessonQuiz(lessonId);
  };

  const handleVideoProgressPct = (lessonId: string) => (pct: number) => {
    updateProgress.mutate({
      lessonId,
      courseId,
      progressPct: pct,
      ...(pct >= COMPLETE_THRESHOLD_PCT ? { completed: true } : {}),
    });
    if (pct >= COMPLETE_THRESHOLD_PCT) maybePromptLessonQuiz(lessonId);
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
                initialProgressPct={progressByLessonId.get(selectedLesson.id)?.progressPct ?? 0}
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

            {selectedLesson.has_quiz && (
              <TrainingLessonQuiz key={`quiz-${selectedLesson.id}`} courseId={courseId} lesson={selectedLesson} />
            )}
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
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Course content</h3>
          <div className="mt-3 space-y-4">
            {sections.map((section, sIndex) => (
              <div key={section.id} data-testid={`sidebar-section-${section.id}`}>
                <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Section {sIndex + 1}: {section.title}
                </p>
                <div className="mt-1 space-y-1">
                  {section.lessons.map((lesson) => {
                    const progress = progressByLessonId.get(lesson.id);
                    const isSelected = lesson.id === selectedLessonId;
                    const isLocked = lockedLessonIds.has(lesson.id);
                    const LessonIcon = lesson.type === "video" ? PlayCircle : ImageIcon;
                    return (
                      <button
                        key={lesson.id}
                        type="button"
                        onClick={() => setSelectedLessonId(lesson.id)}
                        disabled={isLocked}
                        title={isLocked ? "Complete the previous lessons to unlock" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isSelected
                            ? "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400"
                            : isLocked
                              ? "cursor-not-allowed text-slate-400 opacity-60 dark:text-slate-600"
                              : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
                        )}
                        data-testid={`button-lesson-${lesson.id}`}
                      >
                        {progress?.completed ? (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                        ) : isLocked ? (
                          <Lock className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                        ) : (
                          <Circle className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
                        )}
                        <LessonIcon className="h-4 w-4 shrink-0" />
                        <span className="line-clamp-1 flex-1">{lesson.title}</span>
                        {lesson.has_quiz && (
                          <HelpCircle
                            className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500"
                            aria-label="Has quiz"
                          />
                        )}
                      </button>
                    );
                  })}
                  {section.has_quiz && (
                    <TrainingSectionQuiz
                      courseId={courseId}
                      section={section}
                      locked={lockedSectionQuizIds.has(section.id)}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Dialog open={quizPromptLesson !== null} onOpenChange={(open) => !open && setQuizPromptLesson(null)}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-lesson-quiz-prompt">
          <DialogHeader>
            <DialogTitle>Lesson complete — quiz time!</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {quizPromptLesson?.quiz_required
              ? `Great work finishing "${quizPromptLesson?.title}"! This lesson has a quiz — pass it to unlock the next lesson.`
              : `Great work finishing "${quizPromptLesson?.title}"! This lesson has a short quiz if you'd like to check what you've learned.`}
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuizPromptLesson(null)}
              data-testid="button-quiz-prompt-later"
            >
              Not now
            </Button>
            <Button
              type="button"
              onClick={() => {
                setQuizRunnerLesson(quizPromptLesson);
                setQuizPromptLesson(null);
              }}
              data-testid="button-quiz-prompt-take"
            >
              Take the quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {quizRunnerLesson && (
        <TrainingQuizRunnerDialog
          courseId={courseId}
          lessonId={quizRunnerLesson.id}
          open
          onOpenChange={(open) => !open && setQuizRunnerLesson(null)}
        />
      )}
    </div>
  );
}
