import { RefreshCw } from "lucide-react";

interface QuoteExpiryPillProps {
  dateExpiry: string | Date | null | undefined;
  dateCreated: string | Date | null | undefined;
  onUpdateExpiry?: (currentIsoDate: string) => void;
}

export function QuoteExpiryPill({ dateExpiry, dateCreated, onUpdateExpiry }: QuoteExpiryPillProps) {
  const now = new Date();
  const expiry = dateExpiry ? new Date(dateExpiry) : null;

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
        onClick={() => {
          const iso = dateExpiry ? new Date(dateExpiry).toISOString().split("T")[0] : "";
          onUpdateExpiry(iso);
        }}
        title="Update expiry"
        aria-label="Update expiry"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition ${colorMap[variant]}`}
        data-testid="button-update-expiry"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    );
  };

  if (!expiry) {
    const created = dateCreated ? new Date(dateCreated) : null;
    if (created && now.getTime() - created.getTime() > 7 * 24 * 60 * 60 * 1000) {
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
    return null;
  }

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
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

  if (diffDays <= 2) {
    return (
      <span className="inline-flex items-center gap-1">
        <span
          className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600"
          data-testid="pill-expiry-soon"
        >
          Expires in {diffDays}d
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
        Expires in {diffDays}d
      </span>
      {renderUpdateButton("emerald")}
    </span>
  );
}
