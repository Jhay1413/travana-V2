import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HubEmptyState } from "@/features/hub/components/hub-components";
import { useQuiz, useLessonQuiz, useSectionQuiz } from "@/features/hub/api/use-training-queries";
import { useUpsertQuiz, useUpsertLessonQuiz, useUpsertSectionQuiz } from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { QuestionType, QuizQuestionView } from "@/features/hub/types/training.types";

interface TrainingQuizBuilderProps {
  courseId: string;
  /** When set, the builder targets this LESSON's quiz instead of the course final quiz. */
  lessonId?: string;
  /** When set, the builder targets this SECTION's quiz instead of the course final quiz. */
  sectionId?: string;
  /** Called after a successful save — e.g. to close a wrapping dialog. */
  onSaved?: () => void;
}

interface ChoiceDraft {
  key: string;
  text: string;
  isCorrect: boolean;
}

interface QuestionDraft {
  key: string;
  text: string;
  type: QuestionType;
  points: number;
  choices: ChoiceDraft[];
}

let idSeq = 0;
const nextKey = () => `q-${Date.now()}-${idSeq++}`;

const emptyChoice = (): ChoiceDraft => ({ key: nextKey(), text: "", isCorrect: false });

const emptyQuestion = (): QuestionDraft => ({
  key: nextKey(),
  text: "",
  type: "single",
  points: 1,
  choices: [emptyChoice(), emptyChoice()],
});

function fromQuizQuestions(questions: QuizQuestionView[]): QuestionDraft[] {
  return [...questions]
    .sort((a, b) => a.position - b.position)
    .map((q) => ({
      key: q.id,
      text: q.text,
      type: q.type,
      points: q.points,
      choices: [...q.choices]
        .sort((a, b) => a.position - b.position)
        .map((c) => ({ key: c.id, text: c.text, isCorrect: c.isCorrect ?? false })),
    }));
}

/** Per-question validation errors, keyed by question `key`. */
function validateQuestions(questions: QuestionDraft[]): Map<string, string[]> {
  const errors = new Map<string, string[]>();

  if (questions.length === 0) return errors;

  for (const q of questions) {
    const msgs: string[] = [];
    if (!q.text.trim()) msgs.push("Question text is required.");

    const nonEmptyChoices = q.choices.filter((c) => c.text.trim().length > 0);
    if (nonEmptyChoices.length < 2) msgs.push("Add at least 2 choices.");

    const correctCount = q.choices.filter((c) => c.isCorrect && c.text.trim().length > 0).length;
    if (q.type === "single" && correctCount !== 1) {
      msgs.push("Mark exactly 1 correct choice.");
    }
    if (q.type === "multiple" && correctCount < 1) {
      msgs.push("Mark at least 1 correct choice.");
    }

    if (msgs.length > 0) errors.set(q.key, msgs);
  }

  return errors;
}

/**
 * Admin quiz builder — full replace-upsert of a course's final quiz, or of a
 * single lesson's quiz when `lessonId` is set. Question cards with a
 * single/multiple type toggle, points, and a choices list (radio for
 * single-answer, checkboxes for multi-answer). Client-side validation
 * mirrors the server (`training-quiz.service.ts`): >=1 question, each with
 * >=2 non-empty choices, single = exactly 1 correct, multiple >=1 correct.
 * Save is disabled until valid.
 */
export function TrainingQuizBuilder({ courseId, lessonId, sectionId, onSaved }: TrainingQuizBuilderProps) {
  // Exactly one of the three queries is enabled (all hooks always run — the
  // disabled ones get an empty id, matching their `enabled: !!id` guard).
  const courseQuiz = useQuiz(lessonId || sectionId ? "" : courseId);
  const lessonQuiz = useLessonQuiz(lessonId ?? "");
  const sectionQuiz = useSectionQuiz(sectionId ?? "");
  const { data: quiz, isLoading } = lessonId ? lessonQuiz : sectionId ? sectionQuiz : courseQuiz;
  const upsertQuiz = useUpsertQuiz();
  const upsertLessonQuiz = useUpsertLessonQuiz();
  const upsertSectionQuiz = useUpsertSectionQuiz();
  const saving = lessonId
    ? upsertLessonQuiz.isPending
    : sectionId
      ? upsertSectionQuiz.isPending
      : upsertQuiz.isPending;
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [isRequired, setIsRequired] = useState(false);
  const [questions, setQuestions] = useState<QuestionDraft[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!quiz || initialized) return;
    setTitle(quiz.quiz?.title ?? "");
    setShuffleQuestions(quiz.quiz?.shuffleQuestions ?? false);
    setIsRequired(quiz.quiz?.isRequired ?? false);
    setQuestions(fromQuizQuestions(quiz.questions));
    setInitialized(true);
  }, [quiz, initialized]);

  const errorsByQuestion = validateQuestions(questions);
  const isValid = questions.length > 0 && errorsByQuestion.size === 0;

  const addQuestion = () => setQuestions((prev) => [...prev, emptyQuestion()]);

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const moveQuestion = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= questions.length) return;
    setQuestions((prev) => {
      const reordered = [...prev];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
  };

  const updateQuestion = (index: number, patch: Partial<QuestionDraft>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const changeQuestionType = (index: number, type: QuestionType) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== index) return q;
        if (type === "single") {
          // Switching to single-answer: keep only the first correct choice.
          const firstCorrectIndex = q.choices.findIndex((c) => c.isCorrect);
          return {
            ...q,
            type,
            choices: q.choices.map((c, ci) => ({ ...c, isCorrect: ci === firstCorrectIndex })),
          };
        }
        return { ...q, type };
      }),
    );
  };

  const addChoice = (qIndex: number) => {
    setQuestions((prev) => prev.map((q, i) => (i === qIndex ? { ...q, choices: [...q.choices, emptyChoice()] } : q)));
  };

  const removeChoice = (qIndex: number, cIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === qIndex ? { ...q, choices: q.choices.filter((_, ci) => ci !== cIndex) } : q)),
    );
  };

  const updateChoiceText = (qIndex: number, cIndex: number, text: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, choices: q.choices.map((c, ci) => (ci === cIndex ? { ...c, text } : c)) } : q,
      ),
    );
  };

  const setSingleCorrect = (qIndex: number, choiceKey: string) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex ? { ...q, choices: q.choices.map((c) => ({ ...c, isCorrect: c.key === choiceKey })) } : q,
      ),
    );
  };

  const toggleMultipleCorrect = (qIndex: number, choiceKey: string, checked: boolean) => {
    setQuestions((prev) =>
      prev.map((q, i) =>
        i === qIndex
          ? { ...q, choices: q.choices.map((c) => (c.key === choiceKey ? { ...c, isCorrect: checked } : c)) }
          : q,
      ),
    );
  };

  const handleAddFirstQuestion = () => {
    setInitialized(true);
    setQuestions([emptyQuestion()]);
  };

  const handleSave = async () => {
    if (!isValid) return;
    const payload = {
      title: title.trim() || null,
      shuffleQuestions,
      isRequired,
      questions: questions.map((q) => ({
        text: q.text.trim(),
        type: q.type,
        points: q.points,
        choices: q.choices
          .filter((c) => c.text.trim().length > 0)
          .map((c) => ({ text: c.text.trim(), isCorrect: c.isCorrect })),
      })),
    };
    try {
      if (lessonId) {
        await upsertLessonQuiz.mutateAsync({ lessonId, courseId, ...payload });
      } else if (sectionId) {
        await upsertSectionQuiz.mutateAsync({ sectionId, courseId, ...payload });
      } else {
        await upsertQuiz.mutateAsync({ courseId, ...payload });
      }
      toast({ title: "Quiz saved" });
      onSaved?.();
    } catch (err) {
      toast({
        title: "Failed to save quiz",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-10 dark:border-slate-800 dark:bg-slate-900">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
      data-testid="training-quiz-builder"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <HelpCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />{" "}
            {lessonId ? "Lesson quiz" : sectionId ? "Section quiz" : "Quiz"}
          </h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {lessonId
              ? "A knowledge check for this lesson — passing it marks the lesson complete for the learner. Uses the course passing score."
              : sectionId
                ? "An end-of-section knowledge check — unlocks once the section's lessons are done. Uses the course passing score."
                : "Publishing this course makes the quiz available to learners. The passing score is set above, in the course form."}
          </p>
        </div>
        {questions.length > 0 && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isValid || saving}
            data-testid="button-save-quiz"
          >
            {saving ? "Saving..." : "Save quiz"}
          </Button>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="mt-4">
          <HubEmptyState
            title="No quiz yet"
            description={
              lessonId
                ? "Add your first question to build this lesson's quiz."
                : sectionId
                  ? "Add your first question to build this section's quiz."
                  : "Add your first question to build this course's quiz."
            }
          />
          <div className="mt-4 flex justify-center">
            <Button size="sm" onClick={handleAddFirstQuestion} data-testid="button-add-first-question">
              <Plus className="mr-1.5 h-4 w-4" /> Add first question
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 rounded-lg border border-dashed border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-800">
            <div>
              <Label htmlFor="quiz-title" className="text-xs text-slate-500 dark:text-slate-400">
                Quiz title (optional)
              </Label>
              <Input
                id="quiz-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Final Assessment"
                className="mt-1"
                data-testid="input-quiz-title"
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Shuffle questions</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Randomize question order per attempt.</p>
              </div>
              <Switch checked={shuffleQuestions} onCheckedChange={setShuffleQuestions} data-testid="switch-quiz-shuffle" />
            </div>
            {(lessonId || sectionId) && (
              <div className="flex items-center justify-between rounded-lg border border-slate-200 p-3 sm:col-span-2 dark:border-slate-800">
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {lessonId ? "Required to complete lesson" : "Required to complete course content"}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lessonId
                      ? "On: learners must pass this quiz to complete the lesson. Off: the quiz is an optional knowledge check — content progress alone completes the lesson."
                      : "On: learners must pass this quiz to finish the section and move on. Off: the quiz is an optional knowledge check."}
                  </p>
                </div>
                <Switch checked={isRequired} onCheckedChange={setIsRequired} data-testid="switch-quiz-required" />
              </div>
            )}
          </div>

          {questions.map((q, qIndex) => {
            const errors = errorsByQuestion.get(q.key) ?? [];
            return (
              <div
                key={q.key}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                data-testid={`card-quiz-question-${qIndex}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, -1)}
                        disabled={qIndex === 0}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
                        data-testid={`button-question-up-${qIndex}`}
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveQuestion(qIndex, 1)}
                        disabled={qIndex === questions.length - 1}
                        className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
                        data-testid={`button-question-down-${qIndex}`}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">
                      Question {qIndex + 1}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => removeQuestion(qIndex)}
                    disabled={questions.length <= 1}
                    data-testid={`button-remove-question-${qIndex}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_100px]">
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Question text</Label>
                    <Textarea
                      value={q.text}
                      onChange={(e) => updateQuestion(qIndex, { text: e.target.value })}
                      rows={2}
                      placeholder="e.g. What is the cancellation window?"
                      className="mt-1"
                      data-testid={`input-question-text-${qIndex}`}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Type</Label>
                    <Select value={q.type} onValueChange={(v) => changeQuestionType(qIndex, v as QuestionType)}>
                      <SelectTrigger className="mt-1" data-testid={`select-question-type-${qIndex}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">Single answer</SelectItem>
                        <SelectItem value="multiple">Multiple answer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 dark:text-slate-400">Points</Label>
                    <Input
                      type="number"
                      min={1}
                      value={q.points}
                      onChange={(e) => updateQuestion(qIndex, { points: Math.max(1, Number(e.target.value) || 1) })}
                      className="mt-1"
                      data-testid={`input-question-points-${qIndex}`}
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <Label className="text-xs text-slate-500 dark:text-slate-400">
                    Choices — {q.type === "single" ? "select the correct one" : "check all correct answers"}
                  </Label>

                  {q.type === "single" ? (
                    <RadioGroup
                      value={q.choices.find((c) => c.isCorrect)?.key}
                      onValueChange={(key) => setSingleCorrect(qIndex, key)}
                      className="mt-2 space-y-2"
                    >
                      {q.choices.map((c, cIndex) => (
                        <div key={c.key} className="flex items-center gap-2" data-testid={`row-choice-${qIndex}-${cIndex}`}>
                          <RadioGroupItem
                            value={c.key}
                            id={`choice-${q.key}-${c.key}`}
                            data-testid={`radio-choice-correct-${qIndex}-${cIndex}`}
                          />
                          <Input
                            value={c.text}
                            onChange={(e) => updateChoiceText(qIndex, cIndex, e.target.value)}
                            placeholder={`Choice ${cIndex + 1}`}
                            className="flex-1"
                            data-testid={`input-choice-text-${qIndex}-${cIndex}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeChoice(qIndex, cIndex)}
                            disabled={q.choices.length <= 2}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30 dark:hover:text-red-400"
                            data-testid={`button-remove-choice-${qIndex}-${cIndex}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </RadioGroup>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {q.choices.map((c, cIndex) => (
                        <div key={c.key} className="flex items-center gap-2" data-testid={`row-choice-${qIndex}-${cIndex}`}>
                          <Checkbox
                            checked={c.isCorrect}
                            onCheckedChange={(checked) => toggleMultipleCorrect(qIndex, c.key, checked === true)}
                            data-testid={`checkbox-choice-correct-${qIndex}-${cIndex}`}
                          />
                          <Input
                            value={c.text}
                            onChange={(e) => updateChoiceText(qIndex, cIndex, e.target.value)}
                            placeholder={`Choice ${cIndex + 1}`}
                            className="flex-1"
                            data-testid={`input-choice-text-${qIndex}-${cIndex}`}
                          />
                          <button
                            type="button"
                            onClick={() => removeChoice(qIndex, cIndex)}
                            disabled={q.choices.length <= 2}
                            className="text-slate-400 hover:text-red-600 disabled:opacity-30 dark:hover:text-red-400"
                            data-testid={`button-remove-choice-${qIndex}-${cIndex}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => addChoice(qIndex)}
                    data-testid={`button-add-choice-${qIndex}`}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" /> Add choice
                  </Button>
                </div>

                {errors.length > 0 && (
                  <ul className={cn("mt-3 space-y-1 text-xs text-red-600 dark:text-red-400")}>
                    {errors.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addQuestion} data-testid="button-add-question">
              <Plus className="mr-1.5 h-4 w-4" /> Add question
            </Button>
            {!isValid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">Fix the highlighted questions to save.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
