import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubEmptyState } from "@/features/hub/components/hub-components";
import { useCourseContent } from "@/features/hub/api/use-training-queries";
import {
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  useReorderLessons,
  useUploadAssets,
} from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { LessonRow } from "./training-lesson-row";
import { LessonFormDialog, EMPTY_LESSON_FORM_VALUES, type LessonFormValues } from "./training-lesson-form-dialog";
import type { LessonWithAssets } from "@/features/hub/types/training.types";

interface TrainingLessonEditorProps {
  courseId: string;
}

/**
 * Manages a course's ordered lessons: add/edit/delete, up/down reorder
 * (persisted via `useReorderLessons`), and per-type content — a video upload
 * for video lessons, an image asset manager for graphics lessons. Uses the
 * shared `LessonFormDialog`/`LessonRow` also used by the create-mode draft
 * lesson list in `TrainingCourseEditor`.
 */
export function TrainingLessonEditor({ courseId }: TrainingLessonEditorProps) {
  const { data: course, isLoading } = useCourseContent(courseId);
  const { toast } = useToast();

  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();
  const reorderLessons = useReorderLessons();
  const uploadAssets = useUploadAssets();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonWithAssets | null>(null);

  const lessons = [...(course?.lessons ?? [])].sort((a, b) => a.position - b.position);

  const openCreateDialog = () => {
    setEditingLesson(null);
    setDialogOpen(true);
  };

  const openEditDialog = (lesson: LessonWithAssets) => {
    setEditingLesson(lesson);
    setDialogOpen(true);
  };

  const initialValues: LessonFormValues = editingLesson
    ? {
        title: editingLesson.title,
        description: editingLesson.description ?? "",
        type: editingLesson.type,
        isRequired: editingLesson.is_required,
        videoUrl: editingLesson.video_url,
      }
    : EMPTY_LESSON_FORM_VALUES;

  const handleDialogSubmit = async (values: LessonFormValues, files: File[]) => {
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
          courseId,
          title: values.title,
          description: values.description || null,
          type: values.type,
          isRequired: values.isRequired,
          position: lessons.length,
          videoUrl: values.type === "video" ? values.videoUrl : null,
        });

        if (values.type === "graphics" && files.length > 0) {
          try {
            await uploadAssets.mutateAsync({ lessonId: created.id, courseId, files });
          } catch {
            toast({ title: "Lesson created, but images failed to upload", variant: "destructive" });
            setDialogOpen(false);
            return;
          }
        }
        toast({ title: "Lesson created" });
      }
      setDialogOpen(false);
    } catch {
      toast({ title: "Failed to save lesson", variant: "destructive" });
    }
  };

  const handleDelete = (lesson: LessonWithAssets) => {
    if (!window.confirm(`Delete lesson "${lesson.title}"? This cannot be undone.`)) return;
    deleteLesson.mutate(
      { id: lesson.id, courseId },
      {
        onSuccess: () => toast({ title: "Lesson deleted" }),
        onError: () => toast({ title: "Failed to delete lesson", variant: "destructive" }),
      },
    );
  };

  const moveLesson = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;
    const reordered = [...lessons];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);
    reorderLessons.mutate({
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
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lessons</h3>
        <Button size="sm" onClick={openCreateDialog} data-testid="button-add-lesson">
          <Plus className="mr-1.5 h-4 w-4" /> Add lesson
        </Button>
      </div>

      {lessons.length === 0 ? (
        <div className="mt-4">
          <HubEmptyState title="No lessons yet" description="Add a video or graphics lesson to get started." />
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {lessons.map((lesson, i) => (
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
              onMoveUp={() => moveLesson(i, -1)}
              onMoveDown={() => moveLesson(i, 1)}
              onEdit={() => openEditDialog(lesson)}
              onDelete={() => handleDelete(lesson)}
            />
          ))}
        </div>
      )}

      <LessonFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        dialogTitle={editingLesson ? "Edit lesson" : "Add lesson"}
        initialValues={initialValues}
        disableTypeChange={!!editingLesson}
        existingLesson={editingLesson}
        courseId={courseId}
        saving={createLesson.isPending || updateLesson.isPending || uploadAssets.isPending}
        savingLabel="Saving..."
        onSubmit={handleDialogSubmit}
      />
    </div>
  );
}
