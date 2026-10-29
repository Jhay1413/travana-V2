import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useSavePost,
  useScheduleOnOnlySocials,
  useRescheduleOnOnlySocials,
} from "@/features/social/api/use-social-post-mutations";
import { useToast } from "@/hooks/use-toast";
import { Clock, Send, Sparkles } from "lucide-react";
import { editorHtmlToPost, postToEditorHtml } from "@/lib/post-editor-html";
import { browserTimezoneLabel, combineLocal, splitLocal } from "@/features/social/lib/schedule-time";
import { PostContentForm } from "./post-content-form";
import { FacebookOptionsCard } from "./facebook-options-card";
import { PostImagesGrid } from "./post-images-grid";
import { PostPreviewPanel } from "./post-preview-panel";
import { PostEditorFooter } from "./post-editor-footer";
import { isDirtySnapshot, type EditorSnapshot } from "./dirty-check";
import { usePostImages, urlSortKey } from "./use-post-images";
import { buildOrderedUpload } from "./image-order";
import type { SocialPostEditorDialogProps } from "./editor.types";

const DEFAULT_TIME = "09:00";
const imagesLabel = (n: number) => `${n} image${n === 1 ? "" : "s"}`;

/** Wall-clock "YYYY-MM-DDTHH:mm" of a stored UTC schedule, in the browser's timezone. */
function scheduleToLocal(postSchedule: string | null | undefined): string {
  if (!postSchedule) return "";
  const d = new Date(postSchedule);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SocialPostEditorDialog({
  open,
  onOpenChange,
  travelDeal,
  quoteImageUrl,
  isGenerating,
  quoteId,
  timeShortcuts = [],
  timezoneLabel,
  initialViewLink = true,
  initialPriceBadge = true,
  initialScheduleDate,
  pageName,
  onRegenerate,
  onSavedDraft,
}: SocialPostEditorDialogProps) {
  const { toast } = useToast();
  const savePost = useSavePost();
  const scheduleOnOnlySocials = useScheduleOnOnlySocials();
  const rescheduleOnOnlySocials = useRescheduleOnOnlySocials();
  const postRef = useRef<HTMLDivElement>(null);
  const previewFrame = useRef(0);
  const [scheduleOn, setScheduleOn] = useState(true);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState(DEFAULT_TIME);
  const [viewLink, setViewLink] = useState(initialViewLink);
  const [priceBadge, setPriceBadge] = useState(initialPriceBadge);
  const [previewHtml, setPreviewHtml] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // What was loaded, for the unsaved-changes guard.
  const baseline = useRef<Pick<EditorSnapshot, "post" | "schedule"> | null>(null);
  const baselineImages = useRef<string | null>(null);

  const isScheduled = !!travelDeal?.onlySocialsId;
  const isBusy = savePost.isPending || scheduleOnOnlySocials.isPending || rescheduleOnOnlySocials.isPending;
  const images = usePostImages({ open, travelDeal, quoteId, quoteImageUrl, isScheduled });
  const { imageOrder, formatCount, signature, imagesLoaded } = images;

  const scheduleValue = () => (scheduleDate ? `${scheduleDate}T${scheduleTime}` : "");
  const currentPost = () => editorHtmlToPost(postRef.current?.innerHTML ?? "");

  useEffect(() => {
    if (!travelDeal || isGenerating) return;
    if (postRef.current) {
      postRef.current.innerHTML = postToEditorHtml(travelDeal.post || "");
    }
    const { date, time } = splitLocal(scheduleToLocal(travelDeal.postSchedule));
    // An already-scheduled post keeps its own date; otherwise use the date the post was dropped on.
    const prefill = date || initialScheduleDate || "";
    setScheduleDate(prefill);
    setScheduleTime(time || DEFAULT_TIME);
    const post = currentPost();
    setPreviewHtml(post);
    baseline.current = {
      post,
      schedule: prefill ? `${prefill}T${time || DEFAULT_TIME}` : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelDeal, isGenerating]);

  useEffect(() => {
    if (open) {
      setViewLink(initialViewLink);
      setPriceBadge(initialPriceBadge);
    } else {
      baseline.current = null;
      baselineImages.current = null;
      setScheduleOn(true);
    }
  }, [open, initialViewLink, initialPriceBadge]);

  // A different deal (e.g. after a Luna regenerate) has its own image set: re-baseline.
  const dealId = travelDeal?.id;
  useEffect(() => {
    baselineImages.current = null;
  }, [dealId]);

  // Snapshot the image selection once everything has loaded.
  useEffect(() => {
    if (open && imagesLoaded && baselineImages.current === null) baselineImages.current = signature;
  }, [open, imagesLoaded, signature]);

  useEffect(() => () => cancelAnimationFrame(previewFrame.current), []);

  const handleEditorInput = () => {
    if (previewFrame.current) return;
    previewFrame.current = requestAnimationFrame(() => {
      previewFrame.current = 0;
      setPreviewHtml(currentPost());
    });
  };

  const isDirty = () => {
    if (!travelDeal || !baseline.current) return false;
    return isDirtySnapshot(
      { ...baseline.current, images: baselineImages.current },
      { post: currentPost(), schedule: scheduleValue(), images: signature },
    );
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !isGenerating && isDirty()) {
      setConfirmDiscard(true);
      return;
    }
    onOpenChange(next);
  };

  const handleSaveDraft = async () => {
    if (!travelDeal) return;
    try {
      await savePost.mutateAsync({ id: travelDeal.id, data: { post: currentPost() } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save post";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      return;
    }
    toast({ title: "Draft saved" });
    onSavedDraft?.();
    onOpenChange(false);
  };

  const handleSaveAndSchedule = async () => {
    if (!travelDeal) return;
    if (!scheduleOn || !scheduleDate || !scheduleTime) {
      toast({ title: "Please select a schedule date and time", variant: "destructive" });
      return;
    }

    const currentHtml = currentPost();
    // Two representations of the same moment:
    //  - postScheduleLocal: the raw wall-clock the user picked. OnlySocials stores
    //    date/time verbatim (no timezone), so it must get this unconverted.
    //  - postScheduleUtc: the absolute UTC instant, stored in the DB so the
    //    dashboard's date filters and timezone-correct display work.
    const { local: postScheduleLocal, utcIso: postScheduleUtc } = combineLocal(scheduleDate, scheduleTime);
    // One ordered list goes to the server: the three multipart lists plus tokens that interleave them.
    // The server formats every selected image to 1080×1080 while scheduling.
    const upload = buildOrderedUpload(imageOrder);

    try {
      await savePost.mutateAsync({
        id: travelDeal.id,
        data: {
          post: currentHtml,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save post";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      return;
    }

    try {
      const formData = new FormData();
      formData.append("postSchedule", postScheduleUtc);
      formData.append("postScheduleLocal", postScheduleLocal);
      formData.append("existingImageIds", JSON.stringify(upload.existingIds));
      formData.append("imageUrls", JSON.stringify(upload.urls));
      formData.append("imageOrder", JSON.stringify(upload.tokens));
      upload.files.forEach((file) => formData.append("files", file));

      let result;
      if (isScheduled) {
        formData.append("postContent", currentHtml);
        result = await rescheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, formData });
      } else {
        result = await scheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, formData });
      }
      const failedImages = result.failedImageUrls ?? [];
      const formattedCount = result.autoUpscale?.upscaled.length ?? 0;
      const upscaledCount = result.autoUpscale?.upscaled.filter((i) => i.upscaled).length ?? 0;
      const atOriginalSize =
        result.autoUpscale?.skipped.filter((s) => s.reason === "failed" || s.reason === "timeout").length ?? 0;
      const originalSizeNote =
        atOriginalSize > 0
          ? `${atOriginalSize} image${atOriginalSize === 1 ? " was" : "s were"} posted at original size`
          : null;
      if (failedImages.length > 0) {
        toast({
          title: `Post ${isScheduled ? "rescheduled" : "scheduled"}, but ${failedImages.length} image${failedImages.length > 1 ? "s" : ""} failed to upload`,
          description: ["Reopen the post and reschedule to retry the missing images.", originalSizeNote]
            .filter(Boolean)
            .join("\n"),
          variant: "destructive",
        });
      } else {
        const done = isScheduled ? "Post updated and rescheduled on OnlySocials" : "Post saved and scheduled on OnlySocials";
        toast({
          title:
            formattedCount > 0
              ? `${isScheduled ? "Rescheduled" : "Scheduled"} · ${imagesLabel(formattedCount)} formatted (${upscaledCount} upscaled)`
              : done,
          description: [formattedCount > 0 ? done : null, originalSizeNote].filter(Boolean).join("\n") || undefined,
        });
      }
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to push to OnlySocials";
      toast({ title: "OnlySocials error", description: msg, variant: "destructive" });
    }
  };

  const familyMatch = /for a Family of (3|4)/.exec(previewHtml || travelDeal?.post || "");
  const priceLabel = travelDeal?.price
    ? familyMatch
      ? `From £${travelDeal.price} for a Family of ${familyMatch[1]}`
      : `From £${travelDeal.price} pp`
    : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="flex h-[min(92vh,952px)] max-w-[1260px] flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-2xl"
          data-testid="dialog-social-post-preview"
        >
          <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-6 py-4 pr-14">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Send className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-lg font-bold" data-testid="text-dialog-title">
                {isGenerating ? "Generating Post..." : "Social Post Editor"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                One post for both channels. Check each preview, pick a time, then schedule or save a draft.
              </DialogDescription>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isScheduled && (
                <div className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-700">
                  <Clock className="h-3.5 w-3.5" />
                  Scheduled
                </div>
              )}
            </div>
          </div>

          {isGenerating ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-5" data-testid="loading-generate-post">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/20" />
                <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-slate-900">
                  <Sparkles className="h-7 w-7 animate-pulse text-white" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-800">Generating your post...</p>
                <p className="mt-1 text-xs text-slate-400">Luna is writing your post</p>
              </div>
            </div>
          ) : travelDeal ? (
            <>
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
                <div className="shrink-0 border-b border-slate-200 bg-slate-50 p-5 md:w-[440px] md:overflow-y-auto md:border-b-0 md:border-r">
                  <PostPreviewPanel
                    previewHtml={previewHtml}
                    images={images.previewImages}
                    title={travelDeal.title}
                    pageName={pageName}
                    priceLabel={priceLabel}
                    showViewLink={viewLink}
                    showPriceBadge={priceBadge}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-4 p-6 md:overflow-y-auto">
                  <PostContentForm
                    postRef={postRef}
                    onEditorInput={handleEditorInput}
                    previewHtml={previewHtml}
                    onRegenerate={onRegenerate}
                  />
                  <FacebookOptionsCard
                    viewLink={viewLink}
                    onViewLinkChange={setViewLink}
                    priceBadge={priceBadge}
                    onPriceBadgeChange={setPriceBadge}
                  />
                  <PostImagesGrid
                    urlImages={images.urlImages}
                    pendingFileCount={images.pendingFiles.length}
                    imageOrder={imageOrder}
                    loadingUrlImages={images.loadingUrlImages}
                    selectedUrlCount={images.selectedUrlCount}
                    onToggleUrl={images.toggleUrlImage}
                    onMove={images.moveImage}
                    onInsert={images.insertImage}
                    onSetAllUrls={images.setAllUrlImages}
                    onFiles={images.handleFiles}
                    onRemove={images.removeImage}
                    onUrlSize={images.setUrlSourceSize}
                    onLocalSize={images.setLocalSourceSize}
                  />
                </div>
              </div>
              <PostEditorFooter
                scheduleOn={scheduleOn}
                onScheduleOnChange={setScheduleOn}
                date={scheduleDate}
                time={scheduleTime}
                onDateChange={setScheduleDate}
                onTimeChange={setScheduleTime}
                timeShortcuts={timeShortcuts}
                timezoneLabel={browserTimezoneLabel(timezoneLabel)}
                isScheduled={isScheduled}
                isBusy={isBusy}
                formatCount={formatCount}
                onSaveDraft={handleSaveDraft}
                onSchedule={handleSaveAndSchedule}
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>You have edits that have not been saved or scheduled.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onOpenChange(false);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
