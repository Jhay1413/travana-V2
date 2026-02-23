import { useState, useRef, useEffect } from "react";
import { Reorder } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  useSavePost,
  useScheduleOnOnlySocials,
  useRescheduleOnOnlySocials,
  useUploadMedia,
} from "@/hooks/mutations/use-social-post-mutations";
import { usePostMedia } from "@/hooks/queries/use-social-post-queries";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  CalendarClock,
  Sparkles,
  Hash,
  Type,
  PenLine,
  Check,
  Clock,
  ImagePlus,
  X,
  GripVertical,
} from "lucide-react";
import type { TravelDeal, UploadedMedia } from "@/api/endpoints/social-post.api";

interface SocialPostPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travelDeal: TravelDeal | null;
  quoteImageUrl: string | null;
  isGenerating: boolean;
}

export function SocialPostPreviewDialog({
  open,
  onOpenChange,
  travelDeal,
  quoteImageUrl,
  isGenerating,
}: SocialPostPreviewDialogProps) {
  const { toast } = useToast();
  const savePost = useSavePost();
  const scheduleOnOnlySocials = useScheduleOnOnlySocials();
  const rescheduleOnOnlySocials = useRescheduleOnOnlySocials();
  const uploadMedia = useUploadMedia();
  const postRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subtitle, setSubtitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [copied, setCopied] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedMedia[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const isScheduled = !!travelDeal?.onlySocialsId;
  const isBusy =
    savePost.isPending ||
    scheduleOnOnlySocials.isPending ||
    rescheduleOnOnlySocials.isPending ||
    uploadMedia.isPending;

  const { data: existingMedia } = usePostMedia(travelDeal?.id, open && isScheduled);

  useEffect(() => {
    if (travelDeal) {
      setSubtitle(travelDeal.subtitle || "");
      setHashtags((travelDeal.hashtags || []).join(" "));
      if (postRef.current) {
        postRef.current.innerHTML = travelDeal.post || "";
      }
      if (travelDeal.postSchedule) {
        const d = new Date(travelDeal.postSchedule);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, "0");
          setScheduleDate(
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          );
        } else {
          setScheduleDate("");
        }
      } else {
        setScheduleDate("");
      }
    }
  }, [travelDeal]);

  // Reset images when dialog closes
  useEffect(() => {
    if (!open) {
      setUploadedImages([]);
    }
  }, [open]);

  useEffect(() => {
    if (Array.isArray(existingMedia) && existingMedia.length > 0) {
      setUploadedImages(existingMedia);
    }
  }, [existingMedia]);

  const handleFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"].includes(f.type)
    );
    if (fileArray.length === 0) {
      toast({ title: "Unsupported file type", description: "Only images (JPEG, PNG, GIF, WebP) and MP4 are allowed.", variant: "destructive" });
      return;
    }
    try {
      const result = await uploadMedia.mutateAsync(fileArray);
      setUploadedImages((prev) => [...prev, ...result]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (id: number) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleSaveAndSchedule = async () => {
    if (!travelDeal) return;
    if (!scheduleDate) {
      toast({ title: "Please select a schedule date and time", variant: "destructive" });
      return;
    }

    const currentHtml = postRef.current?.innerHTML ?? "";
    const postScheduleIso = new Date(scheduleDate).toISOString();
    const imageIds = uploadedImages.map((img) => img.id);

    // Step 1: save content to DB
    try {
      await savePost.mutateAsync({
        id: travelDeal.id,
        data: {
          post: currentHtml,
          subtitle,
          hashtags: hashtags.split(/\s+/).filter((h) => h.startsWith("#")),
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save post";
      toast({ title: "Save failed", description: msg, variant: "destructive" });
      return;
    }

    // Step 2: push to OnlySocials
    try {
      if (isScheduled) {
        await rescheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, postSchedule: postScheduleIso });
        toast({ title: "Post updated and rescheduled on OnlySocials" });
      } else {
        await scheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, postSchedule: postScheduleIso, images: imageIds });
        toast({ title: "Post saved and scheduled on OnlySocials" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to push to OnlySocials";
      toast({ title: "OnlySocials error", description: msg, variant: "destructive" });
    }
  };

  const handleCopy = () => {
    const currentHtml = postRef.current?.innerHTML ?? "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = currentHtml;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    navigator.clipboard.writeText(plainText).then(() => {
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 shadow-2xl p-0"
        data-testid="dialog-social-post-preview"
      >
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold" data-testid="text-dialog-title">
                {isGenerating ? "Generating Post..." : "Social Post Editor"}
              </DialogTitle>
              <DialogDescription className="text-xs text-black/50 dark:text-white/50 mt-0.5">
                {isGenerating
                  ? "AI is crafting your travel post"
                  : isScheduled
                  ? "Post is scheduled on OnlySocials"
                  : "Edit your post, pick a time, then save & schedule"}
              </DialogDescription>
            </div>
            {isScheduled && (
              <div className="ml-auto flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full">
                <Clock className="w-3.5 h-3.5" />
                Scheduled
              </div>
            )}
          </div>
        </DialogHeader>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-24 gap-5" data-testid="loading-generate-post">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Sparkles className="w-7 h-7 text-white animate-pulse" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-black/80 dark:text-white/80">
                Generating your post...
              </p>
              <p className="text-xs text-black/40 dark:text-white/40 mt-1">
                AI is writing subtitle, resort summary & hashtags
              </p>
            </div>
          </div>
        ) : travelDeal ? (
          <div className="px-6 pb-6 pt-4">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* Left: live preview */}
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl overflow-hidden bg-white dark:bg-slate-800 shadow-lg border border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2.5 px-4 py-3 border-b border-black/5 dark:border-white/5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow">
                      AT
                    </div>
                    <div>
                      <p className="text-xs font-bold text-black/85 dark:text-white/85">Apple Travel</p>
                      <p className="text-[10px] text-black/40 dark:text-white/40">Just now</p>
                    </div>
                  </div>

                  <div className="relative aspect-[4/3] bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                    {uploadedImages.length > 0 ? (
                      <img
                        src={uploadedImages[0].thumb_url || uploadedImages[0].url}
                        alt={uploadedImages[0].name}
                        className="w-full h-full object-cover"
                      />
                    ) : quoteImageUrl ? (
                      <img
                        src={quoteImageUrl}
                        alt={travelDeal.title || "Post image"}
                        className="w-full h-full object-cover"
                        data-testid="img-post-preview"
                      />
                    ) : (
                      <img
                        src="/images/default-hotel.jpg"
                        alt="Default hotel"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {travelDeal.price && (
                      <div className="absolute bottom-3 right-3 bg-black/70 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full">
                        From £{travelDeal.price}pp
                      </div>
                    )}
                    {uploadedImages.length > 1 && (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold px-2 py-1 rounded-full">
                        +{uploadedImages.length - 1} more
                      </div>
                    )}
                  </div>

                  <div className="px-4 py-3 space-y-2">
                    <p className="text-xs font-bold text-black/85 dark:text-white/85 leading-snug">
                      {travelDeal.title}
                    </p>
                    {subtitle && (
                      <p className="text-[11px] text-black/55 dark:text-white/55 italic">{subtitle}</p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {hashtags
                        .split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 6)
                        .map((tag, i) => (
                          <span key={i} className="text-[10px] text-blue-500 dark:text-blue-400 font-medium">
                            {tag}
                          </span>
                        ))}
                      {hashtags.split(/\s+/).filter(Boolean).length > 6 && (
                        <span className="text-[10px] text-black/30 dark:text-white/30">
                          +{hashtags.split(/\s+/).filter(Boolean).length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <p className="text-[10px] text-center text-black/30 dark:text-white/25 uppercase tracking-widest font-medium">
                  Live Preview
                </p>
              </div>

              {/* Right: editor */}
              <div className="lg:col-span-3 space-y-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <Type className="w-3.5 h-3.5" />
                    Subtitle
                  </label>
                  <Input
                    value={subtitle}
                    onChange={(e) => !isScheduled && setSubtitle(e.target.value)}
                    readOnly={isScheduled}
                    placeholder="Catchy tagline for your post..."
                    className={`rounded-xl border-black/8 dark:border-white/8 shadow-sm transition-shadow ${isScheduled ? "bg-black/5 dark:bg-white/5 cursor-not-allowed text-black/50 dark:text-white/50" : "bg-white dark:bg-slate-800 focus:shadow-md"}`}
                    data-testid="input-subtitle"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <PenLine className="w-3.5 h-3.5" />
                    Post Content
                  </label>
                  <div
                    ref={postRef}
                    contentEditable={!isScheduled}
                    suppressContentEditableWarning
                    className={`min-h-[240px] max-h-[380px] overflow-y-auto rounded-xl px-4 py-3 text-[13px] leading-[1.7] border transition-shadow ${isScheduled ? "bg-black/5 dark:bg-white/5 cursor-not-allowed text-black/60 dark:text-white/60 border-black/8 dark:border-white/8" : "bg-white dark:bg-slate-800 border-black/8 dark:border-white/8 shadow-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30"}`}
                    data-testid="editor-post-content"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <Hash className="w-3.5 h-3.5" />
                    Hashtags
                  </label>
                  <Input
                    value={hashtags}
                    onChange={(e) => !isScheduled && setHashtags(e.target.value)}
                    readOnly={isScheduled}
                    placeholder="#TravelDeals #Holiday ..."
                    className={`rounded-xl border-black/8 dark:border-white/8 shadow-sm transition-shadow ${isScheduled ? "bg-black/5 dark:bg-white/5 cursor-not-allowed text-black/50 dark:text-white/50" : "bg-white dark:bg-slate-800 focus:shadow-md"}`}
                    data-testid="input-hashtags"
                  />
                </div>

                {/* Image upload section */}
                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Images
                    {uploadedImages.length > 0 && (
                      <span className="ml-auto text-[10px] text-black/40 dark:text-white/40 font-normal">
                        drag to reorder
                      </span>
                    )}
                  </label>

                  {/* Drop zone */}
                  <div
                    className={`relative rounded-xl border-2 border-dashed transition-colors cursor-pointer ${
                      isDraggingOver
                        ? "border-blue-400 bg-blue-50 dark:bg-blue-950/30"
                        : "border-black/10 dark:border-white/10 hover:border-black/20 dark:hover:border-white/20 bg-black/2 dark:bg-white/2"
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
                      className="hidden"
                      onChange={handleFileInputChange}
                    />
                    <div className="flex flex-col items-center justify-center py-4 gap-1.5 select-none">
                      {uploadMedia.isPending ? (
                        <Spinner className="w-5 h-5 text-blue-500" />
                      ) : (
                        <ImagePlus className="w-5 h-5 text-black/25 dark:text-white/25" />
                      )}
                      <p className="text-[11px] text-black/40 dark:text-white/40">
                        {uploadMedia.isPending ? "Uploading..." : "Click or drop images here"}
                      </p>
                    </div>
                  </div>

                  {/* Reorderable thumbnails */}
                  {uploadedImages.length > 0 && (
                    <Reorder.Group
                      axis="x"
                      values={uploadedImages}
                      onReorder={setUploadedImages}
                      className="flex gap-2 flex-wrap"
                    >
                      {uploadedImages.map((img) => (
                        <Reorder.Item key={img.id} value={img} className="relative group cursor-grab active:cursor-grabbing">
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-black/8 dark:border-white/8 shadow-sm bg-slate-100 dark:bg-slate-800">
                            <img
                              src={img.thumb_url || img.url}
                              alt={img.name}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          </div>
                          {/* Drag handle indicator */}
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3 text-white drop-shadow" />
                          </div>
                          {/* Remove button */}
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                </div>

                {/* Schedule date + combined save & schedule button */}
                <div className="rounded-xl bg-white dark:bg-slate-800 border border-black/6 dark:border-white/6 shadow-sm p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="w-4 h-4 text-orange-500" />
                    <span className="text-xs font-bold text-black/70 dark:text-white/70">
                      Schedule on OnlySocials
                    </span>
                    {isScheduled && (
                      <span className="ml-auto text-[10px] text-green-600 dark:text-green-400 font-semibold bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full">
                        Active
                      </span>
                    )}
                  </div>
                  <Input
                    type="datetime-local"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="rounded-xl bg-slate-50 dark:bg-slate-900 border-black/6 dark:border-white/6"
                    data-testid="input-schedule-date"
                  />
                  <div className="flex gap-3">
                    <Button
                      onClick={handleSaveAndSchedule}
                      disabled={isBusy || !scheduleDate}
                      className="flex-1 h-10 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-sm font-semibold gap-2 shadow-md shadow-orange-500/20 transition-all disabled:opacity-50"
                      data-testid="button-save-and-schedule"
                    >
                      {isBusy ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <Clock className="w-4 h-4" />
                      )}
                      {isScheduled ? "Save & Reschedule" : "Save & Schedule"}
                    </Button>
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      className="h-10 rounded-xl text-sm font-medium gap-2 border-black/8 dark:border-white/8 hover:bg-black/3 dark:hover:bg-white/5 transition-all"
                      data-testid="button-copy-post"
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                      {copied ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
