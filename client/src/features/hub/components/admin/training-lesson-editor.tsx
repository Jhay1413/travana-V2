import { useState } from "react";
import { ArrowDown, ArrowUp, HelpCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HubBadge, HubEmptyState } from "@/features/hub/components/hub-components";
import { TrainingQuizBuilder } from "./training-quiz-builder";
import { useCourseContent } from "@/features/hub/api/use-training-queries";
import {
  useCreateSection,
  useUpdateSection,
  useDeleteSection,
  useReorderSections,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useReorderLessons,
  useUploadAssets,
} from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { LessonRow } from "./training-lesson-row";
import { LessonFormDialog, EMPTY_LESSON_FORM_VALUES, type LessonFormValues } from "./training-lesson-form-dialog";
import type { LessonWithAssets, SectionWithLessons } from "@/features/hub/types/training.types";

interface TrainingLessonEditorProps {
  courseId: string;
}

/** The quiz-builder dialog's target: a section's quiz or a single lesson's quiz. */
type QuizTarget = { kind: "section"; section: SectionWithLessons } | { kind: "lesson"; lesson: LessonWithAssets };

/**
 * Manages a course's curriculum: ordered SECTIONS (add/edit/delete, up/down
 * reorder), each holding its ordered lessons (add/edit/delete, reorder within
 * the section) — plus a quiz per lesson AND per section, both built with the
 * shared `TrainingQuizBuilder`. Uses the shared `LessonFormDialog`/`LessonRow`
 * also used by the create-mode draft lesson list in `TrainingCourseEditor`.
 */
export function TrainingLessonEditor({ courseId }: TrainingLessonEditorProps) {
  const { data: course, isLoading } = useCourseContent(courseId);
  const { toast } = useToast();

  const createSection = useCreateSection();
  const updateSection = useUpdateSection();
  const deleteSection = useDeleteSection();
  const reorderSections = useReorderSections();
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const reorderLessons = useReorderLessons();
  const uploadAssets = useUploadAssets();

  // Section create/edit dialog.
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionWithLessons | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");

  // Lesson create/edit dialog — creates always target `lessonDialogSection`.
  const [lessonDialogSection, setLessonDialogSection] = useState<SectionWithLessons | null>(null);
  const [editingLesson, setEditingLesson] = useState<LessonWithAssets | null>(null);

  const [quizTarget, setQuizTarget] = useState<QuizTarget | null>(null);

  const sections = [...(course?.sections ?? [])].sort((a, b) => a.position - b.position);

  const openCreateSectionDialog = () => {
    setEditingSection(null);
    setSectionTitle("");
    setSectionDescription("");
    setSectionDialogOpen(true);
  };

  const openEditSectionDialog = (section: SectionWithLessons) => {
    setEditingSection(section);
    setSectionTitle(section.title);
    setSectionDescription(section.description ?? "");
    setSectionDialogOpen(true);
  };

  const handleSectionDialogSave = async () => {
    const title = sectionTitle.trim();
    if (!title) return;
    try {
      if (editingSection) {
        await updateSection.mutateAsync({
          id: editingSection.id,
          courseId,
          title,
          description: sectionDescription.trim() || null,
        });
        toast({ title: "Section updated" });
      } else {
        await createSection.mutateAsync({ courseId, title, description: sectionDescription.trim() || null });
        toast({ title: "Section created" });
      }
      setSectionDialogOpen(false);
    } catch {
      toast({ title: "Failed to save section", variant: "destructive" });
    }
  };

  const handleDeleteSection = (section: SectionWithLessons) => {
    const lessonNote = section.lessons.length > 0 ? ` Its ${section.lessons.length} lesson(s) will be deleted too.` : "";
    if (!window.confirm(`Delete section "${section.title}"?${lessonNote} This cannot be undone.`)) return;
    deleteSection.mutate(
      { id: section.id, courseId },
      {
        onSuccess: () => toast({ title: "Section deleted" }),
        onError: () => toast({ title: "Failed to delete section", variant: "destructive" }),
      },
    );
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sections.length) return;
    const reordered = [...sections];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderSections.mutate({
      courseId,
      order: reordered.map((section, i) => ({ id: section.id, position: i })),
    });
  };

  const openCreateLessonDialog = (section: SectionWithLessons) => {
    setEditingLesson(null);
    setLessonDialogSection(section);
  };

  const openEditLessonDialog = (section: SectionWithLessons, lesson: LessonWithAssets) => {
    setEditingLesson(lesson);
    setLessonDialogSection(section);
  };

  const lessonInitialValues: LessonFormValues = editingLesson
    ? {
        title: editingLesson.title,
        description: editingLesson.description ?? "",
        type: editingLesson.type,
        isRequired: editingLesson.is_required,
        videoUrl: editingLesson.video_url,
      }
    : EMPTY_LESSON_FORM_VALUES;

  const handleLessonDialogSubmit = async (values: LessonFormValues, files: File[]) => {
    if (!lessonDialogSection) return;
    try {
      if (editingLesson) {
        await updateLesson.mutateAsync({
          id: editingLesson.id,
          courseId,
          title: values.title,
          description: values.description || null,
          type: values.type,
          isRequired: values.isRequired,
          videoUrl: values.type === "video" ? values.videoUrl : null,
        });
        toast({ title: "Lesson updated" });
      } else {
        const created = await createLesson.mutateAsync({
          sectionId: lessonDialogSection.id,
          courseId,
          title: values.title,
          description: values.description || null,
          type: values.type,
          isRequired: values.isRequired,
          position: lessonDialogSection.lessons.length,
          videoUrl: values.type === "video" ? values.videoUrl : null,
        });

        if (values.type === "graphics" && files.length > 0) {
          try {
            await uploadAssets.mutateAsync({ lessonId: created.id, courseId, files });
          } catch {
            toast({ title: "Lesson created, but images failed to upload", variant: "destructive" });
            setLessonDialogSection(null);
            return;
          }
        }
        toast({ title: "Lesson created" });
      }
      setLessonDialogSection(null);
    } catch {
      toast({ title: "Failed to save lesson", variant: "destructive" });
    }
  };

  const handleDeleteLesson = (lesson: LessonWithAssets) => {
    if (!window.confirm(`Delete lesson "${lesson.title}"? This cannot be undone.`)) return;
    deleteLesson.mutate(
      { id: lesson.id, courseId },
      {
        onSuccess: () => toast({ title: "Lesson deleted" }),
        onError: () => toast({ title: "Failed to delete lesson", variant: "destructive" }),
      },
    );
  };

  const moveLesson = (section: SectionWithLessons, index: number, direction: -1 | 1) => {
    const lessons = [...section.lessons].sort((a, b) => a.position - b.position);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderLessons.mutate({
      sectionId: section.id,
      courseId,
      order: reordered.map((lesson, i) => ({ id: lesson.id, position: i })),
    });
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
      data-testid="training-lesson-editor"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Curriculum</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Organize the course into sections — each section holds its own lessons and can have its own quiz.
          </p>
        </div>
        <Button size="sm" onClick={openCreateSectionDialog} data-testid="button-add-section">
          <Plus className="mr-1.5 h-4 w-4" /> Add section
        </Button>
      </div>

      {sections.length === 0 ? (
        <div className="mt-4">
          <HubEmptyState title="No sections yet" description="Add a section, then add lessons inside it." />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {sections.map((section, sIndex) => {
            const lessons = [...section.lessons].sort((a, b) => a.position - b.position);
            return (
              <div
                key={section.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800"
                data-testid={`card-section-${section.id}`}
              >
                <div className="flex items-center gap-3 border-b border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveSection(sIndex, -1)}
                      disabled={sIndex === 0 || reorderSections.isPending}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
                      data-testid={`button-section-up-${section.id}`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSection(sIndex, 1)}
                      disabled={sIndex === sections.length - 1 || reorderSections.isPending}
                      className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
                      data-testid={`button-section-down-${section.id}`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                      Section {sIndex + 1}: {section.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <HubBadge>{lessons.length} lesson(s)</HubBadge>
                      {section.has_quiz && (
                        <HubBadge variant="green">{section.quiz_required ? "Required quiz" : "Quiz"}</HubBadge>
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuizTarget({ kind: "section", section })}
                    data-testid={`button-quiz-section-${section.id}`}
                  >
                    <HelpCircle className="mr-1.5 h-3.5 w-3.5" /> Quiz
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openEditSectionDialog(section)}
                    data-testid={`button-edit-section-${section.id}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => handleDeleteSection(section)}
                    data-testid={`button-delete-section-${section.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 p-3">
                  {section.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
                  )}

                  {lessons.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-200 p-3 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      No lessons in this section yet.
                    </p>
                  ) : (
                    lessons.map((lesson, i) => (
                      <LessonRow
                        key={lesson.id}
                        id={lesson.id}
                        title={lesson.title}
                        type={lesson.type}
                        isRequired={lesson.is_required}
                        mediaBadge={lesson.type === "graphics" ? `${lesson.assets.length} image(s)` : undefined}
                        index={i}
                        total={lessons.length}
                        reordering={reorderLessons.isPending}
                        hasQuiz={lesson.has_quiz}
                        quizRequired={lesson.quiz_required}
                        onMoveUp={() => moveLesson(section, i, -1)}
                        onMoveDown={() => moveLesson(section, i, 1)}
                        onEdit={() => openEditLessonDialog(section, lesson)}
                        onDelete={() => handleDeleteLesson(lesson)}
                        onQuiz={() => setQuizTarget({ kind: "lesson", lesson })}
                      />
                    ))
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openCreateLessonDialog(section)}
                    data-testid={`button-add-lesson-${section.id}`}
                  >
                    <Plus className="mr-1.5 h-4 w-4" /> Add lesson
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Section create/edit dialog. */}
      <Dialog open={sectionDialogOpen} onOpenChange={setSectionDialogOpen}>
        <DialogContent className="sm:max-w-md" data-testid="dialog-section-form">
          <DialogHeader>
            <DialogTitle>{editingSection ? "Edit section" : "Add section"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="section-title">Title</Label>
              <Input
                id="section-title"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="e.g. Getting Started"
                className="mt-1"
                data-testid="input-section-title"
              />
            </div>
            <div>
              <Label htmlFor="section-description">Description (optional)</Label>
              <Textarea
                id="section-description"
                value={sectionDescription}
                onChange={(e) => setSectionDescription(e.target.value)}
                rows={2}
                placeholder="What does this section cover?"
                className="mt-1"
                data-testid="input-section-description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSectionDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSectionDialogSave}
              disabled={!sectionTitle.trim() || createSection.isPending || updateSection.isPending}
              data-testid="button-save-section"
            >
              {createSection.isPending || updateSection.isPending ? "Saving..." : "Save section"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LessonFormDialog
        open={lessonDialogSection !== null}
        onOpenChange={(open) => !open && setLessonDialogSection(null)}
        dialogTitle={
          editingLesson ? "Edit lesson" : `Add lesson — ${lessonDialogSection?.title ?? ""}`
        }
        initialValues={lessonInitialValues}
        disableTypeChange={!!editingLesson}
        existingLesson={editingLesson}
        courseId={courseId}
        saving={createLesson.isPending || updateLesson.isPending || uploadAssets.isPending}
        savingLabel="Saving..."
        onSubmit={handleLessonDialogSubmit}
      />

      {/* Quiz builder dialog — keyed by target so the builder state resets
          when switching between lessons/sections. */}
      <Dialog open={quizTarget !== null} onOpenChange={(open) => !open && setQuizTarget(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {quizTarget?.kind === "section"
                ? `Section quiz — ${quizTarget.section.title}`
                : `Quiz — ${quizTarget?.kind === "lesson" ? quizTarget.lesson.title : ""}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {quizTarget?.kind === "lesson" && (
              <TrainingQuizBuilder
                key={quizTarget.lesson.id}
                courseId={courseId}
                lessonId={quizTarget.lesson.id}
                onSaved={() => setQuizTarget(null)}
              />
            )}
            {quizTarget?.kind === "section" && (
              <TrainingQuizBuilder
                key={quizTarget.section.id}
                courseId={courseId}
                sectionId={quizTarget.section.id}
                onSaved={() => setQuizTarget(null)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
