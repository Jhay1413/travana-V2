import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { attachmentApi } from "./attachment.api";
import { attachmentKeys } from "./use-attachment-queries";

export const PENDING_ATTACHMENT_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
export const PENDING_ATTACHMENT_MAX_SIZE = 10 * 1024 * 1024;

export interface UploadAllResult {
  uploaded: number;
  failed: number;
}

/**
 * Manages a composer's pending (not-yet-uploaded) attachment files: picking,
 * removing, and — once the ticket/reply they belong to exists — uploading
 * them all sequentially. Framework-agnostic aside from the React state/toast,
 * so it can be dropped into any composer (ticket replies, client dashboard
 * replies, …) without duplicating the file-picking logic.
 */
export function usePendingAttachments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);

  const addFiles = useCallback(
    (incoming: FileList | File[]) => {
      const accepted: File[] = [];
      for (const file of Array.from(incoming)) {
        if (!PENDING_ATTACHMENT_ALLOWED_TYPES.includes(file.type)) {
          toast({ title: `${file.name}: Only images and PDFs are allowed`, variant: "destructive" });
          continue;
        }
        if (file.size > PENDING_ATTACHMENT_MAX_SIZE) {
          toast({ title: `${file.name}: File too large (max 10MB)`, variant: "destructive" });
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length > 0) setFiles((prev) => [...prev, ...accepted]);
    },
    [toast],
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  const uploadAll = useCallback(
    async (ticketId: string, replyId?: string): Promise<UploadAllResult> => {
      let uploaded = 0;
      let failed = 0;
      for (const file of files) {
        try {
          await attachmentApi.upload(ticketId, file, replyId);
          uploaded++;
        } catch {
          failed++;
        }
      }
      if (uploaded > 0) {
        queryClient.invalidateQueries({ queryKey: attachmentKeys.byTicket(ticketId) });
      }
      setFiles([]);
      return { uploaded, failed };
    },
    [files, queryClient],
  );

  return { files, addFiles, removeFile, clear, uploadAll };
}
