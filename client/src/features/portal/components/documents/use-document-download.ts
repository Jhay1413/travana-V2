import { useCallback, useEffect, useRef, useState } from "react";
import type { PortalDocument } from "@shared/portal-documents";
import { downloadDocument } from "../../api/use-portal-documents";

/** How long "Saved ✓" stays on the button before it offers the download again. */
const SAVED_MS = 4000;

export type DownloadState = { phase: "idle" } | { phase: "busy" } | { phase: "saved" } | { phase: "error"; message: string };

const FAILED = "We couldn't download that document. Please try again.";

/** One document's download button: the call, and the "Preparing…" / "Saved ✓" / error states shown for it. */
export function useDocumentDownload(doc: Pick<PortalDocument, "id" | "name">) {
  const [state, setState] = useState<DownloadState>({ phase: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const run = useCallback(async () => {
    if (state.phase === "busy") return;
    setState({ phase: "busy" });
    try {
      await downloadDocument(doc.id, doc.name);
      setState({ phase: "saved" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setState({ phase: "idle" }), SAVED_MS);
    } catch (e) {
      setState({ phase: "error", message: e instanceof Error && e.message ? e.message : FAILED });
    }
  }, [doc.id, doc.name, state.phase]);

  const label = state.phase === "saved" ? "Saved ✓" : state.phase === "busy" ? "Preparing…" : "Download";
  return { state, label, run };
}
