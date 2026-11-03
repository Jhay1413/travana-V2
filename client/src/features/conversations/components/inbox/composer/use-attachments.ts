import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useUploadAttachment } from "../../../api/use-messages";
import { MAX_ATTACHMENT_BYTES } from "../../../api/messages.api";

// A file the user has picked. Uploaded to SendSeven as soon as it's chosen, so
// the id is ready by the time they hit send (see docs.sendseven.com two-phase
// attachment flow: upload → id → reference the id on the message).
export interface PendingAttachment {
  key: string;
  file: File;
  status: "uploading" | "ready" | "error";
  id?: string;
  // MIME type as validated by SendSeven at upload (magic-byte checked), which
  // decides the message_type of the send; file.type is only the fallback.
  contentType?: string;
  error?: string;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useAttachments() {
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const uploadAttachment = useUploadAttachment();
  const { toast } = useToast();

  const uploading = attachments.some((a) => a.status === "uploading");
  const ready = attachments.filter((a) => a.status === "ready" && a.id);

  const pickFiles = (fileList: FileList | null) => {
    if (!fileList?.length) return;
    for (const file of Array.from(fileList)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast({
          title: "File too large",
          description: `${file.name} is ${formatBytes(file.size)} — the limit is 50MB.`,
          variant: "destructive",
        });
        continue;
      }
      const key = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
      setAttachments((prev) => [...prev, { key, file, status: "uploading" }]);
      uploadAttachment
        .mutateAsync(file)
        .then((uploaded) =>
          setAttachments((prev) =>
            prev.map((a) =>
              a.key === key ? { ...a, status: "ready", id: uploaded.id, contentType: uploaded.content_type } : a,
            ),
          ),
        )
        .catch((err: Error) =>
          setAttachments((prev) =>
            prev.map((a) => (a.key === key ? { ...a, status: "error", error: err.message } : a)),
          ),
        );
    }
  };

  const removeAttachment = (key: string) => setAttachments((prev) => prev.filter((a) => a.key !== key));
  const clearAttachments = () => setAttachments([]);

  return { attachments, uploading, ready, pickFiles, removeAttachment, clearAttachments };
}
