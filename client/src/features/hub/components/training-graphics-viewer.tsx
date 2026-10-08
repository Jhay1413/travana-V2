import { useEffect, useState } from "react";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { TRAINING_RICH_TEXT_CLASS, stripHtml } from "@/features/hub/lib/rich-text";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { cn } from "@/lib/utils";
import type { TrainingLessonAsset } from "../types/training.types";

const SHORT_CAPTION_MAX_CHARS = 80;

// Centre only a short, single-block caption. Length is measured on the visible
// text (the stored value is HTML, whose tags would inflate it), and lists read
// better left-aligned regardless of length.
function isShortCaption(caption: string): boolean {
  return stripHtml(caption).length <= SHORT_CAPTION_MAX_CHARS && !/<(ul|ol)[\s>]/i.test(caption);
}

interface TrainingGraphicsViewerProps {
  assets: TrainingLessonAsset[];
  /** Fired once the learner reaches the last slide. */
  onCompleted?: () => void;
}

/**
 * Ordered slide viewer for a graphics lesson's assets, built on the shared
 * carousel primitive. Reaching the final slide marks the lesson complete;
 * clicking a slide opens it full-screen via the shared image lightbox.
 */
export function TrainingGraphicsViewer({ assets, onCompleted }: TrainingGraphicsViewerProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const sortedAssets = [...assets].sort((a, b) => a.position - b.position);
  const currentAsset = sortedAssets[current];

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (sortedAssets.length > 0 && current === sortedAssets.length - 1) {
      onCompleted?.();
    }
    // Only re-run when the slide index or asset count changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, sortedAssets.length]);

  if (sortedAssets.length === 0) {
    return (
      <div
        className="flex aspect-video items-center justify-center rounded-xl border border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        data-testid="training-graphics-empty"
      >
        No slides in this lesson yet.
      </div>
    );
  }

  return (
    <div data-testid="training-graphics-viewer">
      {/* The slide and its caption are one unit: a single bordered container, with
          the caption divided off by a border-t rather than its own card. Keeping
          them together stops the caption reading as a second, lesson-level card
          next to the lesson description below. */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {/* Relative wrapper scopes the arrows and counter to the image, so they
            stay centred on it however tall the caption below is. */}
        <div className="relative">
          <Carousel setApi={setApi} className="w-full">
            <CarouselContent className="ml-0">
              {sortedAssets.map((asset, i) => (
                <CarouselItem key={asset.id} className="pl-0">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="block aspect-video w-full overflow-hidden bg-slate-900"
                    data-testid={`training-graphics-slide-${i}`}
                  >
                    <img
                      src={asset.asset_url}
                      alt={stripHtml(asset.caption)}
                      className="h-full w-full object-contain"
                    />
                  </button>
                </CarouselItem>
              ))}
            </CarouselContent>

            {sortedAssets.length > 1 && (
              <>
                <CarouselPrevious className="left-3" data-testid="training-graphics-prev" />
                <CarouselNext className="right-3" data-testid="training-graphics-next" />
              </>
            )}
          </Carousel>

          {/* Translucent dark pill with light text stays legible over any photo in
              either theme; pointer-events-none keeps the image clickable beneath. */}
          {sortedAssets.length > 1 && (
            <div
              className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white"
              data-testid="training-graphics-counter"
            >
              {current + 1} / {sortedAssets.length}
            </div>
          )}
        </div>

        {currentAsset?.caption && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div data-testid={`training-graphics-caption-${current}`}>
              <RichTextDisplay
                content={currentAsset.caption}
                className={cn(
                  "text-sm leading-relaxed text-slate-700 dark:text-slate-200",
                  TRAINING_RICH_TEXT_CLASS,
                  isShortCaption(currentAsset.caption) ? "text-center" : "text-left",
                )}
              />
            </div>
          </div>
        )}
      </div>

      <ImageLightbox
        images={sortedAssets.map((asset) => ({ id: asset.id, url: asset.asset_url, canSetPrimary: false }))}
        open={lightboxOpen}
        startIndex={current}
        onOpenChange={setLightboxOpen}
      />
    </div>
  );
}
