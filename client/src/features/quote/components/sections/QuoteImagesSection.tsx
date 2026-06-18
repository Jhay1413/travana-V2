import { useRef } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";

interface ExistingImage {
  id: string;
  url: string;
}

interface QuoteImagesSectionProps {
  imageFiles: File[];
  setImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  imageUrls: string[];
  setImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
  existingImagesState: ExistingImage[];
  setExistingImagesState: React.Dispatch<React.SetStateAction<ExistingImage[]>>;
  setDeletedImageIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function QuoteImagesSection({
  imageFiles,
  setImageFiles,
  imageUrls,
  setImageUrls,
  existingImagesState,
  setExistingImagesState,
  setDeletedImageIds,
}: QuoteImagesSectionProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={ImagePlus} title="Quote Images" />
      <div className="space-y-3">
        <div className="space-y-1.5">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
              if (files.length > 0) setImageFiles((prev) => [...prev, ...files]);
              if (imageInputRef.current) imageInputRef.current.value = "";
            }}
            className="hidden"
            data-testid="input-quote-images"
          />
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full rounded-xl border-black/10 bg-white/70 text-sm"
            onClick={() => imageInputRef.current?.click()}
            data-testid="button-add-images"
          >
            <ImagePlus className="mr-2 h-4 w-4" />
            Add images
          </Button>
        </div>

        {existingImagesState.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {existingImagesState.map((img) => (
              <div key={img.id} className="group relative overflow-hidden rounded-xl border border-black/10">
                <img src={img.url} alt="Existing image" className="h-20 w-full object-cover" />
                <button
                  type="button"
                  onClick={() => {
                    setDeletedImageIds((prev) => [...prev, img.id]);
                    setExistingImagesState((prev) => prev.filter((i) => i.id !== img.id));
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">Saved</div>
              </div>
            ))}
          </div>
        )}

        {(imageFiles.length > 0 || imageUrls.length > 0) && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {imageFiles.map((file, idx) => (
              <div key={`file-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  className="h-20 w-full object-cover"
                  data-testid={`img-quote-preview-file-${idx}`}
                />
                <button
                  type="button"
                  onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                  data-testid={`button-remove-image-file-${idx}`}
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">{file.name}</div>
              </div>
            ))}
            {imageUrls.map((url, idx) => (
              <div key={`url-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                <img
                  src={url}
                  alt={`Image ${idx + 1}`}
                  className="h-20 w-full object-cover"
                  data-testid={`img-quote-preview-url-${idx}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "";
                    (e.target as HTMLImageElement).alt = "Failed to load";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                  data-testid={`button-remove-image-url-${idx}`}
                >
                  <X className="h-3 w-3" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">From JSON</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
