import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { PortalDocument } from "@shared/portal-documents";
import { viewDocument } from "../../api/use-portal-documents";
import {
  createObjectUrlHandle,
  PDF_ERROR_MESSAGES,
  VIEW_ERROR_MESSAGES,
  viewErrorHidesView,
  viewErrorKindOf,
  viewErrorOffersRetry,
  type PdfErrorKind,
  type ViewErrorKind,
} from "../../lib/document-viewer";
import { documentDetail } from "../../lib/booking-paperwork";
import { usePortalOverlayContainer } from "../../theme/PortalThemeProvider";
import { PortalButton } from "../brand";
import { PdfPages } from "./PdfPages";
import { useDocumentDownload } from "./use-document-download";

type ViewerState =
  | { phase: "loading" }
  | { phase: "image"; url: string }
  | { phase: "pdf"; blob: Blob }
  | { phase: "error"; kind: ViewErrorKind | PdfErrorKind; message: string; retry: boolean };

const TEXT_BUTTON = "inline-flex min-h-11 items-center text-[11px] font-normal uppercase tracking-[0.28em] text-white disabled:opacity-50";

function Opening() {
  return (
    <div className="flex size-full items-center justify-center" role="status" data-testid="viewer-doc-opening">
      <span className="text-[11px] uppercase tracking-[0.24em] text-white/70">Opening…</span>
    </div>
  );
}

/** The viewer's body for one open document: fetches it with the portal token and shows it, or says plainly why not. */
function ViewerBody({ doc, onUnavailable, onDownload }: { doc: PortalDocument; onUnavailable: (id: string) => void; onDownload: () => void }) {
  const [state, setState] = useState<ViewerState>({ phase: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const abort = new AbortController();
    let release: (() => void) | undefined;
    setState({ phase: "loading" });
    viewDocument(doc.id, abort.signal).then(
      (blob) => {
        if (abort.signal.aborted) return;
        if (doc.viewKind === "image") {
          const handle = createObjectUrlHandle(blob);
          release = handle.revoke;
          setState({ phase: "image", url: handle.url });
        } else {
          setState({ phase: "pdf", blob });
        }
      },
      (err: unknown) => {
        if (abort.signal.aborted) return;
        const kind = viewErrorKindOf(err);
        if (viewErrorHidesView(kind)) onUnavailable(doc.id);
        setState({ phase: "error", kind, message: VIEW_ERROR_MESSAGES[kind], retry: viewErrorOffersRetry(kind) });
      },
    );
    return () => {
      abort.abort();
      release?.();
    };
    // onUnavailable is a stable setter from the parent; the file and the retry counter are what restart the fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.viewKind, attempt]);

  if (state.phase === "error") {
    return (
      <div className="mt-3.5 flex min-h-0 flex-1 flex-col items-center justify-center gap-5 bg-[#0D2A4E] px-6 text-center" data-testid="viewer-doc-error">
        <p role="alert" className="max-w-sm text-sm leading-[1.6] text-white/90">
          {state.message}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {state.retry && (
            <PortalButton variant="light" size="xs" className="min-w-28" onClick={() => setAttempt((n) => n + 1)} data-testid="viewer-doc-retry">
              Retry
            </PortalButton>
          )}
          <PortalButton variant="light" size="xs" className="min-w-28" onClick={onDownload} data-testid="viewer-doc-error-download">
            Download
          </PortalButton>
        </div>
      </div>
    );
  }

  if (state.phase === "pdf") {
    return (
      <PdfPages
        blob={state.blob}
        onFailed={(kind) => {
          if (kind === "password" || kind === "corrupt") onUnavailable(doc.id);
          setState({ phase: "error", kind, message: PDF_ERROR_MESSAGES[kind], retry: kind === "failed" });
        }}
      />
    );
  }

  const detail = documentDetail(doc);
  return (
    <>
      <div className="relative mt-3.5 min-h-0 flex-1 bg-[#0D2A4E]">
        {state.phase === "loading" ? (
          <Opening />
        ) : (
          <img
            src={state.url}
            alt={doc.name}
            className="absolute inset-0 size-full object-contain"
            onError={() => setState({ phase: "error", kind: "failed", message: VIEW_ERROR_MESSAGES.failed, retry: true })}
            data-testid="viewer-doc-image"
          />
        )}
      </div>
      {detail && <div className="px-6 pt-[18px] text-[10px] uppercase tracking-[0.3em] text-accent">{detail}</div>}
    </>
  );
}

/**
 * Full-screen viewer for one of the customer's documents, in the style of the design's photo viewer: navy-deep screen,
 * a top bar with the name, "Download" and "Close", and the file on the lighter navy panel. PDFs are drawn by PDF.js,
 * pictures from an object URL; both are revoked/destroyed on close. Nothing is kept anywhere after it closes.
 */
export function DocumentViewer({
  doc,
  onClose,
  onUnavailable,
  returnFocus,
}: {
  /** The document to show, or null for closed. */
  doc: PortalDocument | null;
  onClose: () => void;
  /** The file turned out not to be viewable (too large, wrong type, gone, protected): the row stops offering View. */
  onUnavailable: (id: string) => void;
  /** Puts focus back where the viewer was opened from. */
  returnFocus: () => void;
}) {
  const container = usePortalOverlayContainer();
  return (
    <DialogPrimitive.Root open={doc !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal container={container ?? undefined}>
        {doc && <ViewerFrame doc={doc} onUnavailable={onUnavailable} returnFocus={returnFocus} />}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function ViewerFrame({ doc, onUnavailable, returnFocus }: { doc: PortalDocument; onUnavailable: (id: string) => void; returnFocus: () => void }) {
  const download = useDocumentDownload(doc);
  return (
    <DialogPrimitive.Content
      className="fixed inset-0 z-[63] flex flex-col bg-[hsl(var(--portal-navy-deep))] pb-6 pt-3.5 text-white focus:outline-none"
      onCloseAutoFocus={(e) => {
        // Radix would focus a Trigger, which this dialog does not have: put focus back on the button that opened it.
        e.preventDefault();
        returnFocus();
      }}
      data-testid="document-viewer"
    >
      <div className="flex items-start justify-between gap-4 px-6">
        <DialogPrimitive.Title
          className="portal-serif line-clamp-3 min-w-0 flex-1 py-2.5 text-xl font-normal leading-[1.2] text-white [overflow-wrap:anywhere]"
          data-testid="viewer-doc-title"
        >
          {doc.name}
        </DialogPrimitive.Title>
        <div className="flex flex-none items-center gap-5">
          <button type="button" className={TEXT_BUTTON} onClick={() => void download.run()} disabled={download.state.phase === "busy"} data-testid="viewer-doc-download">
            {download.label}
          </button>
          <DialogPrimitive.Close className={TEXT_BUTTON} data-testid="viewer-doc-close">
            Close
          </DialogPrimitive.Close>
        </div>
      </div>
      {download.state.phase === "error" && (
        <p role="alert" className="px-6 text-[13px] text-white/90" data-testid="viewer-doc-download-error">
          {download.state.message}
        </p>
      )}
      <DialogPrimitive.Description className="sr-only">
        {`${doc.name}. Press Escape or Close to go back to your documents.`}
      </DialogPrimitive.Description>
      <ViewerBody doc={doc} onUnavailable={onUnavailable} onDownload={() => void download.run()} />
    </DialogPrimitive.Content>
  );
}
