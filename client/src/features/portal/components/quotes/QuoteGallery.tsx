import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortalOverlayContainer } from "../../theme/PortalThemeProvider";
import { portalButtonClass } from "../brand";

export interface GalleryImage {
  id: string;
  url: string;
}

/** What is open: nothing, the grid of every photo, or one photo full screen. */
export type GalleryView = { kind: "closed" } | { kind: "grid" } | { kind: "viewer"; index: number };

export const GALLERY_CLOSED: GalleryView = { kind: "closed" };

const altFor = (title: string, index: number, total: number) => `${title}, photo ${index + 1} of ${total}`;

/** Photos in a row (the first four and a "+N" tile) with a button for the full gallery. */
export function QuotePhotoStrip({
  images,
  title,
  onOpen,
}: {
  images: GalleryImage[];
  title: string;
  onOpen: (view: GalleryView) => void;
}) {
  if (images.length === 0) return null;
  const shown = images.slice(0, 4);
  const extra = images.length - shown.length;
  return (
    <section aria-label="Photos" className="mx-auto flex max-w-3xl flex-col gap-3.5 pt-7" data-testid="quote-photos">
      <div className="flex gap-2 overflow-x-auto px-6 [scrollbar-width:none]">
        {shown.map((img, i) => {
          const last = i === shown.length - 1 && extra > 0;
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onOpen(last ? { kind: "grid" } : { kind: "viewer", index: i })}
              aria-label={last ? `See all ${images.length} photos` : `Open photo ${i + 1} of ${images.length}`}
              className="relative h-[150px] w-[118px] flex-none cursor-zoom-in overflow-hidden bg-[hsl(var(--portal-navy-deep))] md:h-[180px] md:w-[140px]"
              data-testid={`quote-photo-${i}`}
            >
              <img src={img.url} alt="" loading="lazy" className="size-full object-cover" />
              {last && (
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-[hsl(var(--portal-navy-deep)/0.6)] text-white">
                  <span className="portal-serif text-[28px]">+{extra + 1}</span>
                  <span className="text-[11px] uppercase tracking-[0.2em]">Photos</span>
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="px-6">
        <button type="button" onClick={() => onOpen({ kind: "grid" })} className={portalButtonClass("outline", "w-full")} data-testid="button-view-all-photos">
          View all {images.length} photo{images.length === 1 ? "" : "s"}
        </button>
      </div>
    </section>
  );
}

/** The full gallery (a grid) and the full-screen viewer, both inside the portal wrapper. */
export function QuoteGallery({
  images,
  title,
  view,
  onViewChange,
}: {
  images: GalleryImage[];
  title: string;
  view: GalleryView;
  onViewChange: (view: GalleryView) => void;
}) {
  const container = usePortalOverlayContainer();
  const close = () => onViewChange(GALLERY_CLOSED);
  return (
    <>
      <DialogPrimitive.Root open={view.kind === "grid"} onOpenChange={(o) => !o && close()}>
        <DialogPrimitive.Portal container={container ?? undefined}>
          <DialogPrimitive.Content
            className="fixed inset-0 z-[62] overflow-y-auto bg-background text-foreground focus:outline-none"
            data-testid="quote-gallery"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-6">
              <DialogPrimitive.Close className="inline-flex min-h-12 items-center text-[11px] font-medium uppercase tracking-[0.2em] text-primary" data-testid="gallery-back">
                ← Back
              </DialogPrimitive.Close>
              <span className="portal-caps-label">{images.length} photos</span>
            </div>
            <div className="mx-auto max-w-3xl px-6 pb-12 pt-9">
              <p className="portal-eyebrow">The gallery</p>
              <DialogPrimitive.Title className="portal-serif mt-3 text-[34px] font-light leading-[1.1] text-primary">{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description className="mb-6 mt-2 text-[15px] text-muted-foreground">Tap any photo to see it full screen.</DialogPrimitive.Description>
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => onViewChange({ kind: "viewer", index: i })}
                    aria-label={`Open photo ${i + 1} of ${images.length}`}
                    className={cn(
                      "relative cursor-zoom-in overflow-hidden bg-[hsl(var(--portal-navy-deep))]",
                      i % 5 === 0 ? "col-span-2 h-[250px] md:col-span-3 md:h-[360px]" : "h-[170px] md:h-[220px]",
                    )}
                    data-testid={`gallery-photo-${i}`}
                  >
                    <img src={img.url} alt={altFor(title, i, images.length)} loading="lazy" className="size-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <DialogPrimitive.Root open={view.kind === "viewer"} onOpenChange={(o) => !o && close()}>
        <DialogPrimitive.Portal container={container ?? undefined}>
          {view.kind === "viewer" && <PhotoViewer images={images} title={title} index={view.index} onViewChange={onViewChange} />}
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}

const SWIPE_PX = 50;

function PhotoViewer({
  images,
  title,
  index,
  onViewChange,
}: {
  images: GalleryImage[];
  title: string;
  index: number;
  onViewChange: (view: GalleryView) => void;
}) {
  const total = images.length;
  const current = images[((index % total) + total) % total];
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [announce, setAnnounce] = useState("");

  const go = (delta: number) => onViewChange({ kind: "viewer", index: (index + delta + total) % total });

  useEffect(() => {
    stripRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
    setAnnounce(`Photo ${index + 1} of ${total}`);
  }, [index, total]);

  return (
    <DialogPrimitive.Content
      className="fixed inset-0 z-[63] flex flex-col bg-[hsl(var(--portal-navy-deep))] pb-6 text-white focus:outline-none"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        if (e.key === "ArrowLeft") go(-1);
      }}
      data-testid="quote-photo-viewer"
    >
      <div className="flex items-center justify-between px-6">
        <button
          type="button"
          onClick={() => onViewChange({ kind: "grid" })}
          className="inline-flex min-h-12 items-center text-[11px] font-medium uppercase tracking-[0.2em] text-white"
        >
          All photos
        </button>
        <DialogPrimitive.Title className="portal-serif text-[22px] font-normal text-white">
          {index + 1} <span className="text-white/70">/ {total}</span>
        </DialogPrimitive.Title>
        <DialogPrimitive.Close className="inline-flex min-h-12 items-center text-[11px] font-medium uppercase tracking-[0.2em] text-white" data-testid="viewer-close">
          Close
        </DialogPrimitive.Close>
      </div>

      <div
        className="relative min-h-0 flex-1 touch-pan-y"
        onTouchStart={(e) => {
          const t = e.touches[0];
          touchStart.current = { x: t.clientX, y: t.clientY };
        }}
        onTouchEnd={(e) => {
          const start = touchStart.current;
          touchStart.current = null;
          if (!start) return;
          const t = e.changedTouches[0];
          const dx = t.clientX - start.x;
          if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - start.y)) go(dx < 0 ? 1 : -1);
        }}
      >
        <img src={current.url} alt={altFor(title, ((index % total) + total) % total, total)} className="absolute inset-0 size-full object-contain" data-testid="viewer-image" />
        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous photo"
              onClick={() => go(-1)}
              className="absolute left-3 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center border border-white/60 bg-[hsl(var(--portal-navy-deep)/0.55)] hover:bg-[hsl(var(--portal-navy-deep)/0.8)]"
              data-testid="viewer-prev"
            >
              <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={() => go(1)}
              className="absolute right-3 top-1/2 flex size-12 -translate-y-1/2 items-center justify-center border border-white/60 bg-[hsl(var(--portal-navy-deep)/0.55)] hover:bg-[hsl(var(--portal-navy-deep)/0.8)]"
              data-testid="viewer-next"
            >
              <ChevronRight className="size-5" strokeWidth={1.5} aria-hidden />
            </button>
          </>
        )}
      </div>

      <DialogPrimitive.Description className="sr-only">{`Photo ${index + 1} of ${total} of ${title}. Use the arrow keys or swipe to move between photos.`}</DialogPrimitive.Description>
      <p role="status" className="sr-only">
        {announce}
      </p>

      <div ref={stripRef} className="flex gap-1.5 overflow-x-auto px-6 pt-4 [scrollbar-width:none]">
        {images.map((img, i) => {
          const on = i === index;
          return (
            <button
              key={img.id}
              type="button"
              aria-label={`Photo ${i + 1} of ${total}`}
              aria-current={on}
              onClick={() => onViewChange({ kind: "viewer", index: i })}
              className={cn("size-14 flex-none overflow-hidden border-2", on ? "border-accent opacity-100" : "border-transparent opacity-60 hover:opacity-90")}
            >
              <img src={img.url} alt="" className="size-full object-cover" />
            </button>
          );
        })}
      </div>
    </DialogPrimitive.Content>
  );
}
