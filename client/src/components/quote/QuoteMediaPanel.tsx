import { ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import type { QuoteImage } from "@/components/quote/hooks";

interface QuoteMediaPanelProps {
  primaryImage: QuoteImage | undefined;
  galleryImages: QuoteImage[];
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  setPrimary: (imageId: string) => void;
  deleteImage: (imageId: string) => void;
  uploadFiles: (files: File[]) => void;
  openFilePicker: () => void;
}

export function QuoteMediaPanel({
  primaryImage,
  galleryImages,
  imageInputRef,
  isUploading,
  setPrimary,
  deleteImage,
  uploadFiles,
  openFilePicker,
}: QuoteMediaPanelProps) {
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
            <div
              key={img.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)]"
              data-testid={`button-gallery-image-${idx}`}
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
              {img.ownerType === "quote" && (
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-semibold text-white hover:text-amber-300 transition-colors"
                    data-testid={`button-set-main-${idx}`}
                    onClick={() => setPrimary(img.id)}
                    title="Set as main image"
                  >
                    <Star className="h-2.5 w-2.5" /> Main
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 text-[8px] font-semibold text-white hover:text-red-300 transition-colors"
                    data-testid={`button-delete-image-${idx}`}
                    onClick={() => deleteImage(img.id)}
                    title="Remove image"
                  >
                    <Trash2 className="h-2.5 w-2.5" /> Del
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-testid="input-image-upload"
        onChange={(e) => uploadFiles(Array.from(e.target.files || []))}
      />
      <button
        type="button"
        className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-black/15 bg-black/[0.02] py-2 text-[10px] font-semibold text-black/50 transition hover:border-black/25 hover:bg-black/[0.04] hover:text-black/70"
        data-testid="button-upload-images"
        onClick={openFilePicker}
        disabled={isUploading}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" /> Uploading...
          </>
        ) : (
          <>
            <ImagePlus className="h-3 w-3" /> Add Images
          </>
        )}
      </button>
    </>
  );
}
