import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { stepIndex } from "@/lib/photo-nav";

export interface PhotoViewerImage {
  url: string;
}

/**
 * Full-screen photo viewer (hotel / holiday photos).
 *
 * Props:
 * - images: photos to show, in order.
 * - open / onOpenChange: dialog visibility (Esc and the close button call onOpenChange(false)).
 * - index / onIndexChange: controlled current photo; arrow keys and thumbnails move it, wrapping at the ends.
 * - title: shown in the header as "{title} · Photo i of N · use the arrow keys to move".
 *
 * Sits above drawers (z-[600]). Animations are off for users who prefer reduced motion.
 */
export interface PhotoViewerProps {
  images: PhotoViewerImage[];
  open: boolean;
  index: number;
  title: string;
  onIndexChange: (index: number) => void;
  onOpenChange: (open: boolean) => void;
}

export function PhotoViewer({ images, open, index, title, onIndexChange, onOpenChange }: PhotoViewerProps) {
  const count = images.length;
  const current = images[Math.min(index, Math.max(count - 1, 0))];
  const activeThumb = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") onIndexChange(stepIndex(index, 1, count));
      else if (e.key === "ArrowLeft") onIndexChange(stepIndex(index, -1, count));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, count, onIndexChange]);

  useEffect(() => {
    if (open) activeThumb.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [open, index]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-qp-viewer-overlay/90 motion-reduce:animate-none"
        className={cn(
          "inset-0 z-[601] flex h-full max-w-none translate-x-0 translate-y-0 flex-col gap-3.5 rounded-none border-0 bg-transparent p-5 text-white shadow-none sm:rounded-none",
          "[&>button:last-child]:hidden",
          "data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0",
          "data-[state=open]:zoom-in-100 data-[state=closed]:zoom-out-100 motion-reduce:animate-none",
        )}
        data-testid="photo-viewer"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-base font-semibold text-white">{title}</DialogTitle>
            <DialogDescription className="text-[13px] text-qp-overlay-fg">
              Photo {count === 0 ? 0 : Math.min(index, count - 1) + 1} of {count} · use the arrow keys to move
            </DialogDescription>
          </div>
          <button
            type="button"
            aria-label="Close photos"
            onClick={() => onOpenChange(false)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-white/15 text-white transition hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl">
          {current ? <img src={current.url} alt={`${title}, photo ${Math.min(index, count - 1) + 1}`} className="max-h-full max-w-full object-contain" /> : null}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              ref={i === index ? activeThumb : undefined}
              type="button"
              aria-pressed={i === index}
              aria-label={`Photo ${i + 1}`}
              onClick={() => onIndexChange(i)}
              className={cn(
                "h-[70px] w-[110px] shrink-0 overflow-hidden rounded-[10px] border-[3px] border-transparent p-0",
                i === index && "border-social-orange",
              )}
            >
              <img src={img.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
