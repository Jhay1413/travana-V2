import { useRoute, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Home, ChevronRight, Loader2, X } from "lucide-react";
import PortalLayout from "./portal-layout";
import { usePublicQuote } from "@/hooks/queries/use-quote-public-queries";
import { PublicQuoteContent } from "@/pages/public-quote";
import { useLogPortalQuoteView, getPortalToken } from "@/hooks/use-portal-api";

export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const isAuthed = getPortalToken() !== null;
  const { data: quote, isLoading, error } = usePublicQuote(isAuthed ? token : "");
  const logView = useLogPortalQuoteView();
  const viewLogged = useRef(false);

  // This route is portal-only — unauthenticated visitors are sent to login.
  useEffect(() => {
    if (!isAuthed) {
      setLocation("/portal/login");
    }
  }, [isAuthed, setLocation]);

  useEffect(() => {
    if (isAuthed && token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [isAuthed, token]);

  if (!isAuthed) {
    return null;
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
