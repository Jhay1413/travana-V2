import { AlertCircle, Loader2, Paperclip, X as XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, type PendingAttachment } from "./use-attachments";

export interface AttachmentChipsProps {
  attachments: PendingAttachment[];
  onRemove(key: string): void;
}

// Staged files: uploaded on pick, so by send time these are just ids.
export function AttachmentChips({ attachments, onRemove }: AttachmentChipsProps) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="composer-attachments">
      {attachments.map((a) => (
        <span
          key={a.key}
          className={cn(
            "flex max-w-[220px] items-center gap-1.5 rounded-xl border px-2 py-1 text-xs",
            a.status === "error"
              ? "border-red-400/40 bg-red-500/5 text-red-600 dark:text-red-400"
              : "border-black/10 bg-black/[0.03] text-black/70 dark:border-white/10 dark:bg-white/[0.05] dark:text-white/70",
          )}
          title={a.status === "error" ? a.error : `${a.file.name} (${formatBytes(a.file.size)})`}
          data-testid={`composer-attachment-${a.key}`}
        >
          {a.status === "uploading" ? (
            <Loader2 className="h-3 w-3 flex-none animate-spin" />
          ) : a.status === "error" ? (
            <AlertCircle className="h-3 w-3 flex-none" />
          ) : (
            <Paperclip className="h-3 w-3 flex-none" />
          )}
          <span className="truncate">{a.file.name}</span>
          <span className="flex-none opacity-50">{formatBytes(a.file.size)}</span>
          <button
            type="button"
            onClick={() => onRemove(a.key)}
            className="flex-none opacity-50 transition hover:opacity-100"
            aria-label={`Remove ${a.file.name}`}
          >
            <XIcon className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
