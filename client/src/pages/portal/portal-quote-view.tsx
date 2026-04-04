import { useRoute, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Home, ChevronRight, Loader2, X } from "lucide-react";
import PortalLayout from "./portal-layout";
import {
  usePublicQuote,
  useLogQuoteView,
} from "@/hooks/queries/use-quote-public-queries";
import { PublicQuoteContent } from "@/pages/public-quote";

export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const { data: quote, isLoading, error } = usePublicQuote(token);
  const logView = useLogQuoteView();
  const viewLogged = useRef(false);

  useEffect(() => {
    if (token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [token]);

  return (
    <PortalLayout>
      <div className="px-4 pt-6">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-quote-view">
          <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <button onClick={() => setLocation("/portal/quotes")} className="text-white/40 hover:text-white/70 transition-colors">
            Quotes
          </button>
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
        <PublicQuoteContent quote={quote} token={token} />
      )}
    </PortalLayout>
  );
}
