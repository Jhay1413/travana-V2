import { useRef } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { FormSection } from "@/components/shared/form-shell";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { cn } from "@/lib/utils";
import {
  fileImageItem,
  itemPreviewUrl,
  releaseItemPreview,
  withoutFailedUrlItem,
  type FormImageItem,
} from "@/features/quote/lib/form-images";

interface QuoteImagesSectionProps {
  title?: string;
  items: FormImageItem[];
  setItems: React.Dispatch<React.SetStateAction<FormImageItem[]>>;
  /** Records a saved image for server-side deletion when it's removed here. */
  setDeletedImageIds: React.Dispatch<React.SetStateAction<string[]>>;
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
}: QuoteImagesSectionProps) {
  const resolvedTitle = title ?? "Images";
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
    <p className="mt-2.5 text-xs text-[#6B7686]">
      Drag to arrange. The cover photo (the first one) leads the quote.
    </p>
  );

  const grid = (
    <div className="fm-photos" data-testid="grid-quote-form-images">
      {items.map((item, idx) => (
        <div
          key={item.key}
          {...itemProps(idx)}
          className={cn(
            "fm-photo cursor-grab transition active:cursor-grabbing",
            draggingIndex === idx && "opacity-40",
            // Ring marks where the dragged image will land.
            overIndex === idx && draggingIndex !== idx && "ring-2 ring-blue-500 ring-offset-1",
          )}
          data-testid={`quote-form-image-${item.key}`}
        >
          {/* pointer-events-none keeps the drag events on the tile: a child image would
              otherwise fire its own dragleave as the cursor crosses it. */}
          <img
            src={itemPreviewUrl(item)}
            alt=""
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
            draggable={false}
            onError={(e) => {
              // An imported photo that won't load is dropped rather than shown
              // as a broken tile. Saved images stay, flagged, so they can be
              // deleted on purpose.
              if (item.kind === "url") setItems((prev) => withoutFailedUrlItem(prev, item.key));
              else (e.target as HTMLImageElement).alt = "Failed to load";
            }}
          />
          <span className="fm-photo__shade" />
          <span className="fm-photo__n pointer-events-none" aria-hidden="true">Photo {idx + 1}</span>
          {idx === 0 ? (
            <span className="fm-photo__cover pointer-events-none">Cover</span>
          ) : (
            <button
              type="button"
              // The tile is draggable, so stop the pointer/drag here, otherwise
              // clicking this starts a drag instead of firing.
              onPointerDown={(e) => e.stopPropagation()}
              onDragStart={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                makePrimary(item);
              }}
              className="fm-photo__make"
              title="Set as main photo"
              data-testid={`button-set-primary-${item.key}`}
            >
              Make cover
            </button>
          )}
          {/* Always visible: a hover-only control is easy to miss and awkward on touch. */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              removeItem(item);
            }}
            className="fm-photo__x"
            title="Remove image"
            data-testid={`button-remove-image-${item.key}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => imageInputRef.current?.click()}
        className="fm-photo-add"
        data-testid="button-add-images"
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
        Add photos
      </button>
    </div>
  );

  return (
      <FormSection
        id={formSectionDomId("images")}
        title={resolvedTitle}
        icon={<ImagePlus size={16} color="#D97706" aria-hidden="true" />}
        right={
          <span className="whitespace-nowrap rounded-full bg-[#D1FAE5] px-3 py-1 text-xs font-semibold text-[#047857]">
            {items.length} {items.length === 1 ? "photo" : "photos"}
          </span>
        }
        data-testid="drawer-section-images"
      >
        <div>
          {fileInput}
          {grid}
          {hint}
        </div>
      </FormSection>
    );
}
