import { useState } from "react";
import {
  ChevronRight,
  Download,
  FileText,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FileItem } from "../client-types";
import type { ClientFile } from "@shared/schema";
import { clientFileApi } from "@/api";

interface ClientFilesTabProps {
  clientFiles: ClientFile[];
  onDeleteFile: (id: string) => void;
  filteredFiles?: FileItem[];
  onUploadFile: () => void;
  role: string;
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
  filteredFiles,
  onUploadFile,
  role,
}: ClientFilesTabProps) {
  const [previewFile, setPreviewFile] = useState<ClientFile | null>(null);

  const previewUrl = previewFile ? clientFileApi.getDownloadUrl(previewFile.id) : "";

  return (
    <>
      <Card className="rounded-3xl border-black/10 bg-white/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold" data-testid="text-files-title">
              Files
            </div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-files-subtitle">
              Upload and manage client documents.
            </div>
          </div>
          <Button
            size="sm"
            className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90"
            data-testid="button-files-upload"
            onClick={onUploadFile}
          >
            <FileText className="mr-2 h-4 w-4" />
            Upload File
          </Button>
        </div>

        <div className="mt-4 grid gap-3" data-testid="list-files">
          {clientFiles.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPreviewFile(f)}
              className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03]"
              data-testid={`row-file-uploaded-${f.id}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold" data-testid={`text-file-uploaded-name-${f.id}`}>
                    {f.title || f.originalName}
                  </div>
                  {f.category && (
                    <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {f.category}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-black/55" data-testid={`text-file-uploaded-meta-${f.id}`}>
                  {fileExt(f.originalName)} · {f.originalName} · {f.allocationType || "Client level"} · {formatDate(f.createdAt)}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {role === "Admin" && (
                  <span
                    role="button"
                    onClick={(e) => { e.stopPropagation(); onDeleteFile(f.id); }}
                    className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20"
                    data-testid={`button-delete-file-${f.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
              </div>
            </button>
          ))}
          {clientFiles.length === 0 && (
            <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
              <div className="text-sm text-black/55">No files uploaded yet.</div>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }}>
        <DialogContent className="max-w-2xl rounded-3xl p-0 overflow-hidden" data-testid="dialog-file-preview">
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
              href={previewUrl}
              download
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-2xl bg-black px-4 text-sm font-medium text-white transition hover:bg-black/90"
              data-testid="button-download-file"
            >
              <Download className="h-4 w-4" />
              Download
            </a>
          </DialogHeader>

          <div className="flex min-h-[300px] items-center justify-center bg-black/[0.03] p-4">
            {previewFile && isImageMime(previewFile.mimeType) && (
              <img
                src={previewUrl}
                alt={previewFile.title || previewFile.originalName}
                className="max-h-[60vh] max-w-full rounded-xl object-contain"
                data-testid="img-file-preview"
              />
            )}
            {previewFile && isPdfMime(previewFile.mimeType) && (
              <iframe
                src={previewUrl}
                title={previewFile.title || previewFile.originalName}
                className="h-[60vh] w-full rounded-xl border-0"
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
