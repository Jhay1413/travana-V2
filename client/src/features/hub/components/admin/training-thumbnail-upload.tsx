import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ImagePlus, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { uploadImageToS3 } from "@/features/hub/api/training.api";
import { useToast } from "@/hooks/use-toast";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

interface TrainingThumbnailUploadProps {
  /** Current course `thumbnail_url`, or null/empty if none uploaded yet. */
  thumbnailUrl: string | null;
  /** Called with the stored proxy URL after a successful upload. */
  onUploaded: (url: string) => void;
  /** Called when the user clears the current thumbnail. */
  onRemove: () => void;
  disabled?: boolean;
}

/**
 * Presigned direct-to-S3 course-thumbnail image upload — the image sibling of
 * `TrainingVideoUpload`. Single PUT (not resumable), so we warn via
 * `beforeunload` while a PUT is in flight. Three states: idle dropzone,
 * in-progress bar, and success (inline `<img>` preview + Replace / Remove).
 */
export function TrainingThumbnailUpload({
  thumbnailUrl,
  onUploaded,
  onRemove,
  disabled,
}: TrainingThumbnailUploadProps) {
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
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        title: "Image too large",
        description: "Please choose an image under 5MB.",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const { playbackUrl } = await uploadImageToS3(file, setProgress);
      onUploaded(playbackUrl);
      toast({ title: "Thumbnail uploaded" });
    } catch {
      toast({ title: "Thumbnail upload failed", description: "Please try again.", variant: "destructive" });
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

  const isIdle = !thumbnailUrl && !uploading;

  return (
    <div className="space-y-2" data-testid="training-thumbnail-upload">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        onChange={handleFileChange}
        disabled={!interactive}
        className="hidden"
        data-testid="input-course-thumbnail-file"
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
          data-testid="dropzone-course-thumbnail"
        >
          <UploadCloud className="h-7 w-7 text-slate-400" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Drag an image here or click to upload
          </p>
          <p className="text-[11px] text-slate-400 dark:text-slate-500">JPG, PNG, WebP or GIF · up to 5MB</p>
        </div>
      )}

      {uploading && (
        <div className="space-y-2 rounded-lg border-2 border-dashed border-blue-200 p-6 text-center dark:border-blue-900">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-blue-500" />
          <Progress value={progress} className="h-2" data-testid="progress-course-thumbnail-upload" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {progress}% uploaded — do not refresh or navigate away.
          </p>
        </div>
      )}

      {thumbnailUrl && !uploading && (
        <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="relative overflow-hidden rounded-md">
            <img
              src={thumbnailUrl}
              alt="Course thumbnail preview"
              className="aspect-video w-full rounded-md bg-slate-100 object-cover dark:bg-slate-800"
              data-testid="img-course-thumbnail-preview"
            />
          </div>
          <div className="flex items-center justify-between">
            <span
              className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"
              data-testid="text-thumbnail-ready"
            >
              <CheckCircle2 className="h-4 w-4" /> Thumbnail ready
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                data-testid="button-course-thumbnail-replace"
              >
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" /> Replace
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onRemove}
                className="text-red-600 hover:text-red-700 dark:text-red-400"
                data-testid="button-course-thumbnail-remove"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
