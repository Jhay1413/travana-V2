import { useState, useRef, useEffect } from "react";
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
} from "@/hooks/mutations/use-social-post-mutations";
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
} from "lucide-react";
import type { TravelDeal } from "@/api/endpoints/social-post.api";

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
  const postRef = useRef<HTMLDivElement>(null);
  const [subtitle, setSubtitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [copied, setCopied] = useState(false);

  const isScheduled = !!travelDeal?.onlySocialsId;
  const isBusy = savePost.isPending || scheduleOnOnlySocials.isPending || rescheduleOnOnlySocials.isPending;

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

  const handleSaveAndSchedule = async () => {
    if (!travelDeal) return;
    if (!scheduleDate) {
      toast({ title: "Please select a schedule date and time", variant: "destructive" });
      return;
    }

    const currentHtml = postRef.current?.innerHTML ?? "";
    const postScheduleIso = new Date(scheduleDate).toISOString();

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
        await scheduleOnOnlySocials.mutateAsync({ id: travelDeal.id, postSchedule: postScheduleIso });
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
                    {quoteImageUrl ? (
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
