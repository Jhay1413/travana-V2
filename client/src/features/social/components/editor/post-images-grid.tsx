import { useRef, useState } from "react";
import { Reorder } from "framer-motion";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Info,
  TreePine,
  X,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { POST_IMAGE_SIZE } from "@/features/image-upscale";
import { SocialImageTile } from "../social-image-tile";
import { isFormattableFile } from "./use-post-images";
import type { ImageItem, LocalImage, UrlImage } from "./editor.types";

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
  pendingFiles: LocalImage[];
  imageOrder: ImageItem[];
  setImageOrder: (items: ImageItem[]) => void;
  loadingUrlImages: boolean;
  selectedUrlCount: number;
  onToggleUrl: (url: string) => void;
  onMoveUrl: (url: string, direction: -1 | 1) => void;
  onSetAllUrls: (selected: boolean) => void;
  onFiles: (files: FileList | File[]) => void;
  onRemove: (sortKey: string) => void;
  onUrlSize: (url: string, w: number, h: number) => void;
  onLocalSize: (localId: string, w: number, h: number) => void;
}

/** Quote image tiles (toggle in/out, order badge), upload drop zone and reorderable attachments. */
export function PostImagesGrid({
  urlImages,
  pendingFiles,
  imageOrder,
  setImageOrder,
  loadingUrlImages,
  selectedUrlCount,
  onToggleUrl,
  onMoveUrl,
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

  const nonUrlItems = imageOrder.filter((i) => i.type !== "url");
  const selectedUrls = urlImages.filter((i) => i.selected);

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
            <p className="text-[11px] text-slate-500">Click an image to include it in the post.</p>
            <p className="flex items-center gap-1 text-[10px] text-slate-400">
              <Info className="h-3 w-3 shrink-0" />
              Images are formatted to {POST_IMAGE_SIZE}×{POST_IMAGE_SIZE} (centre-cropped) when you schedule. Small images are upscaled first. Your quote&apos;s original photos are not changed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {urlImages.map((img, i) => {
              const selectedPos = selectedUrls.findIndex((s) => s.url === img.url);
              return (
                <div key={`url-img-${i}`} className="group/tile relative">
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
                  {img.selected && (
                    <>
                      <span
                        className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-slate-900 shadow"
                        data-testid={`badge-order-url-image-${i}`}
                      >
                        {imageOrder.findIndex((o) => o.type === "url" && o.data.url === img.url) + 1}
                      </span>
                      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100">
                        <button
                          type="button"
                          aria-label="Move earlier"
                          disabled={selectedPos === 0}
                          onClick={() => onMoveUrl(img.url, -1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow disabled:opacity-40"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Move later"
                          disabled={selectedPos === selectedUrls.length - 1}
                          onClick={() => onMoveUrl(img.url, 1)}
                          className="flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow disabled:opacity-40"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
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
          Additional images
          {nonUrlItems.length > 0 && (
            <span className="ml-auto text-[11px] font-normal text-slate-400">drag to reorder</span>
          )}
          {pendingFiles.length > 0 && (
            <span className="ml-1 text-[11px] font-normal text-amber-600">
              ({pendingFiles.length} new - will upload on save)
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

        {nonUrlItems.length > 0 && (
          <Reorder.Group
            axis="x"
            values={nonUrlItems}
            onReorder={(newOrder) => {
              const urlItems = imageOrder.filter((i) => i.type === "url");
              setImageOrder([...urlItems, ...newOrder]);
            }}
            className="flex flex-wrap gap-2"
          >
            {nonUrlItems.map((item) => (
              <Reorder.Item key={item.sortKey} value={item} className="group relative cursor-grab active:cursor-grabbing">
                {item.type === "local" && item.data.file.type.startsWith("image/") ? (
                  <SocialImageTile
                    className="w-48"
                    src={item.data.previewUrl}
                    alt={item.data.file.name}
                    label={item.data.file.name}
                    SourceIcon={ImagePlus}
                    selected
                    sourceWidth={item.data.sourceWidth}
                    sourceHeight={item.data.sourceHeight}
                    onSourceSize={(w, h) => onLocalSize(item.data.localId, w, h)}
                    upscaleSkipped={!isFormattableFile(item.data.file)}
                    testId={`local-${item.data.localId}`}
                  />
                ) : (
                  <div className={`h-16 w-16 overflow-hidden rounded-lg border bg-slate-100 shadow-sm ${item.type === "local" ? "border-amber-400" : "border-slate-200"}`}>
                    <img
                      src={item.type === "existing" ? (item.data.thumb_url || item.data.url) : item.type === "local" ? item.data.previewUrl : ""}
                      alt={item.type === "existing" ? item.data.name : item.type === "local" ? item.data.file.name : ""}
                      className="pointer-events-none h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-3 w-3 text-white drop-shadow" />
                </div>
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={(e) => { e.stopPropagation(); onRemove(item.sortKey); }}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
        )}
      </div>
    </div>
  );
}
