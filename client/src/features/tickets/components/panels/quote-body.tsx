import { useQuote } from "@/hooks/queries";
import { formatCurrency } from "@/features/pipeline";
import { nightsLabel, positiveAmount } from "../../lib/holiday-format";
import { formatShortDate } from "../../lib/ticket-display";
import type { Operator } from "./booking-body";
import { HolidayView } from "./holiday-view";
import type { KvItem } from "./panel-parts";

/** The linked quote: name, status, dates, destination, hotel and price. */
export function QuoteBody({ quoteId, operator }: { quoteId: string; operator: Operator }) {
  const { data: quote, isLoading } = useQuote(quoteId);
  if (isLoading && !quote) return <p className="px-[18px] py-4 text-[12px] text-social-muted">Loading quote…</p>;
  if (!quote) return null;

  const primary = quote.accommodations?.find((a) => a.is_primary) ?? quote.accommodations?.[0];
  const date = formatShortDate(quote.travel_date);
  const nights = nightsLabel(quote.num_of_nights);
  const price = positiveAmount(quote.sales_price);

  const fields: KvItem[] = [];
  if (date) fields.push({ label: "Dates", value: nights ? `${date} · ${nights}` : date, span: 2, strong: true });
  else if (nights) fields.push({ label: "Nights", value: nights });
  if (primary?.accomodation_name) fields.push({ label: "Hotel", value: primary.accomodation_name, span: 2 });
  if (quote.destination_name) fields.push({ label: "Destination", value: quote.destination_name });
  if (price != null) fields.push({ label: "Price", value: formatCurrency(price), strong: true });

  return (
    <HolidayView
      model={{
        title: quote.title || "Quote",
        subtitle: [quote.destination_name, operator.name].filter(Boolean).join(" · ") || null,
        operatorName: operator.name,
        operatorLogoUrl: operator.logoUrl,
        status: quote.quote_status || null,
        refs: [],
        fields,
      }}
    />
  );
}
