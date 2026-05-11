import { Star } from "lucide-react";
import type { QuoteImage } from "@/components/quote/hooks";

interface BookingMediaPanelProps {
  primaryImage: QuoteImage | undefined;
  galleryImages: QuoteImage[];
}

export function BookingMediaPanel({ primaryImage, galleryImages }: BookingMediaPanelProps) {
  return (
    <>
      <div
        className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]"
        data-testid="img-itinerary-hero"
      >
        {primaryImage ? (
          <>
            <img
              src={primaryImage.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              data-testid="img-itinerary-hero-photo"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0"
              aria-hidden
            />
            <div
              className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white"
              data-testid="badge-main-image"
            >
              <Star className="h-3 w-3 fill-current" /> Main
            </div>
          </>
        ) : (
          <div
            className="flex h-full items-center justify-center text-xs text-black/40"
            data-testid="placeholder-no-hero"
          >
            No images
          </div>
        )}
      </div>

      {galleryImages.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5" data-testid="grid-itinerary-gallery">
          {galleryImages.map((img, idx: number) => (
            <button
              key={img.id}
              type="button"
              className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] active:scale-[0.99]"
              data-testid={`button-gallery-image-${idx}`}
              onClick={() => {}}
              title="Click to set as main image"
            >
              <img
                src={img.url}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                data-testid={`img-gallery-${idx}`}
              />
              <div
                className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100"
                aria-hidden
              />
              <div
                className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[8px] font-semibold text-white opacity-0 transition group-hover:opacity-100"
                data-testid={`label-set-main-${idx}`}
              >
                <Star className="h-2.5 w-2.5" /> Set as main
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
