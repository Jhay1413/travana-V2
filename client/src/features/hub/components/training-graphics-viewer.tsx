import { useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import type { TrainingLessonAsset } from "../types/training.types";

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
      <Carousel setApi={setApi} className="w-full">
        <CarouselContent className="ml-0">
          {sortedAssets.map((asset, i) => (
            <CarouselItem key={asset.id} className="pl-0">
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block aspect-video w-full overflow-hidden rounded-xl bg-slate-900"
                data-testid={`training-graphics-slide-${i}`}
              >
                <img
                  src={asset.asset_url}
                  alt={asset.caption ?? ""}
                  className="h-full w-full object-contain"
                />
              </button>
              {asset.caption && (
                <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">{asset.caption}</p>
              )}
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

      <div className="mt-3 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        Slide {current + 1} of {sortedAssets.length}
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
