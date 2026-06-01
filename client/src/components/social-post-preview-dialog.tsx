import { useState, useRef, useEffect, useMemo } from "react";
import { format, parse, isValid } from "date-fns";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import {
  useSavePost,
  useScheduleOnOnlySocials,
  useRescheduleOnOnlySocials,
} from "@/hooks/mutations/use-social-post-mutations";
import { usePostMedia } from "@/hooks/queries/use-social-post-queries";
import { useToast } from "@/hooks/use-toast";
import {
  Copy,
  CalendarClock,
  Calendar as CalendarIcon,
  Sparkles,
  Hash,
  Type,
  PenLine,
  Check,
  Clock,
  ImagePlus,
  GripVertical,
  X,
  Building2,
  TreePine,
  CheckCircle2,
  ArrowLeftRight,
  Car,
  Ticket,
  Coffee,
  ParkingSquare,
  Hotel,
  PackagePlus,
} from "lucide-react";
import type { TravelDeal, QuoteImageSource } from "@/api/endpoints/social-post.api";
import { socialPostApi } from "@/api/endpoints/social-post.api";
import { useQuote } from "@/hooks/queries";

interface LocalImage {
  localId: string;
  file: File;
  previewUrl: string;
}

interface ExistingImage {
  id: number;
  url: string;
  thumb_url: string;
  name: string;
}

interface UrlImage {
  url: string;
  name: string;
  source: string;
  selected: boolean;
}

type ImageItem =
  | { type: "existing"; data: ExistingImage; sortKey: string }
  | { type: "local"; data: LocalImage; sortKey: string }
  | { type: "url"; data: UrlImage; sortKey: string };

interface SocialPostPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travelDeal: TravelDeal | null;
  quoteImageUrl: string | null;
  isGenerating: boolean;
  quoteId?: string | null;
}

const sourceIcons: Record<string, typeof Building2> = {
  accommodation: Building2,
  lodge: TreePine,
  park: TreePine,
  cottage: TreePine,
};

const sourceLabels: Record<string, string> = {
  accommodation: "Accommodation",
  lodge: "Lodge",
  park: "Park",
  cottage: "Cottage",
  quote: "Quote",
};

export function SocialPostPreviewDialog({
  open,
  onOpenChange,
  travelDeal,
  quoteImageUrl,
  isGenerating,
  quoteId,
}: SocialPostPreviewDialogProps) {
  const { toast } = useToast();
  const savePost = useSavePost();
  const scheduleOnOnlySocials = useScheduleOnOnlySocials();
  const rescheduleOnOnlySocials = useRescheduleOnOnlySocials();
  const postRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [subtitle, setSubtitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<LocalImage[]>([]);
  const [urlImages, setUrlImages] = useState<UrlImage[]>([]);
  const [loadingUrlImages, setLoadingUrlImages] = useState(false);
  const [imageOrder, setImageOrder] = useState<ImageItem[]>([]);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [onlySocialsPostContent, setOnlySocialsPostContent] = useState("");

  const isScheduled = !!travelDeal?.onlySocialsId;
  const isBusy =
    savePost.isPending ||
    scheduleOnOnlySocials.isPending ||
    rescheduleOnOnlySocials.isPending;

  const { data: mediaData } = usePostMedia(travelDeal?.id, open && isScheduled);
  const { data: quoteData } = useQuote(quoteId ?? "");

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

  useEffect(() => {
    if (open && travelDeal && quoteId) {
      setLoadingUrlImages(true);
      socialPostApi.getQuoteImages(quoteId)
        .then((images) => {
          const mapped: UrlImage[] = images.map((img) => ({
            url: img.url,
            name: img.name,
            source: img.source,
            selected: true,
          }));
          setUrlImages(mapped);
        })
        .catch((err) => {
          console.error("Failed to load quote images:", err);
          setUrlImages([]);
        })
        .finally(() => setLoadingUrlImages(false));
    }
  }, [open, travelDeal, quoteId]);

  useEffect(() => {
    if (!open) {
      setExistingImages([]);
      setPendingFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return [];
      });
      setUrlImages([]);
      setImageOrder([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && mediaData) {
      const mediaArr = Array.isArray(mediaData.media) ? mediaData.media : [];
      if (mediaArr.length > 0) {
        setExistingImages(mediaArr as ExistingImage[]);
      }
      if (mediaData.postContent) {
        setOnlySocialsPostContent(mediaData.postContent);
      }
    }
  }, [open, mediaData]);

  useEffect(() => {
    const items: ImageItem[] = [
      ...existingImages.map((img): ImageItem => ({
        type: "existing",
        data: img,
        sortKey: `ex-${img.id}`,
      })),
      ...urlImages.filter(img => img.selected).map((img, i): ImageItem => ({
        type: "url",
        data: img,
        sortKey: `url-${i}-${img.url.slice(-20)}`,
      })),
      ...pendingFiles.map((img): ImageItem => ({
        type: "local",
        data: img,
        sortKey: `loc-${img.localId}`,
      })),
    ];
    setImageOrder(items);
  }, [existingImages, pendingFiles, urlImages]);

  const toggleUrlImage = (url: string) => {
    setUrlImages(prev => prev.map(img =>
      img.url === url ? { ...img, selected: !img.selected } : img
    ));
  };

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"].includes(f.type)
    );
    if (fileArray.length === 0) {
      toast({ title: "Unsupported file type", description: "Only images (JPEG, PNG, GIF, WebP) and MP4 are allowed.", variant: "destructive" });
      return;
    }
    const newLocal: LocalImage[] = fileArray.map((file) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingFiles((prev) => [...prev, ...newLocal]);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeImage = (sortKey: string) => {
    const item = imageOrder.find((i) => i.sortKey === sortKey);
    if (!item) return;
    if (item.type === "existing") {
      setExistingImages((prev) => prev.filter((img) => img.id !== item.data.id));
    } else if (item.type === "local") {
      URL.revokeObjectURL(item.data.previewUrl);
      setPendingFiles((prev) => prev.filter((img) => img.localId !== item.data.localId));
    } else if (item.type === "url") {
      toggleUrlImage(item.data.url);
    }
  };

  const previewImage = useMemo(() => {
    if (imageOrder.length > 0) {
      const first = imageOrder[0];
      if (first.type === "existing") return first.data.thumb_url || first.data.url;
      if (first.type === "url") return first.data.url;
      return first.data.previewUrl;
    }
    return quoteImageUrl;
  }, [imageOrder, quoteImageUrl]);

  const selectedUrlCount = urlImages.filter(img => img.selected).length;

  const handleSaveAndSchedule = async () => {
    if (!travelDeal) return;
    if (!scheduleDate) {
      toast({ title: "Please select a schedule date and time", variant: "destructive" });
      return;
    }

    const currentHtml = postRef.current?.innerHTML ?? "";
    // Two representations of the same moment:
    //  - postScheduleLocal: the raw wall-clock the user picked. OnlySocials stores
    //    date/time verbatim (no timezone), so it must get this unconverted.
    //  - postScheduleUtc: the absolute UTC instant, stored in the DB so the
    //    dashboard's date filters and timezone-correct display work.
    const postScheduleLocal = scheduleDate;
    const postScheduleUtc = new Date(scheduleDate).toISOString();
    const existingIds = imageOrder
      .filter((i) => i.type === "existing")
      .map((i) => (i.data as ExistingImage).id);
    const newFiles = imageOrder
      .filter((i) => i.type === "local")
      .map((i) => (i.data as LocalImage).file);
    const selectedUrls = imageOrder
      .filter((i) => i.type === "url")
      .map((i) => (i.data as UrlImage).url);

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

    try {
      const formData = new FormData();
      formData.append("postSchedule", postScheduleUtc);
      formData.append("postScheduleLocal", postScheduleLocal);
      formData.append("existingImageIds", JSON.stringify(existingIds));
      formData.append("imageUrls", JSON.stringify(selectedUrls));
      newFiles.forEach((file) => formData.append("files", file));

      if (isScheduled) {
        formData.append("postContent", onlySocialsPostContent || currentHtml);
        await rescheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, formData });
        toast({ title: "Post updated and rescheduled on OnlySocials" });
      } else {
        await scheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, formData });
        toast({ title: "Post saved and scheduled on OnlySocials" });
      }
      onOpenChange(false);
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
                    {previewImage ? (
                      <img
                        src={previewImage}
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
                        From &pound;{travelDeal.price}pp
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

              <div className="lg:col-span-3 space-y-4">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <Type className="w-3.5 h-3.5" />
                    Subtitle
                  </label>
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="Catchy tagline for your post..."
                    className="rounded-xl bg-white dark:bg-slate-800 border-black/8 dark:border-white/8 shadow-sm focus:shadow-md transition-shadow"
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
                    contentEditable
                    suppressContentEditableWarning
                    className="min-h-[240px] max-h-[380px] overflow-y-auto rounded-xl px-4 py-3 text-[13px] leading-[1.7] bg-white dark:bg-slate-800 border border-black/8 dark:border-white/8 shadow-sm focus:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-shadow"
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
                    onChange={(e) => setHashtags(e.target.value)}
                    placeholder="#TravelDeals #Holiday ..."
                    className="rounded-xl bg-white dark:bg-slate-800 border-black/8 dark:border-white/8 shadow-sm focus:shadow-md transition-shadow"
                    data-testid="input-hashtags"
                  />
                </div>

                {urlImages.length > 0 && (
                  <div className="space-y-2" data-testid="section-accommodation-images">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                      <Building2 className="w-3.5 h-3.5" />
                      Accommodation / Lodge Images
                      <span className="ml-auto text-[10px] text-black/40 dark:text-white/40 font-normal">
                        {selectedUrlCount} of {urlImages.length} selected
                      </span>
                    </label>
                    <p className="text-[10px] text-black/40 dark:text-white/40">
                      Click to select/deselect images to include with your post. Selected images will be downloaded and uploaded to OnlySocials when scheduling.
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {urlImages.map((img, i) => {
                        const SourceIcon = sourceIcons[img.source] || Building2;
                        return (
                          <button
                            key={`url-img-${i}`}
                            onClick={() => toggleUrlImage(img.url)}
                            className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-square ${
                              img.selected
                                ? "border-green-500 shadow-md shadow-green-500/20 ring-1 ring-green-500/30"
                                : "border-black/10 dark:border-white/10 opacity-50 hover:opacity-75"
                            }`}
                            data-testid={`button-toggle-url-image-${i}`}
                          >
                            <img
                              src={img.url}
                              alt={img.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = "/images/default-hotel.jpg";
                              }}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            {img.selected && (
                              <div className="absolute top-1 right-1">
                                <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-lg" />
                              </div>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1">
                              <div className="flex items-center gap-1">
                                <SourceIcon className="w-2.5 h-2.5 text-white/80 shrink-0" />
                                <span className="text-[8px] text-white/90 font-medium truncate">
                                  {sourceLabels[img.source] || img.source}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setUrlImages(prev => prev.map(img => ({ ...img, selected: true })))}
                        className="text-[10px] text-blue-500 hover:text-blue-600 font-medium"
                        data-testid="button-select-all-url-images"
                      >
                        Select All
                      </button>
                      <span className="text-[10px] text-black/20 dark:text-white/20">|</span>
                      <button
                        onClick={() => setUrlImages(prev => prev.map(img => ({ ...img, selected: false })))}
                        className="text-[10px] text-red-500 hover:text-red-600 font-medium"
                        data-testid="button-deselect-all-url-images"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>
                )}

                {loadingUrlImages && (
                  <div className="flex items-center gap-2 py-2">
                    <Spinner className="w-4 h-4" />
                    <span className="text-xs text-black/50 dark:text-white/50">Loading accommodation images...</span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-black/55 dark:text-white/55">
                    <ImagePlus className="w-3.5 h-3.5" />
                    Additional Images
                    {imageOrder.length > 0 && (
                      <span className="ml-auto text-[10px] text-black/40 dark:text-white/40 font-normal">
                        drag to reorder
                      </span>
                    )}
                    {pendingFiles.length > 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-normal ml-1">
                        ({pendingFiles.length} new - will upload on save)
                      </span>
                    )}
                  </label>

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
                      <ImagePlus className="w-5 h-5 text-black/25 dark:text-white/25" />
                      <p className="text-[11px] text-black/40 dark:text-white/40">
                        Click or drop images here
                      </p>
                    </div>
                  </div>

                  {imageOrder.filter(i => i.type !== "url").length > 0 && (
                    <Reorder.Group
                      axis="x"
                      values={imageOrder.filter(i => i.type !== "url")}
                      onReorder={(newOrder) => {
                        const urlItems = imageOrder.filter(i => i.type === "url");
                        setImageOrder([...urlItems, ...newOrder]);
                      }}
                      className="flex gap-2 flex-wrap"
                    >
                      {imageOrder.filter(i => i.type !== "url").map((item) => (
                        <Reorder.Item key={item.sortKey} value={item} className="relative group cursor-grab active:cursor-grabbing">
                          <div className={`w-16 h-16 rounded-lg overflow-hidden border shadow-sm bg-slate-100 dark:bg-slate-800 ${item.type === "local" ? "border-amber-400 dark:border-amber-500" : "border-black/8 dark:border-white/8"}`}>
                            <img
                              src={item.type === "existing" ? (item.data.thumb_url || item.data.url) : item.data.previewUrl}
                              alt={item.type === "existing" ? item.data.name : item.data.file.name}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                          </div>
                          <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <GripVertical className="w-3 h-3 text-white drop-shadow" />
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeImage(item.sortKey); }}
                            className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </Reorder.Item>
                      ))}
                    </Reorder.Group>
                  )}
                </div>

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
                  {selectedUrlCount > 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      {selectedUrlCount} accommodation image{selectedUrlCount > 1 ? "s" : ""} will be downloaded and uploaded to OnlySocials
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="datetime-local"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="rounded-xl bg-slate-50 dark:bg-slate-900 border-black/6 dark:border-white/6 flex-1"
                      data-testid="input-schedule-date"
                    />
                    <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 rounded-xl border-black/6 dark:border-white/6 bg-slate-50 dark:bg-slate-900 shrink-0"
                          data-testid="button-calendar-picker"
                        >
                          <CalendarIcon className="h-4 w-4 text-orange-500" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]" align="end">
                        <Calendar
                          mode="single"
                          selected={scheduleDate ? (() => { const d = new Date(scheduleDate); return isValid(d) ? d : undefined; })() : undefined}
                          onSelect={(day) => {
                            if (!day) return;
                            const timeMatch = scheduleDate.match(/T(\d{2}:\d{2})/);
                            const time = timeMatch ? timeMatch[1] : "09:00";
                            const pad = (n: number) => String(n).padStart(2, "0");
                            setScheduleDate(
                              `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${time}`
                            );
                            setCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
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
                      {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      {copied ? "Copied" : "Copy"}
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
