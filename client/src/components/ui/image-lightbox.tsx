import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

interface LightboxImage {
  id?: string;
  url: string;
  isPrimary?: boolean | null;
  /** When false, the "Set as main" control is hidden for this image. Defaults to true. */
  canSetPrimary?: boolean;
}

interface ImageLightboxProps {
  images: LightboxImage[];
  open: boolean;
  startIndex?: number;
  onOpenChange: (open: boolean) => void;
  /**
   * When provided, a "Set as main" button is shown for the currently viewed
   * image (or a "Main image" badge if it is already primary).
   */
  onSetPrimary?: (image: LightboxImage) => void;
}

/**
 * Full-screen image viewer. Renders all provided images in a swipeable/clickable
 * carousel (arrow keys, on-screen arrows, and a position counter), opening at
 * `startIndex`. Built on the shared Dialog + Carousel primitives.
 */
export function ImageLightbox({
  images,
  open,
  startIndex = 0,
  onOpenChange,
  onSetPrimary,
}: ImageLightboxProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (images.length === 0) return null;

  const currentImage = images[current];
  const showPrimaryControl =
    !!onSetPrimary && !!currentImage && (currentImage.canSetPrimary ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-screen w-screen max-w-none items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 sm:max-w-none sm:rounded-none [&>button]:z-50 [&>button]:text-white/80 [&>button]:hover:text-white"
        data-testid="lightbox-image-viewer"
      >
        <DialogTitle className="sr-only">Image gallery</DialogTitle>

        {showPrimaryControl && (
          <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2">
            {currentImage.isPrimary ? (
              <div
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-amber-300"
                data-testid="lightbox-primary-badge"
              >
                <Star className="h-3.5 w-3.5 fill-current" /> Main image
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25 hover:text-amber-300"
                data-testid="lightbox-set-primary"
                onClick={() => onSetPrimary?.(currentImage)}
                title="Set as main image"
              >
                <Star className="h-3.5 w-3.5" /> Set as main
              </button>
            )}
          </div>
        )}

        <Carousel
          opts={{ startIndex, loop: images.length > 1 }}
          setApi={setApi}
          className="h-full w-full"
        >
          <CarouselContent className="ml-0 h-full">
            {images.map((img, i) => (
              <CarouselItem
                key={img.id ?? i}
                className="flex h-full items-center justify-center pl-0"
              >
                <img
                  src={img.url}
                  alt=""
                  draggable={false}
                  className="max-h-[88vh] max-w-[92vw] w-auto select-none object-contain"
                  data-testid={`lightbox-image-${i}`}
                />
              </CarouselItem>
            ))}
          </CarouselContent>

          {images.length > 1 && (
            <>
              <CarouselPrevious
                className="left-4 h-10 w-10 border-none bg-white/15 text-white hover:bg-white/25 hover:text-white"
                data-testid="lightbox-prev"
              />
              <CarouselNext
                className="right-4 h-10 w-10 border-none bg-white/15 text-white hover:bg-white/25 hover:text-white"
                data-testid="lightbox-next"
              />
            </>
          )}
        </Carousel>

        {images.length > 1 && (
          <div
            className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-white/90"
            data-testid="lightbox-counter"
          >
            {current + 1} / {images.length}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
