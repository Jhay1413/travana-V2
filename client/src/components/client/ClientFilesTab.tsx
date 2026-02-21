import {
  ChevronRight,
  FileText,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { FileItem } from "./client-types";

interface UploadedFile {
  id: string;
  name: string;
  title: string;
  type: string;
  category: string;
  allocationType: string;
  allocationId: string;
  updated: string;
  url: string;
}

interface ClientFilesTabProps {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
  filteredFiles: FileItem[];
  onUploadFile: () => void;
  role: string;
}

export function ClientFilesTab({
  uploadedFiles,
  setUploadedFiles,
  filteredFiles,
  onUploadFile,
  role,
}: ClientFilesTabProps) {
  return (
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
        {uploadedFiles.map((f) => (
          <div
            key={f.id}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3 text-left transition hover:bg-black/[0.03]"
            data-testid={`row-file-uploaded-${f.id}`}
          >
            <button
              type="button"
              onClick={() => window.open(f.url, '_blank')}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-semibold" data-testid={`text-file-uploaded-name-${f.id}`}>
                  {f.title}
                </div>
                <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  {f.category}
                </span>
              </div>
              <div className="mt-1 text-xs text-black/55" data-testid={`text-file-uploaded-meta-${f.id}`}>
                {f.type} · {f.name} · {f.allocationType !== "None" ? `${f.allocationType}` : "Client level"} · {f.updated}
              </div>
            </button>
            <div className="flex items-center gap-2">
              {role === "Admin" && (
                <button
                  type="button"
                  onClick={() => setUploadedFiles((prev) => prev.filter((file) => file.id !== f.id))}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20"
                  data-testid={`button-delete-file-${f.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
            </div>
          </div>
        ))}
        {filteredFiles.map((f) => (
          <div
            key={f.id}
            className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/60 p-3"
            data-testid={`row-file-wide-${f.id}`}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold" data-testid={`text-file-wide-name-${f.id}`}>
                {f.name}
              </div>
              <div className="mt-1 text-xs text-black/55" data-testid={`text-file-wide-meta-${f.id}`}>
                {f.type} · Updated {f.updated}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {role === "Admin" && (
                <button
                  type="button"
                  onClick={() => { }}
                  className="rounded-xl border border-red-500/20 bg-red-500/10 p-1.5 text-red-600 transition hover:bg-red-500/20"
                  data-testid={`button-delete-file-wide-${f.id}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronRight className="h-4 w-4 text-black/35" aria-hidden />
            </div>
          </div>
        ))}
        {filteredFiles.length === 0 && uploadedFiles.length === 0 && (
          <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center">
            <div className="text-sm text-black/55">No files uploaded yet.</div>
          </div>
        )}
      </div>
    </Card>
  );
}
