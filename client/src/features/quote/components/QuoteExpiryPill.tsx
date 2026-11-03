import { RefreshCw } from "lucide-react";
import { getQuoteExpiryInfo } from "@/features/quote/lib/quote-expiry";
import { useLiveNow } from "@/features/quote/components/hooks/use-live-now";

interface QuoteExpiryPillProps {
  dateExpiry: string | Date | null | undefined;
  dateCreated: string | Date | null | undefined;
  /** A lost quote's expiry is no longer meaningful — suppresses the pill
   *  entirely so it doesn't disagree with a "Lost" badge shown elsewhere. */
  isLost?: boolean;
  onUpdateExpiry?: () => void;
}

export function QuoteExpiryPill({ dateExpiry, dateCreated, isLost, onUpdateExpiry }: QuoteExpiryPillProps) {
  // Re-derives every minute so a quote crossing its expiry while the page is
  // left open re-badges without waiting for a refetch.
  const now = useLiveNow();
  const info = isLost ? null : getQuoteExpiryInfo(dateExpiry, dateCreated, now);

  const renderUpdateButton = (variant: "red" | "orange" | "emerald") => {
    if (!onUpdateExpiry) return null;
    const colorMap = {
      red: "text-red-600 hover:bg-red-500/15",
      orange: "text-orange-600 hover:bg-orange-500/15",
      emerald: "text-emerald-700 hover:bg-emerald-500/15",
    } as const;
    return (
      <button
        type="button"
        onClick={onUpdateExpiry}
        title="Update expiry"
        aria-label="Update expiry"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${colorMap[variant]}`}
        data-testid="button-update-expiry"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    );
  };

  if (!info) return null;

  if (info.status === "expired") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600"
          data-testid="pill-expiry-expired"
        >
          Expired
        </span>
        {renderUpdateButton("red")}
      </span>
    );
  }

  if (info.status === "expiring-soon") {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600"
          data-testid="pill-expiry-soon"
        >
          {info.diffDays === 0 ? "Expires today" : `Expires in ${info.diffDays}d`}
        </span>
        {renderUpdateButton("orange")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
        data-testid="pill-expiry-active"
      >
        Expires in {info.diffDays}d
      </span>
      {renderUpdateButton("emerald")}
    </span>
  );
}
