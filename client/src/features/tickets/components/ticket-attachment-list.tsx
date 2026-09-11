import { useMemo, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { getAttachmentDownloadUrl, isImageType, type TicketAttachment } from "@/features/attachment";

// Shared attachment display for a ticket post (the description or a reply):
// images render as small clickable thumbnails that open a lightbox over the
// full set, everything else as a file chip linking to the download. Used by
// both the tickets inbox thread panel and the client dashboard's tickets tab.

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TicketAttachmentList({
  attachments,
  onDelete,
  deletingId,
  compact = false,
}: {
  attachments: TicketAttachment[];
  /** Present only when the viewer is allowed to remove attachments from this post. */
  onDelete?: (id: string) => void;
  deletingId?: string | null;
  compact?: boolean;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const images = useMemo(() => attachments.filter((a) => isImageType(a.mimeType)), [attachments]);
  const files = useMemo(() => attachments.filter((a) => !isImageType(a.mimeType)), [attachments]);

  if (attachments.length === 0) return null;

  const lightboxImages = images.map((a) => ({
    id: a.id,
    url: `${getAttachmentDownloadUrl(a.id)}?inline=1`,
  }));

  return (
    <div className="mt-2 space-y-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((attachment, index) => (
            <div key={attachment.id} className="group relative" data-testid={`ticket-attachment-${attachment.id}`}>
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className={cn(
                  "block overflow-hidden rounded-lg border border-black/10 dark:border-white/10",
                  compact ? "h-14 w-14" : "h-20 w-20",
                )}
              >
                <img
                  src={`${getAttachmentDownloadUrl(attachment.id)}?inline=1`}
                  alt={attachment.originalName}
                  className="h-full w-full object-cover"
                />
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(attachment.id)}
                  disabled={deletingId === attachment.id}
                  aria-label="Remove attachment"
                  className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-60"
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((attachment) => (
            <div
              key={attachment.id}
              className="group flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-2.5 py-1.5 text-xs dark:border-white/10 dark:bg-white/[0.03]"
              data-testid={`ticket-attachment-${attachment.id}`}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-black/40 dark:text-white/40" />
              <a
                href={getAttachmentDownloadUrl(attachment.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[160px] truncate font-medium text-black/70 hover:underline dark:text-white/70"
              >
                {attachment.originalName}
              </a>
              <span className="text-black/40 dark:text-white/40">{formatFileSize(attachment.size)}</span>
              {onDelete && (
                <button
                  type="button"
                  onClick={() => onDelete(attachment.id)}
                  disabled={deletingId === attachment.id}
                  aria-label="Remove attachment"
                  className="text-black/30 opacity-0 transition hover:text-rose-600 group-hover:opacity-100 disabled:opacity-60 dark:text-white/30"
                >
                  {deletingId === attachment.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <ImageLightbox
          images={lightboxImages}
          open={lightboxIndex !== null}
          startIndex={lightboxIndex ?? 0}
          onOpenChange={(open) => setLightboxIndex(open ? (lightboxIndex ?? 0) : null)}
        />
      )}
    </div>
  );
}
