import { useRef, useState } from "react";
import { Building2, GripHorizontal, ImagePlus, Info, TreePine } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { POST_IMAGE_SIZE } from "@/features/image-upscale";
import { SocialImageTile } from "../social-image-tile";
import { PostOrderStrip } from "./post-order-strip";
import type { ImageItem, UrlImage } from "./editor.types";

const sourceIcons: Record<string, typeof Building2> = {
  accommodation: Building2,
  lodge: TreePine,
  park: TreePine,
  cottage: TreePine,
};

const sourceLabels: Record<string, string> = {
  accommodation: "Accommodation",
  lodge: "Lodge",
  park: "Park",
  cottage: "Cottage",
  quote: "Quote",
};

interface PostImagesGridProps {
  urlImages: UrlImage[];
  pendingFileCount: number;
  /** Every image in the post, in posting order. */
  imageOrder: ImageItem[];
  loadingUrlImages: boolean;
  selectedUrlCount: number;
  onToggleUrl: (url: string) => void;
  onMove: (sortKey: string, direction: -1 | 1) => void;
  onInsert: (fromKey: string, toKey: string) => void;
  onSetAllUrls: (selected: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (sortKey: string) => void;
  onUrlSize: (url: string, w: number, h: number) => void;
  onLocalSize: (localId: string, w: number, h: number) => void;
  /** Sort key of a quote image, to look up its badge in `imageOrder`. */
  urlSortKey: (url: string) => string;
}

/** Quote image picker, upload drop zone and the one ordered list of everything in the post. */
export function PostImagesGrid({
  urlImages,
  pendingFileCount,
  imageOrder,
  loadingUrlImages,
  selectedUrlCount,
  onToggleUrl,
  onMove,
  onInsert,
  onSetAllUrls,
  onFiles,
  onRemove,
  onUrlSize,
  onLocalSize,
  urlSortKey,
}: PostImagesGridProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFiles(e.target.files);
      e.target.value = "";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files.length > 0) {
      onFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-4">
      {urlImages.length > 0 && (
        <div className="space-y-2" data-testid="section-accommodation-images">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Building2 className="h-3.5 w-3.5" />
            Quote images
            <span
              className="ml-auto text-[11px] font-normal text-slate-400"
              title="Selected images are downloaded and uploaded to OnlySocials when scheduling."
            >
              {selectedUrlCount} of {urlImages.length} selected
            </span>
          </div>
          <div className="space-y-0.5">
            <p className="text-[11px] text-slate-500">Click an image to include it, then drag to change the order.</p>
            <p className="flex items-center gap-1 text-[10px] text-slate-400">
              <Info className="h-3 w-3 shrink-0" />
              Images are formatted to {POST_IMAGE_SIZE}×{POST_IMAGE_SIZE} (centre-cropped) when you schedule. Small images are upscaled first. Your quote&apos;s original photos are not changed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {urlImages.map((img, i) => {
              const position = imageOrder.findIndex((o) => o.sortKey === urlSortKey(img.url)) + 1;
              return (
                <div key={`url-img-${i}`} className="relative">
                  <SocialImageTile
                    src={img.url}
                    alt={img.name}
                    label={sourceLabels[img.source] || img.source}
                    SourceIcon={sourceIcons[img.source] || Building2}
                    selected={img.selected}
                    onToggle={() => onToggleUrl(img.url)}
                    toggleTestId={`button-toggle-url-image-${i}`}
                    sourceWidth={img.sourceWidth}
                    sourceHeight={img.sourceHeight}
                    onSourceSize={(w, h) => onUrlSize(img.url, w, h)}
                    testId={`url-image-${i}`}
                  />
                  {img.selected && position > 0 && (
                    <span
                      className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-slate-900 shadow"
                      data-testid={`badge-order-url-image-${i}`}
                    >
                      {position}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSetAllUrls(true)}
              className="text-[11px] font-medium text-blue-500 hover:text-blue-600"
              data-testid="button-select-all-url-images"
            >
              Select all
            </button>
            <span className="text-[10px] text-slate-300">|</span>
            <button
              type="button"
              onClick={() => onSetAllUrls(false)}
              className="text-[11px] font-medium text-red-500 hover:text-red-600"
              data-testid="button-deselect-all-url-images"
            >
              Deselect all
            </button>
          </div>
        </div>
      )}

      {loadingUrlImages && (
        <div className="flex items-center gap-2 py-2">
          <Spinner className="h-4 w-4" />
          <span className="text-xs text-slate-500">Loading accommodation images...</span>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          <ImagePlus className="h-3.5 w-3.5" />
          Upload images
          {pendingFileCount > 0 && (
            <span className="ml-1 text-[11px] font-normal text-amber-600">
              ({pendingFileCount} new - will upload on save)
            </span>
          )}
        </div>

        <div
          className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors ${
            isDraggingOver ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
          onDragLeave={() => setIsDraggingOver(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4"
            className="hidden"
            onChange={handleFileInputChange}
          />
          <div className="flex select-none flex-col items-center justify-center gap-1.5 py-4">
            <ImagePlus className="h-5 w-5 text-slate-300" />
            <p className="text-[11px] text-slate-400">Click or drop images here</p>
          </div>
        </div>
      </div>

      {imageOrder.length > 0 && (
        <div className="space-y-2" data-testid="section-post-order">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <GripHorizontal className="h-3.5 w-3.5" />
            In the post
            <span className="ml-auto text-[11px] font-normal text-slate-400">{imageOrder.length} in order</span>
          </div>
          <p className="text-[11px] text-slate-500">
            Drag an image onto another to change the order, or use the arrows. Number 1 posts first.
          </p>
          <PostOrderStrip imageOrder={imageOrder} onMove={onMove} onInsert={onInsert} onRemove={onRemove} onLocalSize={onLocalSize} />
        </div>
      )}
    </div>
  );
}
