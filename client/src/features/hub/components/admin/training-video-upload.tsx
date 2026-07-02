import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { uploadVideoToS3 } from "@/features/hub/api/training.api";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_VIDEO_TYPES = "video/mp4,video/webm,video/quicktime";

interface TrainingVideoUploadProps {
  /** Current lesson `video_url` (playback URL), or null if none uploaded yet. */
  videoUrl: string | null;
  onUploaded: (result: { playbackUrl: string; key: string }) => void;
  disabled?: boolean;
}

/**
 * Presigned direct-to-S3 video upload widget (Option A — single PUT, not
 * resumable; see docs/training-lms-plan.md §5). A refresh/navigate-away mid
 * upload aborts the PUT and S3 discards the partial object, so we warn via
 * `beforeunload` while a PUT is in flight and disable navigation triggers on
 * this widget for the duration.
 *
 * Presented as a drag-and-drop dropzone with three states: idle (pick/drop),
 * in-progress (progress bar), and success (inline `<video>` preview + Replace).
 */
export function TrainingVideoUpload({ videoUrl, onUploaded, disabled }: TrainingVideoUploadProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Upload in progress — leave anyway?";
      return e.returnValue;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const processFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadVideoToS3(file, setProgress);
      onUploaded(result);
      toast({ title: "Video uploaded" });
    } catch {
      toast({ title: "Video upload failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const interactive = !disabled && !uploading;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (!interactive) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const isIdle = !videoUrl && !uploading;

  return (
    <div className="space-y-2" data-testid="training-video-upload">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_VIDEO_TYPES}
        onChange={handleFileChange}
        disabled={!interactive}
        className="hidden"
        data-testid="input-training-video-file"
      />

      {isIdle && (
        <div
          role="button"
          tabIndex={interactive ? 0 : -1}
          onClick={() => interactive && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (interactive && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (interactive) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
            dragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
              : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
            !interactive && "cursor-not-allowed opacity-60",
          )}
          data-testid="dropzone-training-video"
        >
          <UploadCloud className="h-7 w-7 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Drag a video here or click to upload
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">MP4, WebM or MOV</p>
        </div>
      )}

      {uploading && (
        <div className="space-y-2 rounded-lg border-2 border-dashed border-blue-200 p-6 text-center dark:border-blue-900">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
          <Progress value={progress} className="h-2" data-testid="progress-training-video-upload" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {progress}% uploaded — do not refresh or navigate away.
          </p>
        </div>
      )}

      {videoUrl && !uploading && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={videoUrl}
            controls
            className="max-h-48 w-full rounded-md bg-black"
            data-testid="video-training-preview"
          />
          <div className="flex items-center justify-between">
            <span
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              data-testid="text-video-ready"
            >
              <CheckCircle2 className="h-4 w-4" /> Video ready
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              data-testid="button-training-video-replace"
            >
              Replace
            </Button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        Note: refreshing mid-upload cancels it — this is a single direct-to-S3 upload and isn't resumable.
      </p>
    </div>
  );
}
