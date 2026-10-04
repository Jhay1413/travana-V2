import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { TrainingVideoUpload } from "./training-video-upload";
import { LessonTypePicker } from "./training-lesson-type-picker";
import { GraphicsDropzone } from "./training-image-picker";
import { LessonAssetManager } from "./training-lesson-asset-manager";
import type { LessonWithAssets } from "@/features/hub/types/training.types";
import type { StagedSlide } from "@/features/hub/types/training-admin.types";

export const lessonFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    description: z.string().optional(),
    type: z.enum(["video", "graphics"]),
    isRequired: z.boolean(),
    videoUrl: z.string().nullable().optional(),
  })
  .refine((data) => data.type !== "video" || !!data.videoUrl, {
    message: "Upload a video before saving this lesson",
    path: ["videoUrl"],
  });

export type LessonFormValues = z.infer<typeof lessonFormSchema>;

export const EMPTY_LESSON_FORM_VALUES: LessonFormValues = {
  title: "",
  description: "",
  type: "video",
  isRequired: true,
  videoUrl: null,
};

interface LessonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dialogTitle: string;
  initialValues: LessonFormValues;
  /** Graphics slides staged so far (draft mode, or a persisted lesson still mid-create). */
  initialSlides?: StagedSlide[];
  /** Locks the type picker — set once a lesson (draft or persisted) already has content. */
  disableTypeChange?: boolean;
  /**
   * When set, this lesson already exists on the server: graphics uploads/deletes
   * happen immediately via `LessonAssetManager` instead of being staged locally.
   * Requires `courseId`.
   */
  existingLesson?: LessonWithAssets | null;
  courseId?: string;
  saving?: boolean;
  savingLabel?: string;
  onSubmit: (values: LessonFormValues, slides: StagedSlide[]) => void | Promise<void>;
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-slate-200 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
      {children}
    </h3>
  );
}

/**
 * Shared add/edit lesson dialog used by both the create-mode draft lesson
 * list (`TrainingCourseEditor`, local state) and the persisted lesson list
 * (`TrainingLessonEditor`, server state). The caller owns persistence —
 * this component only collects form values + any staged graphics files and
 * hands them to `onSubmit`.
 */
export function LessonFormDialog({
  open,
  onOpenChange,
  dialogTitle,
  initialValues,
  initialSlides = [],
  disableTypeChange = false,
  existingLesson = null,
  courseId,
  saving = false,
  savingLabel,
  onSubmit,
}: LessonFormDialogProps) {
  const [slides, setSlides] = useState<StagedSlide[]>(initialSlides);

  const form = useForm<LessonFormValues>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: initialValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(initialValues);
      setSlides(initialSlides);
    }
    // Only re-sync when the dialog (re)opens with a fresh set of initial values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const watchedType = form.watch("type");

  const handleSubmit = async (values: LessonFormValues) => {
    await onSubmit(values, slides);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1 flex-col overflow-hidden">
            <div className="-mr-1 flex-1 overflow-y-auto px-1 py-1 pr-2">
              <div className="grid gap-6 md:grid-cols-5">
                <div className="space-y-5 md:col-span-2">
                  <SectionHeading>Lesson details</SectionHeading>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="e.g. Closing on the First Call" data-testid="input-lesson-title" />
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
                            placeholder="Optional notes for this lesson"
                            data-testid="input-lesson-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <FormControl>
                          <LessonTypePicker value={field.value} onChange={field.onChange} disabled={disableTypeChange} />
                        </FormControl>
                        {disableTypeChange && (
                          <p className="text-xs text-slate-500 dark:text-slate-400" data-testid="text-type-locked">
                            Type can't be changed once the lesson has content.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isRequired"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                        <div className="space-y-0.5">
                          <FormLabel>Required</FormLabel>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Learners must complete this lesson to finish the course.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="switch-lesson-required"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-4 md:col-span-3">
                  <SectionHeading>Content</SectionHeading>

                  {watchedType === "video" && (
                    <FormField
                      control={form.control}
                      name="videoUrl"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Video</FormLabel>
                          <FormControl>
                            <TrainingVideoUpload
                              videoUrl={field.value ?? null}
                              onUploaded={(result) => field.onChange(result.playbackUrl)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {watchedType === "graphics" &&
                    (existingLesson ? (
                      // Persisted lesson: courseId is guaranteed by the caller contract
                      // (only `TrainingLessonEditor` passes `existingLesson`).
                      <LessonAssetManager lesson={existingLesson} courseId={courseId as string} />
                    ) : (
                      <GraphicsDropzone slides={slides} onChange={setSlides} />
                    ))}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-4 shrink-0 border-t border-slate-200 pt-4 dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-lesson"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="button-save-lesson">
                {saving ? (savingLabel ?? "Saving...") : "Save lesson"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
