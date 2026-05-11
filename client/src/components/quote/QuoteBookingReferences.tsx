interface QuoteBookingReferencesProps {
  quote: {
    status?: string;
    haysRef?: string | null;
    supplierRef?: string | null;
  };
}

export function QuoteBookingReferences({ quote }: QuoteBookingReferencesProps) {
  if (!(quote.status === "accepted" || quote.status === "BOOKED" || quote.haysRef || quote.supplierRef)) {
    return null;
  }

  return (
    <div
      className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3"
      data-testid="card-booking-references"
    >
      <div className="text-xs font-semibold text-emerald-800 mb-2">Booking References</div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div
          className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2"
          data-testid="row-hays-reference"
        >
          <div className="text-xs font-semibold text-black/65">HAYS Reference</div>
          <div className="text-xs font-semibold text-black" data-testid="text-hays-reference-value">
            {quote.haysRef || "—"}
          </div>
        </div>
        <div
          className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2"
          data-testid="row-tour-reference"
        >
          <div className="text-xs font-semibold text-black/65">Supplier Reference</div>
          <div className="text-xs font-semibold text-black" data-testid="text-tour-reference-value">
            {quote.supplierRef || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
