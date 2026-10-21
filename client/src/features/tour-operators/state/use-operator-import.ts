import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { parseCsvText } from "@/lib/csv";
import { requestErrorMessage } from "@/lib/request-error";
import { useApplyImport, usePreviewImport } from "../api/use-tour-operators-manage";
import { importToast } from "../lib/import-preview";
import { IMPORT_MESSAGES, ImportFileError, checkFile, tableToImportRows } from "../lib/parse-import";
import type { ImportPreview, ImportRowInput } from "../types";

export interface PendingImport {
  fileName: string;
  rows: ImportRowInput[];
  preview: ImportPreview;
}

/** Upload flow: read the file, ask the server for a preview, then apply on confirm. */
export function useOperatorImport() {
  const { toast } = useToast();
  const previewMutation = usePreviewImport();
  const applyMutation = useApplyImport();
  const [pending, setPending] = useState<PendingImport | null>(null);

  const fail = useCallback((message: string) => toast({ title: message, variant: "destructive" }), [toast]);

  const pickFile = useCallback(
    async (file: File) => {
      let rows: ImportRowInput[];
      try {
        checkFile(file);
        rows = tableToImportRows(parseCsvText(await file.text()));
      } catch (err) {
        fail(err instanceof ImportFileError ? err.message : IMPORT_MESSAGES.readFailed);
        return;
      }
      try {
        const preview = await previewMutation.mutateAsync(rows);
        setPending({ fileName: file.name, rows, preview });
      } catch (err) {
        fail(requestErrorMessage(err, IMPORT_MESSAGES.readFailed));
      }
    },
    [fail, previewMutation],
  );

  const confirm = useCallback(async () => {
    if (!pending) return;
    try {
      const result = await applyMutation.mutateAsync(pending.rows);
      toast({ title: importToast(result) });
      setPending(null);
    } catch (err) {
      fail(requestErrorMessage(err, "We couldn't import that file. Please try again."));
    }
  }, [applyMutation, fail, pending, toast]);

  const cancel = useCallback(() => setPending(null), []);

  return { pending, pickFile, confirm, cancel, reading: previewMutation.isPending, importing: applyMutation.isPending };
}
