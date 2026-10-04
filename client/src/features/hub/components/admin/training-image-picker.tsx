import { useEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { StagedSlide } from "@/features/hub/types/training-admin.types";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  /** True while a real upload triggered by this dropzone is in flight (persisted mode). */
  busy?: boolean;
  label?: string;
  hint?: string;
  testId?: string;
  /** Shorter padding, for use below an existing list. */
  compact?: boolean;
}

/**
 * Drag-and-drop (or click-to-pick) area for one or more images. Purely
 * presentational — the caller decides what happens with the picked files
 * (stage them locally, or upload immediately against a persisted lesson).
 */
export function ImageDropzone({ onFilesSelected, disabled, busy, label, hint, testId, compact }: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFiles = (fileList: FileList | null) => {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) onFilesSelected(files);
  };

  const interactive = !disabled && !busy;

  return (
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
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!interactive) return;
        handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-center transition-colors",
        compact ? "px-5 py-4" : "p-5",
        dragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10"
          : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
        !interactive && "cursor-not-allowed opacity-60",
      )}
      data-testid={testId ?? "image-dropzone"}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
        disabled={!interactive}
        className="hidden"
      />
      {busy ? (
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      ) : (
        <UploadCloud className="h-6 w-6 text-slate-400" />
      )}
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {busy ? "Uploading…" : (label ?? "Drag slides here or click to upload")}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500">
        {hint ?? "JPEG, PNG, WEBP or GIF — multiple allowed"}
      </p>
    </div>
  );
}

export interface ImageGridItem {
  key: string;
  url: string;
  onRemove: () => void;
  removing?: boolean;
  testId?: string;
  /** Optional header for the slide row (e.g. "Slide 1"). Only used in the row layout. */
  label?: string;
  /** Optional content rendered beside the thumbnail (e.g. a description field). Switches the grid to a vertical list of rows. */
  footer?: ReactNode;
}

/**
 * Thumbnail grid with a hover "X" to remove each image. When any item has a
 * `footer`, renders a vertical list of slide rows instead (thumbnail left,
 * header + remove button + footer right).
 */
export function LessonImageGrid({ items }: { items: ImageGridItem[] }) {
  if (items.length === 0) return null;
  const hasFooter = items.some((item) => item.footer);

  if (hasFooter) {
    return (
      <div className="space-y-3" data-testid="lesson-image-grid">
        {items.map((item, i) => {
          const n = i + 1;
          return (
            <div key={item.key} className="flex gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
              <img
                src={item.url}
                alt=""
                className="aspect-video w-40 shrink-0 self-start rounded-md object-cover sm:w-48"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {item.label ?? `Slide ${n}`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={item.onRemove}
                    disabled={item.removing}
                    aria-label={`Remove slide ${n}`}
                    className="h-7 w-7 text-slate-500 hover:text-red-600"
                    data-testid={item.testId ?? `button-remove-image-${item.key}`}
                  >
                    {item.removing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  </Button>
                </div>
                {item.footer}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" data-testid="lesson-image-grid">
      {items.map((item) => (
        <div
          key={item.key}
          className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800"
        >
          <img src={item.url} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={item.onRemove}
            disabled={item.removing}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-100"
            data-testid={item.testId ?? `button-remove-image-${item.key}`}
          >
            {item.removing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          </button>
        </div>
      ))}
    </div>
  );
}

interface GraphicsDropzoneProps {
  slides: StagedSlide[];
  onChange: (slides: StagedSlide[]) => void;
  disabled?: boolean;
}

/**
 * Multi-image picker for lessons that don't exist on the server yet (draft
 * course lessons, or a persisted lesson still mid-create). Files are held in
 * memory — `onChange` receives the full updated list. Each slide also carries
 * an editable description. Previews use `URL.createObjectURL`, cached per file,
 * and are revoked when their slide is removed or this component unmounts
 * (e.g. the dialog closes).
 */
export function GraphicsDropzone({ slides, onChange, disabled }: GraphicsDropzoneProps) {
  // Object URLs are cached per File so typing a description (which replaces
  // the slides array) doesn't regenerate every preview.
  const previewCache = useRef(new Map<File, string>());

  const getPreview = (file: File): string => {
    const cached = previewCache.current.get(file);
    if (cached) return cached;
    const url = URL.createObjectURL(file);
    previewCache.current.set(file, url);
    return url;
  };

  useEffect(() => {
    // Revoke previews of slides that were removed.
    const live = new Set(slides.map((slide) => slide.file));
    previewCache.current.forEach((url, file) => {
      if (!live.has(file)) {
        URL.revokeObjectURL(url);
        previewCache.current.delete(file);
      }
    });
  }, [slides]);

  useEffect(() => {
    const cache = previewCache.current;
    return () => {
      cache.forEach((url) => URL.revokeObjectURL(url));
      cache.clear();
    };
  }, []);

  const handleFilesSelected = (picked: File[]) => {
    onChange([...slides, ...picked.map((file) => ({ id: crypto.randomUUID(), file, caption: "" }))]);
  };

  const handleRemove = (index: number) => {
    onChange(slides.filter((_, i) => i !== index));
  };

  const handleCaptionChange = (index: number, caption: string) => {
    onChange(slides.map((slide, i) => (i === index ? { ...slide, caption } : slide)));
  };

  return (
    <div className="space-y-2" data-testid="graphics-dropzone">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Slides</p>
        {slides.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400" data-testid="text-graphics-count">
            {slides.length} {slides.length === 1 ? "slide" : "slides"}
          </span>
        )}
      </div>

      {slides.length === 0 ? (
        <ImageDropzone onFilesSelected={handleFilesSelected} disabled={disabled} testId="dropzone-lesson-graphics" />
      ) : (
        <>
          <LessonImageGrid
            items={slides.map((slide, i) => ({
              key: slide.id,
              url: getPreview(slide.file),
              onRemove: () => handleRemove(i),
              label: `Slide ${i + 1}`,
              footer: (
                <Textarea
                  value={slide.caption}
                  onChange={(e) => handleCaptionChange(i, e.target.value)}
                  placeholder="Slide description (optional)"
                  aria-label={`Slide ${i + 1} description`}
                  rows={3}
                  maxLength={2000}
                  disabled={disabled}
                  className="w-full text-sm"
                  data-testid={`input-slide-caption-${i}`}
                />
              ),
            }))}
          />
          <ImageDropzone
            onFilesSelected={handleFilesSelected}
            disabled={disabled}
            label="Add more slides"
            compact
            testId="dropzone-lesson-graphics-add"
          />
        </>
      )}
    </div>
  );
}
