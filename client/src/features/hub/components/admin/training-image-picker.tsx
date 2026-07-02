import { useEffect, useRef, useState } from "react";
import { Loader2, UploadCloud, X } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif";

interface ImageDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  /** True while a real upload triggered by this dropzone is in flight (persisted mode). */
  busy?: boolean;
  label?: string;
  hint?: string;
  testId?: string;
}

/**
 * Drag-and-drop (or click-to-pick) area for one or more images. Purely
 * presentational — the caller decides what happens with the picked files
 * (stage them locally, or upload immediately against a persisted lesson).
 */
export function ImageDropzone({ onFilesSelected, disabled, busy, label, hint, testId }: ImageDropzoneProps) {
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
        "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed p-5 text-center transition-colors",
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
        {busy ? "Uploading…" : (label ?? "Drag images here or click to upload")}
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
}

/** Responsive thumbnail grid with a hover "X" to remove each image. */
export function LessonImageGrid({ items }: { items: ImageGridItem[] }) {
  if (items.length === 0) return null;
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
  files: File[];
  onChange: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Multi-image picker for lessons that don't exist on the server yet (draft
 * course lessons, or a persisted lesson still mid-create). Files are held in
 * memory — `onChange` receives the full updated list — and previews are
 * generated with `URL.createObjectURL`, revoked whenever the file list
 * changes or this component unmounts (e.g. the dialog closes).
 */
export function GraphicsDropzone({ files, onChange, disabled }: GraphicsDropzoneProps) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  const handleFilesSelected = (picked: File[]) => {
    onChange([...files, ...picked]);
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2" data-testid="graphics-dropzone">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Images</p>
        {files.length > 0 && (
          <span className="text-xs text-slate-500 dark:text-slate-400" data-testid="text-graphics-count">
            {files.length} selected
          </span>
        )}
      </div>

      {files.length === 0 ? (
        <ImageDropzone onFilesSelected={handleFilesSelected} disabled={disabled} testId="dropzone-lesson-graphics" />
      ) : (
        <>
          <LessonImageGrid
            items={files.map((file, i) => ({
              key: `${file.name}-${file.size}-${i}`,
              url: previews[i] ?? "",
              onRemove: () => handleRemove(i),
            }))}
          />
          <ImageDropzone
            onFilesSelected={handleFilesSelected}
            disabled={disabled}
            label="Add more images"
            testId="dropzone-lesson-graphics-add"
          />
        </>
      )}
    </div>
  );
}
