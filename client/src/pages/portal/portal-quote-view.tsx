import { useRoute, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Home, ChevronRight, Loader2, X } from "lucide-react";
import PortalLayout from "./portal-layout";
import { usePublicQuote } from "@/features/quote/api/use-quote-public-queries";
import { PublicQuoteContent } from "@/pages/public-quote";
import { useLogPortalQuoteView, usePortalQuoteOwnership, getPortalToken } from "@/hooks/use-portal-api";

export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const isAuthed = getPortalToken() !== null;

  // Ownership guard — a logged-in client may only view their own quote.
  const ownershipQ = usePortalQuoteOwnership(isAuthed ? token : "");
  // A portal deal is a free quote published to the portal: nobody owns it, so it
  // is viewable by any signed-in client. Treated as viewable here, otherwise the
  // ownership guard below bounces every "View Deal" click to the quotes list.
  const isPublicDeal = ownershipQ.data?.isPublicDeal === true;
  const ownsQuote =
    isAuthed && ownershipQ.data?.found === true && (ownershipQ.data.owns === true || isPublicDeal);
  const notOwned =
    isAuthed && ownershipQ.data?.found === true && ownershipQ.data.owns === false && !isPublicDeal;
  const notFound = isAuthed && ownershipQ.data?.found === false;

  // The quote payload is only fetched once ownership is confirmed.
  const { data: quote, isLoading, error } = usePublicQuote(ownsQuote ? token : "");
  const logView = useLogPortalQuoteView();
  const viewLogged = useRef(false);

  // This route is portal-only — unauthenticated visitors are sent to login,
  // carrying this quote as the post-login destination so they land back here.
  useEffect(() => {
    if (!isAuthed) {
      const next = encodeURIComponent(`/portal/quote/${token}`);
      setLocation(`/portal/login?next=${next}`);
    }
  }, [isAuthed, setLocation, token]);

  // Logged in, but this quote belongs to someone else — bounce them to their
  // own quotes list rather than showing it.
  useEffect(() => {
    if (notOwned) {
      setLocation("/portal/quotes");
    }
  }, [notOwned, setLocation]);

  useEffect(() => {
    if (ownsQuote && token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [ownsQuote, token]);

  if (!isAuthed || notOwned) {
    return null;
  }

  // Verifying ownership (or quote not found / inaccessible to this client).
  if (!ownsQuote) {
    return (
      <PortalLayout>
        {notFound || ownershipQ.isError ? (
          <div className="flex items-center justify-center py-20 px-4" data-testid="error-portal-quote">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Quote Not Found</h1>
              <p className="text-white/50">This quote link may have expired or is no longer available.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20" data-testid="loading-portal-quote-access">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
              <p className="text-white/30 text-sm">Checking access...</p>
            </div>
          </div>
        )}
      </PortalLayout>
    );
  }

  return (
    <PortalLayout>
      <div className="relative z-50 px-4 pt-6">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-quote-view">
          <a href="/portal" onClick={(e) => { e.preventDefault(); setLocation("/portal"); }} className="text-purple-400/70 hover:text-purple-300 transition-colors flex items-center gap-1 underline underline-offset-2 cursor-pointer">
            <Home className="w-3 h-3" /> Home
          </a>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <a href="/portal/quotes" onClick={(e) => { e.preventDefault(); setLocation("/portal/quotes"); }} className="text-purple-400/70 hover:text-purple-300 transition-colors underline underline-offset-2 cursor-pointer">
            Quotes
          </a>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70 truncate max-w-[150px]">{quote?.title || "Quote"}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20" data-testid="loading-portal-quote">
          <div className="text-center">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
            <p className="text-white/30 text-sm">Loading your quote...</p>
          </div>
        </div>
      ) : error || !quote ? (
        <div className="flex items-center justify-center py-20 px-4" data-testid="error-portal-quote">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">Quote Not Found</h1>
            <p className="text-white/50">This quote link may have expired or is no longer available.</p>
          </div>
        </div>
      ) : (
        <PublicQuoteContent quote={quote} token={token} isPortal />
      )}
    </PortalLayout>
  );
}
