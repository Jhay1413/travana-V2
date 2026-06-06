import { useEffect, useState } from "react";
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
}

interface ImageLightboxProps {
  images: LightboxImage[];
  open: boolean;
  startIndex?: number;
  onOpenChange: (open: boolean) => void;
}

/**
 * Full-screen image viewer. Renders all provided images in a swipeable/clickable
 * carousel (arrow keys, on-screen arrows, and a position counter), opening at
 * `startIndex`. Built on the shared Dialog + Carousel primitives.
 */
export function ImageLightbox({ images, open, startIndex = 0, onOpenChange }: ImageLightboxProps) {
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-screen w-screen max-w-none items-center justify-center gap-0 rounded-none border-none bg-black/95 p-0 sm:max-w-none sm:rounded-none [&>button]:z-50 [&>button]:text-white/80 [&>button]:hover:text-white"
        data-testid="lightbox-image-viewer"
      >
        <DialogTitle className="sr-only">Image gallery</DialogTitle>

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
