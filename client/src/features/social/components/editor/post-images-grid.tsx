import { useRef, useState } from "react";
import { GripHorizontal, ImagePlus } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { PostOrderStrip } from "./post-order-strip";
import type { ImageItem, UrlImage } from "./editor.types";

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
}

/** Upload drop zone plus one set of small tiles for every quote/uploaded image: select, deselect and reorder. */
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

      {(imageOrder.length > 0 || urlImages.length > 0) && (
        <div className="space-y-2" data-testid="section-post-order">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <GripHorizontal className="h-3.5 w-3.5" />
            Images
            <span className="ml-auto text-[11px] font-normal text-slate-400">
              {imageOrder.length} in the post
              {urlImages.length > 0 && ` · ${selectedUrlCount} of ${urlImages.length} quote images`}
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Click a faded image to add it. Drag an image onto another to change the order, or use the arrows. Number 1 posts first.
          </p>
          <PostOrderStrip
            imageOrder={imageOrder}
            unselected={urlImages.filter((img) => !img.selected)}
            onAdd={onToggleUrl}
            onMove={onMove}
            onInsert={onInsert}
            onRemove={onRemove}
            onLocalSize={onLocalSize}
            onUrlSize={onUrlSize}
          />
          {urlImages.length > 0 && (
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
          )}
        </div>
      )}
    </div>
  );
}
