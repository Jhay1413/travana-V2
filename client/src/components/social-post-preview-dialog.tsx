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
import { useSchedulePost } from "@/hooks/mutations/use-social-post-mutations";
import { useToast } from "@/hooks/use-toast";
import { Copy, Save, CalendarClock } from "lucide-react";
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
  const schedulePost = useSchedulePost();
  const postRef = useRef<HTMLDivElement>(null);
  const [subtitle, setSubtitle] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [postHtml, setPostHtml] = useState("");

  useEffect(() => {
    if (travelDeal) {
      setSubtitle(travelDeal.subtitle || "");
      setHashtags((travelDeal.hashtags || []).join(" "));
      setPostHtml(travelDeal.post || "");
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

  const handleSave = async () => {
    if (!travelDeal) return;

    const currentHtml = postRef.current?.innerHTML || postHtml;

    try {
      await schedulePost.mutateAsync({
        id: travelDeal.id,
        data: {
          post: currentHtml,
          subtitle,
          hashtags: hashtags.split(/\s+/).filter((h) => h.startsWith("#")),
          postSchedule: scheduleDate ? new Date(scheduleDate).toISOString() : null,
        },
      });
      toast({ title: "Post saved successfully" });
    } catch {
      toast({ title: "Failed to save post", variant: "destructive" });
    }
  };

  const handleCopy = () => {
    const currentHtml = postRef.current?.innerHTML || postHtml;
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = currentHtml;
    const plainText = tempDiv.textContent || tempDiv.innerText || "";
    navigator.clipboard.writeText(plainText).then(() => {
      toast({ title: "Copied to clipboard" });
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white/70 dark:bg-black/70 backdrop-blur-xl border-black/10 dark:border-white/10"
        data-testid="dialog-social-post-preview"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold" data-testid="text-dialog-title">
            {isGenerating ? "Generating Post..." : "Social Post Preview"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Preview and edit your social media post
          </DialogDescription>
        </DialogHeader>

        {isGenerating ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4" data-testid="loading-generate-post">
            <Spinner className="w-10 h-10" />
            <p className="text-sm text-black/60 dark:text-white/60 font-medium">
              Generating your post...
            </p>
          </div>
        ) : travelDeal ? (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row gap-5">
              <div className="md:w-2/5 shrink-0">
                <div className="rounded-2xl overflow-hidden bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 border border-black/10 dark:border-white/10">
                  {quoteImageUrl ? (
                    <img
                      src={quoteImageUrl}
                      alt={travelDeal.title || "Post image"}
                      className="w-full h-auto object-cover"
                      data-testid="img-post-preview"
                    />
                  ) : (
                    <img
                      src="/images/default-hotel.jpg"
                      alt="Default hotel"
                      className="w-full h-auto object-cover"
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60 mb-1 block">
                    Subtitle
                  </label>
                  <Input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                    data-testid="input-subtitle"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60 mb-1 block">
                    Post Content
                  </label>
                  <div
                    ref={postRef}
                    contentEditable
                    suppressContentEditableWarning
                    dangerouslySetInnerHTML={{ __html: postHtml }}
                    onInput={() => {
                      if (postRef.current) {
                        setPostHtml(postRef.current.innerHTML);
                      }
                    }}
                    className="min-h-[200px] max-h-[400px] overflow-y-auto rounded-xl p-4 text-sm leading-relaxed bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    data-testid="editor-post-content"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-black/60 dark:text-white/60 mb-1 block">
                    Hashtags
                  </label>
                  <Input
                    value={hashtags}
                    onChange={(e) => setHashtags(e.target.value)}
                    className="rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                    data-testid="input-hashtags"
                  />
                </div>
              </div>
            </div>

            <div className="glass ringed grain rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-black/50 dark:text-white/50" />
                <span className="text-xs font-semibold text-black/60 dark:text-white/60">
                  Schedule Post
                </span>
              </div>
              <Input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="rounded-xl bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10"
                data-testid="input-schedule-date"
              />
              <div className="flex gap-3">
                <Button
                  onClick={handleSave}
                  disabled={schedulePost.isPending}
                  className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium gap-2"
                  data-testid="button-save-post"
                >
                  {schedulePost.isPending ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save Changes
                </Button>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="rounded-xl text-sm font-medium gap-2"
                  data-testid="button-copy-post"
                >
                  <Copy className="w-4 h-4" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
