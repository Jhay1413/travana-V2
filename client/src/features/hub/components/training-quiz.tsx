import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, CheckCircle2, HelpCircle, Loader2, Lock, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { HubBadge, HubEmptyState } from "@/features/hub/components/hub-components";
import { useMyCourseStatus, useQuiz, useLessonQuiz, useSectionQuiz } from "@/features/hub/api/use-training-queries";
import {
  useSubmitQuizAttempt,
  useSubmitLessonQuizAttempt,
  useSubmitSectionQuizAttempt,
} from "@/features/hub/api/use-training-mutations";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { QuizAttemptResult, LessonWithAssets, SectionWithLessons } from "@/features/hub/types/training.types";

interface TrainingQuizProps {
  courseId: string;
  /** From the course record (`training_course.require_content_before_quiz`). */
  requireContentBeforeQuiz: boolean;
}

/**
 * Learner quiz entry point, rendered in the course sidebar
 * (`TrainingCourseView`). Fully driven by `useMyCourseStatus`:
 * - no quiz on this course → nothing (or a subtle note once content's done)
 * - locked (content required, not finished) → locked state
 * - unlocked, not passed → take/retake button, opens the runner dialog
 * - passed/completed → success panel with best score + certificate
 */
export function TrainingQuiz({ courseId, requireContentBeforeQuiz }: TrainingQuizProps) {
  const { data: status } = useMyCourseStatus(courseId);
  const [open, setOpen] = useState(false);

  if (!status || !status.hasQuiz) {
    if (status?.contentComplete) {
      return (
        <p
          className="mt-4 rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400"
          data-testid="text-training-no-quiz"
        >
          No quiz for this course.
        </p>
      );
    }
    return null;
  }

  const locked = requireContentBeforeQuiz && !status.contentComplete;

  if (locked) {
    return (
      <Button
        disabled
        className="mt-4 w-full cursor-not-allowed bg-slate-100 text-xs text-slate-400 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-800"
        data-testid="button-quiz-locked"
        title="Finish all required lessons to unlock the quiz"
      >
        <Lock className="mr-1.5 h-3.5 w-3.5" /> Finish required lessons to unlock quiz
      </Button>
    );
  }

  const passed = status.quizPassed || status.courseCompleted;

  return (
    <div className="mt-4 space-y-3">
      {passed ? (
        <div
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10"
          data-testid="panel-quiz-passed"
        >
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Quiz passed</span>
            <HubBadge variant="green">Completed</HubBadge>
          </div>
          {status.bestScorePct !== null && (
            <p className="mt-1 text-xs text-emerald-700/80 dark:text-emerald-400/80" data-testid="text-quiz-best-score">
              Best score: {status.bestScorePct}%
            </p>
          )}
          {status.certificate && (
            <div
              className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400"
              data-testid="text-quiz-certificate"
            >
              <Award className="h-3.5 w-3.5 shrink-0" />
              <span>
                Certificate {status.certificate.certificate_no ?? ""}
                {status.certificate.issued_at
                  ? ` · issued ${new Date(status.certificate.issued_at).toLocaleDateString()}`
                  : ""}
              </span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setOpen(true)}
            data-testid="button-retake-quiz"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake quiz
          </Button>
        </div>
      ) : (
        <div>
          {status.attemptCount > 0 && (
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400" data-testid="text-quiz-attempt-summary">
              {status.attemptCount} attempt{status.attemptCount === 1 ? "" : "s"} so far
              {status.bestScorePct !== null ? ` · best score ${status.bestScorePct}%` : ""}
            </p>
          )}
          <Button className="w-full" onClick={() => setOpen(true)} data-testid="button-take-quiz">
            {status.attemptCount > 0 ? "Retake quiz" : "Take quiz"}
          </Button>
        </div>
      )}

      <TrainingQuizRunnerDialog courseId={courseId} open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface TrainingLessonQuizProps {
  courseId: string;
  lesson: LessonWithAssets;
}

/**
 * Per-lesson quiz panel, rendered under the selected lesson's info card in
 * `TrainingCourseView` (only when `lesson.has_quiz`). Reads the lesson's quiz
 * state from `useMyCourseStatus().lessonProgress` and opens the shared runner
 * dialog targeted at the lesson. Passing marks the lesson complete.
 */
export function TrainingLessonQuiz({ courseId, lesson }: TrainingLessonQuizProps) {
  const { data: status } = useMyCourseStatus(courseId);
  const [open, setOpen] = useState(false);

  const lessonStatus = status?.lessonProgress.find((p) => p.lessonId === lesson.id);
  const passed = lessonStatus?.quizPassed ?? false;
  const attemptCount = lessonStatus?.attemptCount ?? 0;
  const bestScorePct = lessonStatus?.bestScorePct ?? null;
  const required = lessonStatus?.quizRequired ?? lesson.quiz_required;

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      data-testid={`panel-lesson-quiz-${lesson.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lesson quiz</h3>
            {required && !passed && <HubBadge variant="amber">Required</HubBadge>}
          </div>
          {passed ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400" data-testid={`text-lesson-quiz-passed-${lesson.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Passed
              {bestScorePct !== null ? ` · best score ${bestScorePct}%` : ""}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {attemptCount > 0
                ? `${attemptCount} attempt${attemptCount === 1 ? "" : "s"} so far${bestScorePct !== null ? ` · best score ${bestScorePct}%` : ""}`
                : required
                  ? "You must pass this quiz to complete the lesson."
                  : "Check your knowledge — passing marks this lesson complete."}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant={passed ? "outline" : "default"}
          onClick={() => setOpen(true)}
          data-testid={`button-take-lesson-quiz-${lesson.id}`}
        >
          {passed ? (
            <>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake quiz
            </>
          ) : attemptCount > 0 ? (
            "Retake quiz"
          ) : (
            "Take quiz"
          )}
        </Button>
      </div>

      <TrainingQuizRunnerDialog courseId={courseId} lessonId={lesson.id} open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface TrainingSectionQuizProps {
  courseId: string;
  section: SectionWithLessons;
  /** The learner hasn't finished the section's lessons (or a prior section) yet. */
  locked: boolean;
}

/**
 * Per-section quiz panel, rendered in the course sidebar under the section's
 * lessons (only when `section.has_quiz`). Reads the section's quiz state from
 * `useMyCourseStatus().sectionProgress` and opens the shared runner dialog
 * targeted at the section. Passing a REQUIRED section quiz counts toward
 * content completion.
 */
export function TrainingSectionQuiz({ courseId, section, locked }: TrainingSectionQuizProps) {
  const { data: status } = useMyCourseStatus(courseId);
  const [open, setOpen] = useState(false);

  const sectionStatus = status?.sectionProgress.find((p) => p.sectionId === section.id);
  const passed = sectionStatus?.quizPassed ?? false;
  const attemptCount = sectionStatus?.attemptCount ?? 0;
  const bestScorePct = sectionStatus?.bestScorePct ?? null;
  const required = sectionStatus?.quizRequired ?? section.quiz_required;

  return (
    <div className="mt-1" data-testid={`panel-section-quiz-${section.id}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={locked && !passed}
        title={locked && !passed ? "Finish this section's lessons to unlock its quiz" : undefined}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
          locked && !passed
            ? "cursor-not-allowed text-slate-400 opacity-60 dark:text-slate-600"
            : "text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800",
        )}
        data-testid={`button-take-section-quiz-${section.id}`}
      >
        {passed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : locked ? (
          <Lock className="h-4 w-4 shrink-0 text-slate-300 dark:text-slate-600" />
        ) : (
          <HelpCircle className="h-4 w-4 shrink-0 text-blue-500" />
        )}
        <span className="line-clamp-1 flex-1">Section quiz</span>
        {required && !passed && <HubBadge variant="amber">Required</HubBadge>}
        {passed && bestScorePct !== null && <HubBadge variant="green">{bestScorePct}%</HubBadge>}
        {!passed && attemptCount > 0 && bestScorePct !== null && <HubBadge>best {bestScorePct}%</HubBadge>}
      </button>

      <TrainingQuizRunnerDialog courseId={courseId} sectionId={section.id} open={open} onOpenChange={setOpen} />
    </div>
  );
}

interface TrainingQuizRunnerDialogProps {
  courseId: string;
  /** When set, the runner takes this LESSON's quiz instead of the course final quiz. */
  lessonId?: string;
  /** When set, the runner takes this SECTION's quiz instead of the course final quiz. */
  sectionId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The quiz-taking modal: loads the learner quiz view (no `isCorrect`),
 * collects one answer set per question (radio for single, checkboxes for
 * multiple), submits for server-side grading, then swaps to a result screen
 * built entirely from the attempt's `results` (never from `isCorrect`).
 * Runs the course final quiz, or — with `lessonId` / `sectionId` — a
 * lesson's or section's quiz. Exported for the finished-lesson quiz prompt
 * in `TrainingCourseView`.
 */
export function TrainingQuizRunnerDialog({ courseId, lessonId, sectionId, open, onOpenChange }: TrainingQuizRunnerDialogProps) {
  // Exactly one of the three queries is enabled (all hooks always run — the
  // disabled ones get an empty id, matching their `enabled: !!id` guard).
  const courseQuizQuery = useQuiz(open && !lessonId && !sectionId ? courseId : "");
  const lessonQuizQuery = useLessonQuiz(open && lessonId ? lessonId : "");
  const sectionQuizQuery = useSectionQuiz(open && sectionId ? sectionId : "");
  const { data: quiz, isLoading } = lessonId ? lessonQuizQuery : sectionId ? sectionQuizQuery : courseQuizQuery;
  const submitCourseAttempt = useSubmitQuizAttempt();
  const submitLessonAttempt = useSubmitLessonQuizAttempt();
  const submitSectionAttempt = useSubmitSectionQuizAttempt();
  const submitting = lessonId
    ? submitLessonAttempt.isPending
    : sectionId
      ? submitSectionAttempt.isPending
      : submitCourseAttempt.isPending;
  const { toast } = useToast();

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    if (open) {
      setAnswers({});
      setResult(null);
      setStepIndex(0);
      setDirection(1);
    }
  }, [open]);

  const questions = quiz?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === totalQuestions - 1;
  const currentAnswered = currentQuestion ? (answers[currentQuestion.id]?.length ?? 0) > 0 : false;
  const progressPct = totalQuestions > 0 ? ((stepIndex + 1) / totalQuestions) * 100 : 0;

  const setSingleAnswer = (questionId: string, choiceId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: [choiceId] }));
  };

  const toggleMultipleAnswer = (questionId: string, choiceId: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      const next = checked ? [...current, choiceId] : current.filter((id) => id !== choiceId);
      return { ...prev, [questionId]: next };
    });
  };

  const goNext = () => {
    if (!currentAnswered) return;
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, totalQuestions - 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const handleSubmit = async () => {
    const answerList = questions.map((q) => ({ questionId: q.id, choiceIds: answers[q.id] ?? [] }));
    try {
      const data = lessonId
        ? await submitLessonAttempt.mutateAsync({ lessonId, courseId, answers: answerList })
        : sectionId
          ? await submitSectionAttempt.mutateAsync({ sectionId, courseId, answers: answerList })
          : await submitCourseAttempt.mutateAsync({ courseId, answers: answerList });
      setResult(data);
    } catch (err) {
      toast({
        title: "Couldn't submit quiz",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRetake = () => {
    setAnswers({});
    setResult(null);
    setStepIndex(0);
    setDirection(1);
  };

  const resultsByQuestion = new Map((result?.results ?? []).map((r) => [r.questionId, r]));

  const stepVariants = {
    enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{result ? "Quiz results" : "Quiz"}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : questions.length === 0 ? (
          <HubEmptyState title="No quiz for this course" description="Check back later." />
        ) : result ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-0.5 py-1">
            <div
              className={cn(
                "rounded-lg border p-4 text-center",
                result.passed
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10"
                  : "border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10",
              )}
              data-testid="panel-quiz-result"
            >
              <div className="flex items-center justify-center gap-2">
                {result.passed ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={cn(
                    "text-lg font-bold",
                    result.passed ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400",
                  )}
                >
                  {result.passed ? "Passed" : "Not passed"}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Score: {result.scorePct}% (passing score {result.passingScore}%)
              </p>
              {result.courseCompleted && result.certificate && (
                <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <Award className="h-4 w-4" />
                  Certificate {result.certificate.certificate_no ?? ""}
                  {result.certificate.issued_at
                    ? ` · issued ${new Date(result.certificate.issued_at).toLocaleDateString()}`
                    : ""}
                </div>
              )}
              {result.lessonCompleted && (
                <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-400" data-testid="text-lesson-quiz-completed">
                  Lesson marked complete.
                </p>
              )}
            </div>

            <div className="space-y-3">
              {questions.map((q, qIndex) => {
                const r = resultsByQuestion.get(q.id);
                return (
                  <div
                    key={q.id}
                    className={cn(
                      "rounded-lg border p-3",
                      r?.correct
                        ? "border-emerald-200 dark:border-emerald-500/20"
                        : "border-red-200 dark:border-red-500/20",
                    )}
                    data-testid={`result-question-${qIndex}`}
                  >
                    <div className="flex items-start gap-2">
                      {r?.correct ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">{q.text}</p>
                        <ul className="mt-2 space-y-1">
                          {q.choices.map((c) => {
                            const wasSelected = r?.selectedChoiceIds.includes(c.id) ?? false;
                            const isCorrectChoice = r?.correctChoiceIds.includes(c.id) ?? false;
                            return (
                              <li
                                key={c.id}
                                className={cn(
                                  "text-xs",
                                  isCorrectChoice
                                    ? "font-medium text-emerald-700 dark:text-emerald-400"
                                    : wasSelected
                                      ? "text-red-700 dark:text-red-400"
                                      : "text-slate-500 dark:text-slate-400",
                                )}
                              >
                                {isCorrectChoice ? "✓ " : wasSelected ? "✗ " : "· "}
                                {c.text}
                                {wasSelected && !isCorrectChoice ? " (your answer)" : ""}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-hidden px-0.5 py-1">
            <div className="space-y-2" data-testid="quiz-step-indicator">
              <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                <span>
                  Question {stepIndex + 1} of {totalQuestions}
                </span>
                <span>{Math.round(progressPct)}%</span>
              </div>
              <div className="flex items-center gap-1.5">
                {questions.map((q, idx) => (
                  <span
                    key={q.id}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      idx === stepIndex
                        ? "bg-primary"
                        : idx < stepIndex
                          ? "bg-primary/50"
                          : "bg-slate-200 dark:bg-slate-800",
                    )}
                  />
                ))}
              </div>
            </div>

            <AnimatePresence mode="wait" custom={direction}>
              {currentQuestion && (
                <motion.div
                  key={currentQuestion.id}
                  custom={direction}
                  variants={stepVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="rounded-lg border border-slate-200 p-3 dark:border-slate-800"
                  data-testid={`quiz-runner-question-${stepIndex}`}
                >
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {stepIndex + 1}. {currentQuestion.text}
                  </p>
                  <div className="mt-2">
                    {currentQuestion.type === "single" ? (
                      <RadioGroup
                        value={answers[currentQuestion.id]?.[0]}
                        onValueChange={(v) => setSingleAnswer(currentQuestion.id, v)}
                        className="space-y-1.5"
                      >
                        {currentQuestion.choices.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <RadioGroupItem
                              value={c.id}
                              id={`answer-${currentQuestion.id}-${c.id}`}
                              data-testid={`radio-answer-${stepIndex}-${c.id}`}
                            />
                            <Label
                              htmlFor={`answer-${currentQuestion.id}-${c.id}`}
                              className="cursor-pointer text-sm font-normal text-slate-700 dark:text-slate-300"
                            >
                              {c.text}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : (
                      <div className="space-y-1.5">
                        {currentQuestion.choices.map((c) => (
                          <div key={c.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`answer-${currentQuestion.id}-${c.id}`}
                              checked={answers[currentQuestion.id]?.includes(c.id) ?? false}
                              onCheckedChange={(checked) =>
                                toggleMultipleAnswer(currentQuestion.id, c.id, checked === true)
                              }
                              data-testid={`checkbox-answer-${stepIndex}-${c.id}`}
                            />
                            <Label
                              htmlFor={`answer-${currentQuestion.id}-${c.id}`}
                              className="cursor-pointer text-sm font-normal text-slate-700 dark:text-slate-300"
                            >
                              {c.text}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <DialogFooter
          className={cn(
            "mt-4 shrink-0 border-t border-slate-200 pt-4 dark:border-slate-800",
            !result && questions.length > 0 && "sm:justify-between",
          )}
        >
          {result ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-close-quiz-results"
              >
                Close
              </Button>
              <Button type="button" onClick={handleRetake} data-testid="button-retake-quiz-dialog">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retake
              </Button>
            </>
          ) : (
            questions.length > 0 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  data-testid="button-cancel-quiz"
                >
                  Cancel
                </Button>
                <div className="flex gap-2">
                  {!isFirstStep && (
                    <Button type="button" variant="outline" onClick={goBack} data-testid="button-quiz-back">
                      Back
                    </Button>
                  )}
                  {isLastStep ? (
                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!currentAnswered || submitting}
                      data-testid="button-quiz-submit"
                    >
                      {submitting ? "Submitting..." : "Submit"}
                    </Button>
                  ) : (
                    <Button type="button" onClick={goNext} disabled={!currentAnswered} data-testid="button-quiz-next">
                      Next
                    </Button>
                  )}
                </div>
              </>
            )
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
