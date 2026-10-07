import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { UpscaleResult } from "../types";

export type UpscaleCompareResult = Pick<UpscaleResult, "url" | "width" | "height"> &
  Partial<Pick<UpscaleResult, "scale" | "sourceWidth" | "sourceHeight">>;

export interface UpscaleCompareProps {
  result: UpscaleCompareResult;
  originalUrl: string;
  originalName: string;
  /** When omitted, the "Start over" button is hidden. */
  onReset?: () => void;
}

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function downloadName(originalName: string, blobType: string): string {
  const base = originalName.replace(/\.[^.]+$/, "") || "image";
  return `${base}-4k.${EXT_BY_TYPE[blobType] ?? "jpg"}`;
}

export function UpscaleCompare({ result, originalUrl, originalName, onReset }: UpscaleCompareProps) {
  const { toast } = useToast();
  const [zoomed, setZoomed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const upscaledPane = useRef<HTMLDivElement>(null);
  const originalPane = useRef<HTMLDivElement>(null);

  // Zoomed: both images are laid out at the upscaled image's native pixel size
  // (the original is stretched to match), so both panes show the same region.
  // Start on the centre; fit mode resets to the top-left.
  useEffect(() => {
    for (const pane of [upscaledPane.current, originalPane.current]) {
      if (!pane) continue;
      pane.scrollLeft = zoomed ? (pane.scrollWidth - pane.clientWidth) / 2 : 0;
      pane.scrollTop = zoomed ? (pane.scrollHeight - pane.clientHeight) / 2 : 0;
    }
  }, [zoomed]);

  // Mirror scroll onto the other pane. Assigning an identical value fires no
  // scroll event, so the two handlers settle without a guard flag.
  const syncScroll = (from: HTMLDivElement, to: HTMLDivElement | null) => {
    if (!to) return;
    if (to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
    if (to.scrollTop !== from.scrollTop) to.scrollTop = from.scrollTop;
  };

  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(result.url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = downloadName(originalName, blob.type);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      toast({
        title: "Download failed",
        description: err instanceof Error ? err.message : "Could not download the image",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  const hasSize = !!result.width && !!result.height;
  const imgClass = zoomed ? "max-w-none shrink-0" : hasSize ? "h-full w-full object-contain" : "h-auto w-full object-contain";
  const imgStyle = zoomed && hasSize ? { width: result.width as number, height: result.height as number } : undefined;
  const paneClass = `rounded-xl bg-neutral-900 ${zoomed ? "overflow-auto" : "overflow-hidden"}`;
  const paneStyle = hasSize ? { aspectRatio: `${result.width} / ${result.height}` } : undefined;

  return (
    <section className="space-y-4 rounded-2xl border border-black/10 bg-white/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setZoomed((z) => !z)}
          className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5"
        >
          {zoomed ? <ZoomOut className="h-3.5 w-3.5" /> : <ZoomIn className="h-3.5 w-3.5" />}
          {zoomed ? "Actual pixels — click to fit" : "Fit — click for actual pixels"}
        </button>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* LEFT: upscaled */}
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-black/80">
            Upscaled{hasSize ? ` · ${result.width} × ${result.height}` : ""}{result.scale ? ` · ${result.scale}×` : ""}
          </h3>
          <div
            ref={upscaledPane}
            onScroll={(e) => syncScroll(e.currentTarget, originalPane.current)}
            className={paneClass}
            style={paneStyle}
          >
            <img src={result.url} alt="Upscaled" className={imgClass} style={imgStyle} draggable={false} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-black/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black disabled:opacity-60"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </button>
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Open full size
            </a>
          </div>
        </div>

        {/* RIGHT: original */}
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-semibold text-black/80">
            Original
            {result.sourceWidth && result.sourceHeight ? ` · ${result.sourceWidth} × ${result.sourceHeight}` : ""}
          </h3>
          <div
            ref={originalPane}
            onScroll={(e) => syncScroll(e.currentTarget, upscaledPane.current)}
            className={paneClass}
            style={paneStyle}
          >
            <img src={originalUrl} alt="Original" className={imgClass} style={imgStyle} draggable={false} />
          </div>
        </div>
      </div>
    </section>
  );
}
