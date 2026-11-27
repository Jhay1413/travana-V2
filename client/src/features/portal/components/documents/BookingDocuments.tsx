import { useCallback, useRef, useState } from "react";
import type { PortalDocument } from "@shared/portal-documents";
import { usePortalDocuments } from "../../api/use-portal-documents";
import { DOCUMENTS_NOTE, documentDetail } from "../../lib/booking-paperwork";
import { canView } from "../../lib/document-viewer";
import { Eyebrow, PortalButton, PortalSection, SplitHeading } from "../brand";
import { DocumentViewer } from "./DocumentViewer";
import { useDocumentDownload } from "./use-document-download";

function DocumentIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="flex-none stroke-[hsl(var(--portal-amber-ink))]">
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6" />
    </svg>
  );
}

function DocumentRow({ doc, showView, onView }: { doc: PortalDocument; showView: boolean; onView: (doc: PortalDocument, opener: HTMLElement) => void }) {
  const { state, label, run } = useDocumentDownload(doc);
  const detail = documentDetail(doc);
  return (
    <li className="border-t border-border" data-testid={`document-${doc.id}`}>
      <div className="flex items-center gap-4 py-[18px]">
        <DocumentIcon />
        <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <span className="portal-serif text-xl leading-[1.2] text-primary [overflow-wrap:anywhere]" data-testid="document-name">
            {doc.name}
          </span>
          {detail && (
            <span className="text-[13px] leading-[1.5] text-muted-foreground" data-testid="document-detail">
              {detail}
            </span>
          )}
        </div>
        {/* Side by side; on a very narrow screen they stack so the name keeps room. Both keep their size. */}
        <div className="flex flex-none items-center gap-5 max-[400px]:flex-col max-[400px]:items-end max-[400px]:gap-0">
          {showView && (
            <PortalButton
              variant="link"
              className="flex-none whitespace-nowrap text-[11px] tracking-[0.2em]"
              onClick={(e) => onView(doc, e.currentTarget)}
              aria-label={`View ${doc.name}`}
              data-testid={`document-view-${doc.id}`}
            >
              View
            </PortalButton>
          )}
          <PortalButton
            variant="link"
            className="flex-none whitespace-nowrap text-[11px] tracking-[0.2em]"
            onClick={() => void run()}
            disabled={state.phase === "busy"}
            aria-label={`Download ${doc.name}`}
            data-testid={`document-download-${doc.id}`}
          >
            {label}
          </PortalButton>
        </div>
      </div>
      {state.phase === "error" && (
        <p role="alert" className="-mt-2 pb-4 pl-[38px] text-[13px] portal-text-danger" data-testid="document-error">
          {state.message}
        </p>
      )}
      {/* A polite announcement for screen readers; the visible word on the button is the sighted cue. */}
      <span className="sr-only" role="status">
        {state.phase === "saved" ? `${doc.name} saved` : ""}
      </span>
    </li>
  );
}

/** The design's "My documents / Your paperwork." section: the customer's files, each with a Download button. */
export function BookingDocuments({ bookingId }: { bookingId: string }) {
  const { data, isLoading, isError, refetch } = usePortalDocuments(bookingId);
  const docs = data ?? [];
  const [viewing, setViewing] = useState<PortalDocument | null>(null);
  // Files the viewer found it cannot show (too large, damaged, protected, gone): the row stops offering View.
  const [noView, setNoView] = useState<ReadonlySet<string>>(new Set());
  const opener = useRef<{ el: HTMLElement; id: string } | null>(null);

  const openViewer = useCallback((doc: PortalDocument, from: HTMLElement) => {
    opener.current = { el: from, id: doc.id };
    setViewing(doc);
  }, []);
  const markNoView = useCallback((id: string) => setNoView((prev) => new Set(prev).add(id)), []);
  const returnFocus = useCallback(() => {
    const from = opener.current;
    opener.current = null;
    if (!from) return;
    if (from.el.isConnected) {
      from.el.focus();
      return;
    }
    // The View button is gone (the file turned out not to be viewable): land on that row's Download instead.
    document.querySelector<HTMLElement>(`[data-testid="document-download-${from.id}"]`)?.focus();
  }, []);

  return (
    <PortalSection id="documents" aria-labelledby="booking-docs" className="pb-6 pt-[72px]" data-testid="booking-documents">
      <Eyebrow className="mb-3.5">My documents</Eyebrow>
      <SplitHeading id="booking-docs" lead="Your" italic="paperwork." className="mb-[26px]" />

      {isLoading && (
        <div className="animate-pulse border-t border-border" role="status" aria-label="Loading your documents" data-testid="documents-loading">
          {[0, 1].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border py-[18px]">
              <div className="size-[22px] bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-2/3 bg-secondary" />
                <div className="h-3 w-1/3 bg-secondary" />
              </div>
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="border-t border-border py-[18px]" data-testid="documents-error">
          <p className="text-[14px] leading-[1.6] text-muted-foreground">We couldn&apos;t load your documents.</p>
          <PortalButton variant="link" className="text-[11px] tracking-[0.2em]" onClick={() => void refetch()} data-testid="documents-retry">
            Try again
          </PortalButton>
        </div>
      )}

      {!isLoading && !isError && docs.length > 0 && (
        <ul data-testid="documents-list">
          {docs.map((d) => (
            <DocumentRow key={d.id} doc={d} showView={canView(d) && !noView.has(d.id)} onView={openViewer} />
          ))}
        </ul>
      )}

      {!isLoading && !isError && (
        <>
          <div className="border-t border-border" />
          <p className="mt-4 text-[13px] leading-[1.6] text-muted-foreground" data-testid="documents-note">
            {DOCUMENTS_NOTE}
          </p>
        </>
      )}
      <DocumentViewer doc={viewing} onClose={() => setViewing(null)} onUnavailable={markNoView} returnFocus={returnFocus} />
    </PortalSection>
  );
}
