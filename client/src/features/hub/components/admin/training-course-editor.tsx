import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, useRoute } from "wouter";
import { ArrowLeft, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HubSectionHeader, HubBadge, HubEmptyState } from "@/features/hub/components/hub-components";
import { useCourseContent } from "@/features/hub/api/use-training-queries";
import {
  useCreateCourse,
  useUpdateCourse,
  usePublishCourse,
  useArchiveCourse,
  useCreateLesson,
  useUploadAssets,
} from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import { TrainingLessonEditor } from "./training-lesson-editor";
import { TrainingQuizBuilder } from "./training-quiz-builder";
import { LessonRow } from "./training-lesson-row";
import { LessonFormDialog, EMPTY_LESSON_FORM_VALUES, type LessonFormValues } from "./training-lesson-form-dialog";
import type { CourseVisibility } from "@/features/hub/types/training.types";
import type { DraftLesson } from "@/features/hub/types/training-admin.types";

const courseFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  visibility: z.enum(["global", "org"]),
  passingScore: z.coerce.number().int().min(0).max(100),
  requireContentBeforeQuiz: z.boolean(),
});

type CourseFormValues = z.infer<typeof courseFormSchema>;

const EMPTY_COURSE: CourseFormValues = {
  title: "",
  description: "",
  thumbnailUrl: "",
  visibility: "global",
  passingScore: 80,
  requireContentBeforeQuiz: true,
};

let draftLessonIdSeq = 0;
const nextDraftLessonId = () => `draft-${Date.now()}-${draftLessonIdSeq++}`;

/**
 * Admin course create/edit page, mounted at `/hub/training/admin/:courseId`
 * (`:courseId === "new"` → create mode).
 *
 * Create mode lets authors build up an ordered list of draft lessons
 * (`DraftLesson[]`, local React state only — see `training-admin.types.ts`)
 * before the course exists. On submit, the course is created first, then
 * each draft lesson is persisted in order (uploading any staged graphics
 * files right after its lesson is created), then we navigate into edit mode.
 *
 * Once a course exists (edit mode), lessons persist immediately via
 * `TrainingLessonEditor`, which shares the same `LessonFormDialog`/`LessonRow`
 * UI used here for drafts.
 */
export default function TrainingCourseEditor() {
  const [, params] = useRoute("/hub/training/admin/:courseId");
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const routeCourseId = params?.courseId ?? "new";
  const isNew = routeCourseId === "new";
  const courseId = isNew ? undefined : routeCourseId;

  const { data: course, isLoading } = useCourseContent(courseId ?? "");
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const publishCourse = usePublishCourse();
  const archiveCourse = useArchiveCourse();
  const createLesson = useCreateLesson();
  const uploadAssets = useUploadAssets();

  const form = useForm<CourseFormValues>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: EMPTY_COURSE,
  });

  // Draft lessons, create-mode only — persisted to the server on course submit.
  const [draftLessons, setDraftLessons] = useState<DraftLesson[]>([]);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [savingProgress, setSavingProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (course) {
      form.reset({
        title: course.title,
        description: course.description ?? "",
        thumbnailUrl: course.thumbnail_url ?? "",
        visibility: course.visibility,
        passingScore: course.passing_score,
        requireContentBeforeQuiz: course.require_content_before_quiz,
      });
    }
    // Only re-sync when the fetched course itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const editingDraft = draftLessons.find((d) => d.tempId === editingDraftId) ?? null;

  const openAddDraftDialog = () => {
    setEditingDraftId(null);
    setDraftDialogOpen(true);
  };

  const openEditDraftDialog = (draft: DraftLesson) => {
    setEditingDraftId(draft.tempId);
    setDraftDialogOpen(true);
  };

  const draftInitialValues: LessonFormValues = editingDraft
    ? {
        title: editingDraft.title,
        description: editingDraft.description,
        type: editingDraft.type,
        isRequired: editingDraft.isRequired,
        videoUrl: editingDraft.videoUrl,
      }
    : EMPTY_LESSON_FORM_VALUES;

  const handleDraftDialogSubmit = (values: LessonFormValues, files: File[]) => {
    const draft: DraftLesson = {
      tempId: editingDraft?.tempId ?? nextDraftLessonId(),
      title: values.title,
      description: values.description ?? "",
      type: values.type,
      isRequired: values.isRequired,
      videoUrl: values.type === "video" ? (values.videoUrl ?? null) : null,
      files: values.type === "graphics" ? files : [],
    };
    setDraftLessons((prev) => {
      if (editingDraft) {
        return prev.map((d) => (d.tempId === editingDraft.tempId ? draft : d));
      }
      return [...prev, draft];
    });
    setDraftDialogOpen(false);
  };

  const handleDeleteDraft = (draft: DraftLesson) => {
    if (!window.confirm(`Remove lesson "${draft.title}"?`)) return;
    setDraftLessons((prev) => prev.filter((d) => d.tempId !== draft.tempId));
  };

  const moveDraftLesson = (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= draftLessons.length) return;
    setDraftLessons((prev) => {
      const reordered = [...prev];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      return reordered;
    });
  };

  const isSavingCourse = createCourse.isPending || updateCourse.isPending || savingProgress !== null;

  const handleSubmit = async (values: CourseFormValues) => {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      thumbnailUrl: values.thumbnailUrl || undefined,
      visibility: values.visibility as CourseVisibility,
      passingScore: values.passingScore,
      requireContentBeforeQuiz: values.requireContentBeforeQuiz,
    };

    if (courseId) {
      try {
        await updateCourse.mutateAsync({ id: courseId, ...payload });
        toast({ title: "Course updated" });
      } catch {
        toast({ title: "Failed to save course", variant: "destructive" });
      }
      return;
    }

    // Create mode: course, then each draft lesson in order, then its
    // graphics files (if any) once that lesson's id exists.
    let created;
    try {
      created = await createCourse.mutateAsync(payload);
    } catch {
      toast({ title: "Failed to create course", variant: "destructive" });
      return;
    }

    setSavingProgress({ done: 0, total: draftLessons.length });

    let lessonFailed = false;
    for (let i = 0; i < draftLessons.length; i++) {
      const draft = draftLessons[i];
      try {
        const lesson = await createLesson.mutateAsync({
          courseId: created.id,
          title: draft.title,
          description: draft.description || null,
          type: draft.type,
          isRequired: draft.isRequired,
          position: i,
          videoUrl: draft.type === "video" ? draft.videoUrl : null,
        });

        if (draft.type === "graphics" && draft.files.length > 0) {
          await uploadAssets.mutateAsync({ lessonId: lesson.id, courseId: created.id, files: draft.files });
        }
      } catch {
        lessonFailed = true;
      }
      setSavingProgress({ done: i + 1, total: draftLessons.length });
    }

    setSavingProgress(null);

    if (lessonFailed) {
      toast({
        title: "Course created, but a lesson failed to save",
        description: "Continue editing to fix it.",
        variant: "destructive",
      });
    } else {
      toast({ title: "Course created" });
    }
    navigate(`/hub/training/admin/${created.id}`);
  };

  const handlePublish = () => {
    if (!courseId) return;
    publishCourse.mutate(courseId, {
      onSuccess: () => toast({ title: "Course published" }),
      onError: () => toast({ title: "Failed to publish course", variant: "destructive" }),
    });
  };

  const handleArchive = () => {
    if (!courseId) return;
    if (!window.confirm("Archive this course? Learners will no longer be able to enroll.")) return;
    archiveCourse.mutate(courseId, {
      onSuccess: () => toast({ title: "Course archived" }),
      onError: () => toast({ title: "Failed to archive course", variant: "destructive" }),
    });
  };

  if (!isNew && isLoading) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-16 dark:border-slate-800 dark:bg-slate-900"
        data-testid="training-course-editor-loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const submitLabel = isSavingCourse
    ? isNew && savingProgress && savingProgress.total > 0
      ? `Creating course… (${savingProgress.done}/${savingProgress.total} lessons)`
      : isNew
        ? "Creating course…"
        : "Saving..."
    : isNew
      ? "Create course"
      : "Save changes";

  return (
    <div data-testid="page-training-course-editor">
      <button
        onClick={() => navigate("/hub/training/admin")}
        className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
        data-testid="button-back-training-admin"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Training Admin
      </button>

      <HubSectionHeader
        title={isNew ? "New Course" : course?.title ?? "Edit Course"}
        subtitle={
          isNew ? "Create a new training course and add its lessons" : "Manage course details and lessons"
        }
        action={
          course ? (
            <div className="flex items-center gap-2">
              <HubBadge
                variant={course.status === "published" ? "green" : course.status === "archived" ? "red" : "amber"}
              >
                {course.status}
              </HubBadge>
              {course.status === "draft" && (
                <Button
                  size="sm"
                  onClick={handlePublish}
                  disabled={publishCourse.isPending}
                  data-testid="button-publish-course"
                >
                  Publish
                </Button>
              )}
              {course.status !== "archived" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleArchive}
                  disabled={archiveCourse.isPending}
                  data-testid="button-archive-course"
                >
                  Archive
                </Button>
              )}
            </div>
          ) : undefined
        }
      />

      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <fieldset disabled={isSavingCourse} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Selling All-Inclusive Packages"
                        data-testid="input-course-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="What will staff learn in this course?"
                        data-testid="input-course-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="thumbnailUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thumbnail URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="https://..." data-testid="input-course-thumbnail" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Visibility</FormLabel>
                      <Select value={field.value} onValueChange={(v) => field.onChange(v as CourseVisibility)}>
                        <FormControl>
                          <SelectTrigger data-testid="select-course-visibility">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="global">Global (all tenants)</SelectItem>
                          <SelectItem value="org">This organization only</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="passingScore"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passing score (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          {...field}
                          data-testid="input-course-passing-score"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="requireContentBeforeQuiz"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    <div className="space-y-0.5">
                      <FormLabel>Require content before quiz</FormLabel>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Learners must finish all required lessons before the quiz unlocks.
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="switch-course-require-content"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              {isNew && (
                <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Quiz</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Save the course first — you'll be able to build its quiz from here once it exists.
                    </p>
                  </div>
                </div>
              )}

              {isNew && (
                <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Lessons</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Add lessons now — they'll be created together with the course.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={openAddDraftDialog}
                      data-testid="button-add-draft-lesson"
                    >
                      <Plus className="mr-1.5 h-4 w-4" /> Add lesson
                    </Button>
                  </div>

                  {draftLessons.length === 0 ? (
                    <div className="mt-4">
                      <HubEmptyState
                        title="No lessons yet"
                        description="Add a video or graphics lesson to get started."
                      />
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      {draftLessons.map((draft, i) => (
                        <LessonRow
                          key={draft.tempId}
                          id={draft.tempId}
                          title={draft.title}
                          type={draft.type}
                          isRequired={draft.isRequired}
                          mediaBadge={draft.type === "graphics" ? `${draft.files.length} image(s)` : undefined}
                          index={i}
                          total={draftLessons.length}
                          onMoveUp={() => moveDraftLesson(i, -1)}
                          onMoveDown={() => moveDraftLesson(i, 1)}
                          onEdit={() => openEditDraftDialog(draft)}
                          onDelete={() => handleDeleteDraft(draft)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSavingCourse} data-testid="button-save-course">
                  {submitLabel}
                </Button>
              </div>
            </fieldset>
          </form>
        </Form>
      </div>

      {isNew && (
        <LessonFormDialog
          open={draftDialogOpen}
          onOpenChange={setDraftDialogOpen}
          dialogTitle={editingDraft ? "Edit lesson" : "Add lesson"}
          initialValues={draftInitialValues}
          initialFiles={editingDraft?.files}
          disableTypeChange={!!editingDraft}
          onSubmit={handleDraftDialogSubmit}
        />
      )}

      {courseId && (
        <div className="mt-6">
          <TrainingLessonEditor courseId={courseId} />
        </div>
      )}

      {courseId && (
        <div className="mt-6">
          <TrainingQuizBuilder courseId={courseId} />
        </div>
      )}
    </div>
  );
}
