import { useEffect, useRef, useState } from "react";
import { GripVertical, ImagePlus, Loader2, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDragReorder } from "@/hooks/use-drag-reorder";
import { cn } from "@/lib/utils";

// Arrange / add / choose-main for a quote's or booking's gallery. Lives here
// rather than in either feature because both use the identical merged-image shape.
//
// Only images the quote/booking owns can be reordered or made primary: the
// gallery also merges in photos from the shared accommodation and lodge
// libraries, which have no per-quote row to store a position on. Those are
// listed separately, greyed and undraggable, so it's clear why they can't be
// moved rather than looking broken.
//
// Adding a photo and choosing the main one take effect immediately (they're
// mutations on an already-saved record, same as the panel behind this dialog).
// Only the order is deferred behind "Save order".

export interface ReorderableImage {
  id: string;
  url: string;
  isPrimary?: boolean | null;
  /** "quote" / "booking" for owned rows; "accommodation" / "lodge" for library. */
  ownerType?: string;
}

interface ImageReorderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: ReorderableImage[];
  /** Owner type whose images can be dragged / made primary — others are display-only. */
  ownedType: string;
  onSave: (imageIds: string[]) => void;
  isSaving?: boolean;
  onAddFiles?: (files: File[]) => void;
  isUploading?: boolean;
  onSetPrimary?: (imageId: string) => void;
  onDelete?: (imageId: string) => void;
}

function Thumb({
  image,
  draggable,
  onSetPrimary,
  onDelete,
}: {
  image: ReorderableImage;
  draggable: boolean;
  onSetPrimary?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative h-24 w-24 overflow-hidden rounded-xl border bg-black/[0.03]",
        draggable ? "cursor-grab border-black/10 active:cursor-grabbing" : "border-black/5 opacity-60",
      )}
    >
      {/* pointer-events-none keeps drag events on the tile — a child image
          would otherwise fire its own dragleave as the cursor crosses it. */}
      <img
        src={image.url}
        alt=""
        className="pointer-events-none h-full w-full object-cover"
        draggable={false}
      />
      {image.isPrimary ? (
        <span className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-emerald-600/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          <Star className="h-2.5 w-2.5 fill-current" /> Main
        </span>
      ) : (
        onSetPrimary && (
          <button
            type="button"
            // Drag starts on pointerdown; stop it here so a click that only
            // means "make this the main photo" doesn't begin a drag.
            onPointerDown={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            onClick={(e) => {
              e.stopPropagation();
              onSetPrimary();
            }}
            className="absolute left-1.5 top-1.5 z-10 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition hover:bg-black/75 group-hover:opacity-100"
            title="Set as main photo"
          >
            <Star className="h-2.5 w-2.5" /> Main
          </button>
        )
      )}
      {onDelete && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          // Inside the tile, not overhanging it: the tile needs overflow-hidden
          // to clip the image to its rounded corners, which would also clip a
          // negatively-positioned button.
          className="absolute right-1.5 top-1.5 z-10 grid h-5 w-5 place-items-center rounded-full bg-red-500/90 text-white shadow-sm transition hover:bg-red-600"
          title="Delete image"
          data-testid={`button-delete-image-${image.id}`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
      {draggable && (
        <span className="pointer-events-none absolute bottom-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-md bg-black/45 text-white">
          <GripVertical className="h-3 w-3" />
        </span>
      )}
    </div>
  );
}

export function ImageReorderDialog({
  open,
  onOpenChange,
  images,
  ownedType,
  onSave,
  isSaving = false,
  onAddFiles,
  isUploading = false,
  onSetPrimary,
  onDelete,
}: ImageReorderDialogProps) {
  const owned = images.filter((i) => (i.ownerType ?? ownedType) === ownedType);
  const library = images.filter((i) => (i.ownerType ?? ownedType) !== ownedType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [order, setOrder] = useState<ReorderableImage[]>([]);
  const { itemProps, draggingIndex, overIndex } = useDragReorder(order, setOrder);

  // Clear on close so the next open re-seeds from fresh server data instead of
  // resurrecting a cancelled drag session.
  useEffect(() => {
    if (!open) setOrder([]);
  }, [open]);

  // Merge rather than replace: uploading from inside this dialog refetches the
  // gallery, and a plain re-seed would throw away an in-progress arrangement.
  // Keeps the current relative order, drops deleted rows, appends new ones.
  useEffect(() => {
    if (!open) return;
    setOrder((prev) => {
      if (prev.length === 0) return owned;
      const byId = new Map(owned.map((i) => [i.id, i]));
      const kept = prev.filter((i) => byId.has(i.id)).map((i) => byId.get(i.id)!);
      const keptIds = new Set(kept.map((i) => i.id));
      return [...kept, ...owned.filter((i) => !keptIds.has(i.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, images]);

  const dirty = order.some((img, i) => img.id !== owned[i]?.id) || order.length !== owned.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Arrange images</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-black/50">
            Drag to set the order, star to make it the main photo, ✕ to delete.
          </p>
          {onAddFiles && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                className="hidden"
                data-testid="input-arrange-add-images"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) onAddFiles(files);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-none gap-1.5 text-xs"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                data-testid="button-arrange-add-images"
              >
                {isUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" />
                )}
                Add images
              </Button>
            </>
          )}
        </div>

        {order.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 px-6 py-10 text-center text-sm text-black/45">
            No images yet — use “Add images” to upload some.
          </div>
        ) : (
          <div
            className="flex max-h-[50vh] flex-wrap gap-2 overflow-y-auto pr-1"
            data-testid="reorder-image-grid"
          >
            {order.map((img, idx) => (
              <div
                key={img.id}
                {...itemProps(idx)}
                className={cn(
                  "group rounded-xl transition",
                  draggingIndex === idx && "opacity-40",
                  overIndex === idx && draggingIndex !== idx && "ring-2 ring-blue-500 ring-offset-1",
                )}
                data-testid={`reorder-image-${img.id}`}
              >
                <Thumb
                  image={img}
                  draggable
                  onSetPrimary={onSetPrimary ? () => onSetPrimary(img.id) : undefined}
                  onDelete={
                    onDelete
                      ? () => {
                          // Drop it locally straight away; the refetch that
                          // follows the mutation confirms it. The merge effect
                          // keeps it gone rather than resurrecting it.
                          setOrder((prev) => prev.filter((i) => i.id !== img.id));
                          onDelete(img.id);
                        }
                      : undefined
                  }
                />
              </div>
            ))}
          </div>
        )}

        {library.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] text-black/45">
              {library.length} image{library.length === 1 ? "" : "s"} from the shared accommodation
              library can't be reordered here — they always follow the ones above.
            </p>
            <div className="flex flex-wrap gap-2">
              {library.slice(0, 8).map((img) => (
                <Thumb key={img.id} image={img} draggable={false} />
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Close
          </Button>
          <Button
            onClick={() => onSave(order.map((i) => i.id))}
            disabled={!dirty || isSaving}
            data-testid="button-save-image-order"
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
