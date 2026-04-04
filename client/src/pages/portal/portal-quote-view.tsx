import { useRoute } from "wouter";
import { useEffect, useRef } from "react";
import { Loader2, X } from "lucide-react";
import {
  usePublicQuote,
  useLogQuoteView,
} from "@/hooks/queries/use-quote-public-queries";
import { PublicQuoteContent } from "@/pages/public-quote";

export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const { data: quote, isLoading, error } = usePublicQuote(token);
  const logView = useLogQuoteView();
  const viewLogged = useRef(false);

  useEffect(() => {
    if (token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center" data-testid="loading-portal-quote">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4" data-testid="error-portal-quote">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Quote Not Found</h1>
          <p className="text-white/50">This quote link may have expired or is no longer available.</p>
        </div>
      </div>
    );
  }

  return <PublicQuoteContent quote={quote} token={token} />;
}
