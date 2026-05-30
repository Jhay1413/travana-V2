import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, MapPin, Calendar, Eye, Inbox, ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import { usePortalQuotes, type PortalQuote } from "@/hooks/use-portal-api";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function CountdownTimer({ expiryDate }: { expiryDate: string }) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiryDate).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) setTimeLeft(`${days}d ${hours}h left`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m left`);
      else setTimeLeft(`${mins}m left`);
    };

    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [expiryDate]);

  const isExpired = timeLeft === "Expired";
  const isUrgent = !isExpired && timeLeft.includes("h") && !timeLeft.includes("d");

  return (
    <span className={`text-xs font-medium ${isExpired ? "text-red-400" : isUrgent ? "text-amber-400" : "text-white/50"}`} data-testid="text-countdown">
      <Clock className="w-3 h-3 inline mr-1" />
      {timeLeft}
    </span>
  );
}

function QuoteCardSkeleton() {
  return (
    <GlassCard className="overflow-hidden">
      <Skeleton className="h-40 rounded-none rounded-t-3xl" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </GlassCard>
  );
}

const fallbackQuotes: PortalQuote[] = [];

export default function PortalQuotesPage() {
  const [, setLocation] = useLocation();
  const { data: apiQuotes, isLoading, isError } = usePortalQuotes();
  const quotes = apiQuotes ?? (isError ? fallbackQuotes : []);
  const loading = isLoading;

  return (
    <PortalLayout>
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-quotes">
          <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70">My Quotes</span>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-purple-500/30 to-indigo-500/30 flex items-center justify-center">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <h1 className="text-xl font-bold text-white" data-testid="text-quotes-title">My Quotes</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <QuoteCardSkeleton />
            <QuoteCardSkeleton />
          </div>
        ) : quotes.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 font-medium mb-1" data-testid="text-empty-quotes">No quotes yet</p>
            <p className="text-white/40 text-sm">Your agent will send quotes here for you to review</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {quotes.map((quote, idx) => (
              <motion.div
                key={quote.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <GlassCard className="overflow-hidden" data-testid={`card-quote-${quote.id}`}>
                  <div className="relative h-40">
                    <img
                      src={quote.image_url}
                      alt={quote.destination}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid={`img-quote-${quote.id}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="text-white font-semibold text-lg leading-tight" data-testid={`text-quote-title-${quote.id}`}>{quote.title}</p>
                        <p className="text-white/60 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" /> {quote.destination}
                        </p>
                      </div>
                      <div className="text-right" data-testid={`text-quote-price-${quote.id}`}>
                        <div className="text-white font-bold text-lg leading-tight">{formatCurrency(quote.price)}</div>
                        {quote.price_per_person > 0 && (
                          <div className="text-white/70 text-xs">{formatCurrency(quote.price_per_person)} pp</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 text-white/50 text-xs">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(quote.travel_date)} — {formatDate(quote.return_date)}
                        </span>
                      </div>
                      <CountdownTimer expiryDate={quote.expiry_date} />
                    </div>
                    <p className="text-white/50 text-xs mb-3">{quote.hotel}</p>
                    <a
                      href={quote.quote_url}
                      className="w-full py-2.5 rounded-2xl bg-gradient-to-r from-purple-600/80 to-blue-600/80 text-white text-sm font-semibold flex items-center justify-center gap-2 hover:from-purple-600 hover:to-blue-600 transition-all"
                      data-testid={`button-view-quote-${quote.id}`}
                    >
                      <Eye className="w-4 h-4" /> View Quote
                    </a>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
