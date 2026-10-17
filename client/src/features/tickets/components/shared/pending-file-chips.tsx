import { FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Chips for files picked but not uploaded yet, each with a remove button. */
export function PendingFileChips({
  files,
  onRemove,
  testIdPrefix,
  showSize = false,
  className,
}: {
  files: File[];
  onRemove: (index: number) => void;
  testIdPrefix: string;
  showSize?: boolean;
  className?: string;
}) {
  if (files.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {files.map((file, index) => {
        const Icon = file.type.startsWith("image/") ? ImageIcon : file.type === "application/pdf" ? FileText : Paperclip;
        return (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center gap-1.5 rounded-lg border border-social-border bg-muted/50 px-2 py-1 text-[12px]"
            data-testid={`${testIdPrefix}-${index}`}
          >
            <Icon className="h-3 w-3 text-social-muted" />
            <span className="max-w-[160px] truncate">{file.name}</span>
            {showSize && <span className="text-social-muted">{formatFileSize(file.size)}</span>}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="text-social-muted hover:text-status-failed-fg"
              aria-label={`Remove ${file.name}`}
              data-testid={`${testIdPrefix}-remove-${index}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
