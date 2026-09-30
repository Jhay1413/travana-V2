import { useMemo, useState } from "react";
import { FileText, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFileSize } from "@/lib/note-attachments";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useNoteAttachments } from "../api/use-note-attachment-queries";
import { useDeleteNoteAttachment } from "../api/use-note-attachment-mutations";
import { noteAttachmentApi } from "../api/note-attachment.api";
import type { NoteAttachment } from "../types";

// Mirrors features/tickets/components/ticket-attachment-list.tsx: images render
// as clickable thumbnails opening a lightbox, everything else as a file chip.

function NoteAttachmentList({
  attachments,
  onDelete,
  deletingId,
}: {
  attachments: NoteAttachment[];
  onDelete: (id: string) => void;
  deletingId: string | null;
}) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const images = useMemo(() => attachments.filter((a) => a.mimeType.startsWith("image/")), [attachments]);
  const files = useMemo(() => attachments.filter((a) => !a.mimeType.startsWith("image/")), [attachments]);

  const inlineUrl = (id: string) => `${noteAttachmentApi.getDownloadUrl(id)}?inline=1`;

  const removeButton = (attachment: NoteAttachment, className: string) => (
    <button
      type="button"
      onClick={() => onDelete(attachment.id)}
      disabled={deletingId === attachment.id}
      aria-label="Remove attachment"
      className={className}
      data-testid={`note-attachment-delete-${attachment.id}`}
    >
      {deletingId === attachment.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
    </button>
  );

  return (
    <div className="mt-1.5 space-y-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((attachment, index) => (
            <div key={attachment.id} className="group/att relative" data-testid={`note-attachment-${attachment.id}`}>
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="block h-14 w-14 overflow-hidden rounded-lg border border-black/10"
              >
                <img src={inlineUrl(attachment.id)} alt={attachment.originalName} className="h-full w-full object-cover" />
              </button>
              {removeButton(
                attachment,
                "absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-black/70 text-white opacity-0 transition group-hover/att:opacity-100 disabled:opacity-60",
              )}
            </div>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((attachment) => (
            <div
              key={attachment.id}
              className="group/att flex items-center gap-1.5 rounded-lg border border-black/10 bg-black/[0.02] px-2 py-1 text-[10px]"
              data-testid={`note-attachment-${attachment.id}`}
            >
              <FileText className="h-3 w-3 shrink-0 text-black/40" />
              <a
                href={noteAttachmentApi.getDownloadUrl(attachment.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="max-w-[160px] truncate font-medium text-black/70 hover:underline"
              >
                {attachment.originalName}
              </a>
              <span className="text-black/40">{formatFileSize(attachment.size)}</span>
              {removeButton(
                attachment,
                cn("text-black/30 opacity-0 transition hover:text-rose-600 group-hover/att:opacity-100 disabled:opacity-60"),
              )}
            </div>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <ImageLightbox
          images={images.map((a) => ({ id: a.id, url: inlineUrl(a.id) }))}
          open={lightboxIndex !== null}
          startIndex={lightboxIndex ?? 0}
          onOpenChange={(open) => setLightboxIndex(open ? (lightboxIndex ?? 0) : null)}
        />
      )}
    </div>
  );
}

/**
 * The saved attachments of one note or reply. Reads the deal's shared
 * attachment query (one request per deal) and picks out this note's files, so
 * it can be dropped under any note/reply body with just the two ids.
 */
export function NoteAttachments({ transactionId, noteId }: { transactionId: string; noteId: string }) {
  const { data } = useNoteAttachments(transactionId);
  const deleteMutation = useDeleteNoteAttachment(transactionId);
  const attachments = useMemo(() => (data ?? []).filter((a) => a.noteId === noteId), [data, noteId]);

  if (attachments.length === 0) return null;
  return (
    <NoteAttachmentList
      attachments={attachments}
      onDelete={(id) => deleteMutation.mutate(id)}
      deletingId={deleteMutation.isPending ? (deleteMutation.variables ?? null) : null}
    />
  );
}
