import { useEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { NEUTRAL_BRANDING } from "@/features/portal";
import { PublicQuoteBlocked, PublicQuoteLoadError, PublicQuoteLoading, PublicQuoteNotFound, PublicQuoteView, agencyToBranding } from "@/features/public-quote";
import { isPreviewSearch } from "@/features/quote/lib/preview-search";
import { useLogQuoteView, usePublicQuote, useShareQuote, type ShareMethod } from "@/features/quote/api/use-quote-public-queries";
import { getPortalToken, usePortalQuoteOwnership } from "@/hooks/use-portal-api";

/** Keeps crawlers that run scripts away from the page (the server also sends X-Robots-Tag). */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex";
    document.head.appendChild(meta);
    return () => {
      meta.remove();
    };
  }, []);
}

/** The public quote link: wiring only. The screens are in features/public-quote. */
export default function PublicQuotePage() {
  useNoIndex();
  const [, params] = useRoute("/view-quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const isPortalAuthed = getPortalToken() !== null;
  const wantsPreview = isPreviewSearch(window.location.search);

  // When the viewer is signed in to the client portal AND this quote belongs to
  // them, send them to the authenticated portal view (which additionally lets
  // them decide on it). Everyone else — logged-out visitors, and portal users
  // opening a quote shared by someone else — stays on the public view, so
  // shared "friends & family" links keep working.
  const ownershipQ = usePortalQuoteOwnership(isPortalAuthed ? token : "");
  const ownsQuote = isPortalAuthed && ownershipQ.data?.found === true && ownershipQ.data.owns === true;
  const ownershipPending = isPortalAuthed && ownershipQ.isLoading;
  const shouldRenderPublic = !ownsQuote && !ownershipPending;

  useEffect(() => {
    if (ownsQuote) setLocation(`/portal/quote/${token}`);
  }, [ownsQuote, token, setLocation]);

  // The quote is only fetched (and its view logged) once we've decided the
  // viewer stays on the public page — owners are redirected before this runs.
  const { data: result, isLoading, error, refetch } = usePublicQuote(shouldRenderPublic ? token : "", wantsPreview);
  const logView = useLogQuoteView();
  const shareQuote = useShareQuote();
  const viewLogged = useRef(false);

  // A view is recorded once per visit, for an open quote seen as a customer would see it: never for a staff preview, never for a blocked quote.
  useEffect(() => {
    if (result?.kind === "quote" && !result.isStaffPreview && !viewLogged.current && token) {
      viewLogged.current = true;
      logView.mutate({ token });
    }
  }, [result, token]);

  // Verifying portal ownership, or redirecting an owner to the portal view.
  if (ownershipPending || ownsQuote || isLoading) return <PublicQuoteLoading branding={NEUTRAL_BRANDING} />;

  if (result?.kind === "blocked") return <PublicQuoteBlocked block={result.block} branding={agencyToBranding(result.block.agency)} />;

  if (error || !result) {
    const status = (error as { status?: number } | null)?.status;
    if (status === 404 || !error) return <PublicQuoteNotFound branding={NEUTRAL_BRANDING} />;
    return <PublicQuoteLoadError branding={NEUTRAL_BRANDING} onRetry={() => void refetch()} />;
  }

  const { quote, isStaffPreview, previewBlock } = result;
  // A staff preview shares without telling anyone: no share is recorded and the agent is not notified.
  const recordShare = (method: ShareMethod) => {
    if (!isStaffPreview) shareQuote.mutate({ token, method });
  };

  return <PublicQuoteView quote={quote} token={token} isStaffPreview={isStaffPreview} previewBlock={previewBlock} onShared={recordShare} />;
}
