interface QuoteExpiryPillProps {
  dateExpiry: string | Date | null | undefined;
  dateCreated: string | Date | null | undefined;
}

export function QuoteExpiryPill({ dateExpiry, dateCreated }: QuoteExpiryPillProps) {
  const now = new Date();
  const expiry = dateExpiry ? new Date(dateExpiry) : null;

  if (!expiry) {
    const created = dateCreated ? new Date(dateCreated) : null;
    if (created && now.getTime() - created.getTime() > 7 * 24 * 60 * 60 * 1000) {
      return (
        <span
          className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600"
          data-testid="pill-expiry-expired"
        >
          Expired
        </span>
      );
    }
    return null;
  }

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-red-500/25 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600"
        data-testid="pill-expiry-expired"
      >
        Expired
      </span>
    );
  }

  if (diffDays <= 2) {
    return (
      <span
        className="inline-flex items-center rounded-full border border-orange-500/25 bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600"
        data-testid="pill-expiry-soon"
      >
        Expires in {diffDays}d
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
      data-testid="pill-expiry-active"
    >
      Expires in {diffDays}d
    </span>
  );
}
