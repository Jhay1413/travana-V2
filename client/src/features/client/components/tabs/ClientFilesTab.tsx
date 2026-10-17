import { useState } from "react";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ClientFileItem } from "@/features/client/types";
import { clientFileApi } from "@/api";

interface ClientFilesTabProps {
  clientFiles: ClientFileItem[];
  onDeleteFile: (id: string) => void;
  onUploadFile: () => void;
  role: string;
  /** Read-only roles can neither upload nor delete. */
  readOnly?: boolean;
}

function formatDate(d: string | Date | null) {
  if (!d) return "Unknown";
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fileExt(name: string) {
  return name.split(".").pop()?.toUpperCase() || "FILE";
}

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

function isPdfMime(mime: string) {
  return mime === "application/pdf";
}

export function ClientFilesTab({
  clientFiles,
  onDeleteFile,
  onUploadFile,
  role,
  readOnly = false,
}: ClientFilesTabProps) {
  const [previewFile, setPreviewFile] = useState<ClientFileItem | null>(null);

  // Inline URL renders in the dialog (image/PDF); download URL forces a save.
  const previewUrl = previewFile ? clientFileApi.getPreviewUrl(previewFile.id) : "";
  const downloadUrl = previewFile ? clientFileApi.getDownloadUrl(previewFile.id) : "";

  return (
    <>
      <div data-testid="list-files">
        {!readOnly && (
          <button
            type="button"
            onClick={onUploadFile}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-ticket-dashed text-sm font-medium text-social-muted transition hover:text-foreground"
            data-testid="button-files-upload"
          >
            <Paperclip className="h-4 w-4" strokeWidth={1.8} /> Add files
          </button>
        )}
        {clientFiles.map((f) => {
          const meta = [
            fileExt(f.originalName),
            f.allocationType || "Client level",
            f.uploadedByName || null,
            formatDate(f.createdAt),
          ]
            .filter(Boolean)
            .join(" · ");
          return (
            <div
              key={f.id}
              className="mt-0 flex items-center gap-3.5 border-t border-social-border py-4 first:mt-3"
              data-testid={`row-file-uploaded-${f.id}`}
            >
              <button type="button" onClick={() => setPreviewFile(f)} className="flex min-w-0 flex-1 items-center gap-3.5 text-left">
                <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[9px] bg-muted">
                  <FileText className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold" data-testid={`text-file-uploaded-name-${f.id}`}>
                      {f.title || f.originalName}
                    </span>
                    {f.category && (
                      <span className="shrink-0 rounded-full bg-status-scheduled-bg px-2 py-0.5 text-[10px] font-semibold text-status-scheduled-fg">
                        {f.category}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-social-muted" title={meta} data-testid={`text-file-uploaded-meta-${f.id}`}>
                    {meta}
                  </span>
                </span>
              </button>
              {role === "Admin" && !readOnly && (
                <button
                  type="button"
                  aria-label={`Delete ${f.originalName}`}
                  onClick={() => onDeleteFile(f.id)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-social-muted transition hover:bg-muted hover:text-destructive"
                  data-testid={`button-delete-file-${f.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          );
        })}
        {clientFiles.length === 0 && <p className="mt-3 border-t border-social-border py-6 text-sm text-social-muted">No files yet.</p>}
      </div>

      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
        <DialogContent className="max-w-4xl rounded-3xl p-0 overflow-hidden" data-testid="dialog-file-preview">
          <DialogHeader className="flex flex-row items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div className="min-w-0">
              <DialogTitle className="truncate text-base font-semibold">
                {previewFile?.title || previewFile?.originalName}
              </DialogTitle>
              {previewFile && (
                <div className="mt-1 text-xs text-black/55">
                  {fileExt(previewFile.originalName)} · {(previewFile.size / 1024).toFixed(1)} KB · {formatDate(previewFile.createdAt)}
                </div>
              )}
            </div>
            <a
              href={downloadUrl}
              download
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white transition hover:bg-black/90"
              data-testid="button-download-file"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </DialogHeader>

          <div className="flex min-h-[400px] items-center justify-center bg-black/[0.03] p-4">
            {previewFile && isImageMime(previewFile.mimeType) && (
              <img
                src={previewUrl}
                alt={previewFile.title || previewFile.originalName}
                className="max-h-[72vh] max-w-full rounded-xl object-contain"
                data-testid="img-file-preview"
              />
            )}
            {previewFile && isPdfMime(previewFile.mimeType) && (
              <iframe
                src={previewUrl}
                title={previewFile.title || previewFile.originalName}
                className="h-[72vh] w-full rounded-xl border-0"
                data-testid="iframe-file-preview"
              />
            )}
            {previewFile && !isImageMime(previewFile.mimeType) && !isPdfMime(previewFile.mimeType) && (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <FileText className="h-16 w-16 text-black/20" />
                <div className="text-sm font-medium text-black/60">
                  Preview not available for this file type
                </div>
                <div className="text-xs text-black/40">
                  {fileExt(previewFile.originalName)} file · Click Download to view
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
