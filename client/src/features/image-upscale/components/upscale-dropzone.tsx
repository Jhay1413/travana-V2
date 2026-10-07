import { useRef, useState, type DragEvent } from "react";
import { ImagePlus, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { UPSCALE_ACCEPTED_TYPES, UPSCALE_MAX_BYTES } from "../types";

interface UpscaleDropzoneProps {
  file: File | null;
  previewUrl: string | null;
  pending: boolean;
  error: string | null;
  /** Called with a validated file, or null plus a rejection message. */
  onPick: (file: File | null, rejection?: string) => void;
  onUpscale: () => void;
  onReset: () => void;
}

function validate(file: File): string | null {
  if (!(UPSCALE_ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
    return "Unsupported file type — use a JPEG, PNG, WebP or GIF image.";
  }
  if (file.size > UPSCALE_MAX_BYTES) return "Image is larger than the 20MB limit.";
  return null;
}

export function UpscaleDropzone({ file, previewUrl, pending, error, onPick, onUpscale, onReset }: UpscaleDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleFile = (picked: File | undefined) => {
    if (!picked) return;
    const rejection = validate(picked);
    if (rejection) onPick(null, rejection);
    else onPick(picked);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    if (pending) return;
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <section className="rounded-2xl border border-black/10 bg-white/60 p-5">
      <input
        ref={inputRef}
        type="file"
        accept={UPSCALE_ACCEPTED_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {!file || !previewUrl ? (
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center transition ${
            dragging ? "border-black/40 bg-black/5" : "border-black/15 bg-black/[0.02] hover:bg-black/5"
          }`}
        >
          <ImagePlus className="h-6 w-6 text-black/40" />
          <p className="text-sm font-medium text-black/70">Drop an image here, or click to choose</p>
          <p className="text-xs text-black/45">JPEG, PNG, WebP or GIF · up to 20MB</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-center rounded-xl bg-neutral-900 p-2">
            <img src={previewUrl} alt="Original preview" className="max-h-80 w-auto max-w-full object-contain" />
          </div>
          <p className="truncate text-xs text-black/50">
            {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onUpscale}
              disabled={pending}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-black/80 px-4 py-2 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Upscale to 4K
            </button>
            <button
              type="button"
              onClick={onReset}
              disabled={pending}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm font-medium text-black/70 transition hover:bg-black/5 disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
            {pending && (
              <span className="flex items-center gap-1.5 text-xs text-black/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Upscaling… usually 5–20 seconds. You can leave this page; it keeps running.
              </span>
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-medium text-red-600">{error}</p>}
    </section>
  );
}
