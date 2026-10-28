import { useState } from "react";
import { ChevronLeft, ChevronRight, Film, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImageItem } from "./editor.types";

interface PostOrderStripProps {
  imageOrder: ImageItem[];
  onMove: (sortKey: string, direction: -1 | 1) => void;
  onInsert: (fromKey: string, toKey: string) => void;
  onRemove: (sortKey: string) => void;
  onLocalSize: (localId: string, w: number, h: number) => void;
}

function previewSrc(item: ImageItem): string {
  if (item.type === "existing") return item.data.thumb_url || item.data.url;
  if (item.type === "url") return item.data.url;
  return item.data.previewUrl;
}

function itemName(item: ImageItem): string {
  return item.type === "local" ? item.data.file.name : item.data.name;
}

const ARROW =
  "flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow disabled:opacity-40";

/** Every image in the post as one list: numbered, draggable onto another to reorder, with earlier/later arrows. */
export function PostOrderStrip({ imageOrder, onMove, onInsert, onRemove, onLocalSize }: PostOrderStripProps) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const endDrag = () => {
    setDragKey(null);
    setOverKey(null);
  };

  return (
    <ul className="flex flex-wrap gap-3" data-testid="list-post-images">
      {imageOrder.map((item, i) => {
        const isVideo = item.type === "local" && !item.data.file.type.startsWith("image/");
        const position = i + 1;
        const name = itemName(item);
        return (
          <li
            key={item.sortKey}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", item.sortKey);
              e.dataTransfer.effectAllowed = "move";
              setDragKey(item.sortKey);
            }}
            onDragOver={(e) => {
              // Always cancel the default so an OS file dragged over a tile is not opened by the browser.
              e.preventDefault();
              if (!dragKey) {
                e.dataTransfer.dropEffect = "none";
                return;
              }
              e.dataTransfer.dropEffect = "move";
              setOverKey(item.sortKey);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragKey && dragKey !== item.sortKey) onInsert(dragKey, item.sortKey);
              endDrag();
            }}
            onDragEnd={endDrag}
            className={cn(
              "group/tile relative h-24 w-24 cursor-grab rounded-lg border bg-slate-100 shadow-sm active:cursor-grabbing",
              item.type === "local" ? "border-amber-400" : "border-slate-200",
              dragKey === item.sortKey && "opacity-40",
              overKey === item.sortKey && dragKey !== item.sortKey && "ring-2 ring-blue-400",
            )}
            data-testid={`post-image-${position}`}
          >
            {isVideo ? (
              <div className="flex h-full w-full items-center justify-center text-slate-400">
                <Film className="h-6 w-6" />
              </div>
            ) : (
              <img
                src={previewSrc(item)}
                alt={name}
                draggable={false}
                onLoad={(e) => {
                  if (item.type === "local" && e.currentTarget.naturalWidth > 0) {
                    onLocalSize(item.data.localId, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight);
                  }
                }}
                className="pointer-events-none h-full w-full rounded-lg object-cover"
              />
            )}
            <span
              className="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[11px] font-bold text-slate-900 shadow"
              data-testid={`badge-order-${position}`}
            >
              {position}
            </span>
            <button
              type="button"
              aria-label={`Remove image ${position}`}
              onClick={() => onRemove(item.sortKey)}
              className="absolute -right-1.5 -top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-sm transition-opacity focus-visible:opacity-100 group-hover/tile:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute bottom-1 left-1/2 z-10 flex -translate-x-1/2 gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover/tile:opacity-100">
              <button
                type="button"
                aria-label={`Move image ${position} earlier`}
                disabled={i === 0}
                onClick={() => onMove(item.sortKey, -1)}
                className={ARROW}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Move image ${position} later`}
                disabled={i === imageOrder.length - 1}
                onClick={() => onMove(item.sortKey, 1)}
                className={ARROW}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
