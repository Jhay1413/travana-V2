import { useRef } from "react";
import { GripVertical, ImagePlus, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";
import { FormDrawerSection } from "@/components/shared/form-drawer";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { cn } from "@/lib/utils";
import {
  fileImageItem,
  itemPreviewUrl,
  releaseItemPreview,
  type FormImageItem,
} from "@/features/quote/lib/form-images";
import type { FormLayout } from "@/features/quote/types";

interface QuoteImagesSectionProps {
  title?: string;
  items: FormImageItem[];
  setItems: React.Dispatch<React.SetStateAction<FormImageItem[]>>;
  /** Records a saved image for server-side deletion when it's removed here. */
  setDeletedImageIds: React.Dispatch<React.SetStateAction<string[]>>;
  layout?: FormLayout;
}

/**
 * The image picker shared by the quote and booking forms. One ordered grid, not
 * one grid per source: drag to arrange, and the first image is the main photo
 * (the server marks position 0 primary when there isn't one yet).
 */
export function QuoteImagesSection({
  title,
  items,
  setItems,
  setDeletedImageIds,
  layout = "card",
}: QuoteImagesSectionProps) {
  const isDrawer = layout === "drawer";
  const resolvedTitle = title ?? (isDrawer ? "Images" : "Quote Images");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { itemProps, draggingIndex, overIndex } = useDragReorder(items, setItems);

  const removeItem = (item: FormImageItem) => {
    // A saved image also needs deleting server-side on submit; pending ones
    // just disappear, and their preview blob is released.
    if (item.kind === "existing") setDeletedImageIds((prev) => [...prev, item.id]);
    else releaseItemPreview(item);
    setItems((prev) => prev.filter((i) => i.key !== item.key));
  };

  // Primary is position 0 — the server marks the first submitted image primary
  // when the quote has none yet — so "make this the main photo" is a move to
  // the front rather than a separate flag to keep in sync.
  const makePrimary = (item: FormImageItem) => {
    setItems((prev) => [item, ...prev.filter((i) => i.key !== item.key)]);
  };

  const fileInput = (
    <input
      ref={imageInputRef}
      type="file"
      accept="image/jpeg,image/png,image/gif,image/webp"
      multiple
      onChange={(e) => {
        const files = Array.from(e.target.files || []);
        if (files.length > 0) setItems((prev) => [...prev, ...files.map(fileImageItem)]);
        if (imageInputRef.current) imageInputRef.current.value = "";
      }}
      className="hidden"
      data-testid="input-quote-images"
    />
  );

  const hint = (
    <p className={isDrawer ? "text-[10px] text-black/45" : "text-[11px] text-black/45"}>
      Drag to arrange. The first image is used as the main photo.
    </p>
  );

  const grid = (
    <div className="flex flex-wrap gap-2" data-testid="grid-quote-form-images">
      {items.map((item, idx) => (
        <div
          key={item.key}
          {...itemProps(idx)}
          className={cn(
            "group relative h-20 w-20 cursor-grab overflow-hidden rounded-xl border transition active:cursor-grabbing",
            draggingIndex === idx ? "border-black/10 opacity-40" : "border-black/10",
            // Ring marks where the dragged image will land.
            overIndex === idx && draggingIndex !== idx
              ? "ring-2 ring-blue-500 ring-offset-1"
              : "",
          )}
          data-testid={`quote-form-image-${item.key}`}
        >
          {/* pointer-events-none keeps the drag events on the tile — a
              child image would otherwise fire its own dragleave as the
              cursor crosses it, flickering the drop target. */}
          <img
            src={itemPreviewUrl(item)}
            alt=""
            className="pointer-events-none h-full w-full object-cover"
            draggable={false}
            onError={(e) => {
              (e.target as HTMLImageElement).alt = "Failed to load";
            }}
          />
          {/* Always visible — a hover-only control is easy to miss and
              awkward on touch. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              removeItem(item);
            }}
            // Inside the tile, not overhanging it: the tile needs
            // overflow-hidden to clip the image to its rounded corners,
            // which would also clip a negatively-positioned button.
            className="absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-red-500/90 text-white shadow-sm transition hover:bg-red-600"
            title="Remove image"
            data-testid={`button-remove-image-${item.key}`}
          >
            <X className="h-3 w-3" />
          </button>
          {idx !== 0 && (
            <button
              type="button"
              // The tile is draggable, so stop the pointer/drag here —
              // otherwise clicking this starts a drag instead of firing.
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                makePrimary(item);
              }}
              className="absolute left-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-black/55 text-white transition hover:bg-black/80"
              title="Set as main photo"
              data-testid={`button-set-primary-${item.key}`}
            >
              <Star className="h-2.5 w-2.5" />
            </button>
          )}
          <span className="pointer-events-none absolute bottom-5 right-1 text-white opacity-0 drop-shadow transition group-hover:opacity-100">
            <GripVertical className="h-3 w-3" />
          </span>
          <div
            className={cn(
              "pointer-events-none absolute bottom-0 left-0 right-0 truncate px-1 py-0.5 text-[9px] text-white",
              idx === 0 ? "bg-emerald-600/85 font-semibold" : "bg-black/50",
            )}
          >
            {idx === 0 ? (
              <span className="flex items-center gap-1">
                <Star className="h-2.5 w-2.5 fill-current" /> Main
              </span>
            ) : item.kind === "existing" ? (
              "Saved"
            ) : item.kind === "file" ? (
              item.file.name
            ) : (
              "From JSON"
            )}
          </div>
        </div>
      ))}
    </div>
  );

  if (isDrawer) {
    return (
      <FormDrawerSection title={resolvedTitle} data-testid="drawer-section-images">
        <div className="rounded-xl border border-black/10 bg-white p-4">
          {fileInput}
          {hint}
          {items.length > 0 && <div className="mt-3">{grid}</div>}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="inline-flex items-center gap-1 rounded bg-[#dbeafe] px-2 py-1 text-[10px] font-medium text-[#3b82f6] transition hover:bg-[#cfe2fb]"
              data-testid="button-add-images"
            >
              <ImagePlus className="h-3 w-3" />
              Add images
            </button>
          </div>
        </div>
      </FormDrawerSection>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={ImagePlus} title={resolvedTitle} />
      <div className="space-y-3">
        {fileInput}
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

        {items.length > 0 && (
          <>
            {hint}
            {grid}
          </>
        )}
      </div>
    </div>
  );
}
