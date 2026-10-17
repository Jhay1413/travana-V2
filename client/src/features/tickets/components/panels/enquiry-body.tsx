import { formatCurrency } from "@/features/pipeline";
import type { EnquiryTable } from "@/features/quote/types";
import { nightsLabel, passengersLabel, positiveAmount } from "../../lib/holiday-format";
import { formatShortDate } from "../../lib/ticket-display";
import { HolidayView } from "./holiday-view";
import type { KvItem } from "./panel-parts";

/** The linked enquiry (nothing quoted or booked yet): type, dates, party, budget, destinations. */
export function EnquiryBody({ enquiry }: { enquiry: EnquiryTable }) {
  const date = formatShortDate(enquiry.travel_date);
  const nights = nightsLabel(enquiry.no_of_nights);
  const passengers = passengersLabel(enquiry);
  const budget = positiveAmount(enquiry.budget);
  const destinations = enquiry.destinations?.map((d) => d.name).filter(Boolean).join(", ") || null;

  const fields: KvItem[] = [];
  if (date) fields.push({ label: "Dates", value: nights ? `${date} · ${nights}` : date, span: 2, strong: true });
  else if (nights) fields.push({ label: "Nights", value: nights });
  if (passengers) fields.push({ label: "Party", value: passengers, span: 2 });
  if (budget != null) fields.push({ label: "Budget", value: `${formatCurrency(budget)}${enquiry.budget_type ? ` (${enquiry.budget_type})` : ""}`, span: 2 });
  if (destinations) fields.push({ label: "Destinations", value: destinations, span: 2 });

  return (
    <HolidayView
      model={{
        title: enquiry.title || "Enquiry",
        subtitle: enquiry.holiday_type_name || null,
        operatorName: null,
        operatorLogoUrl: null,
        status: enquiry.status || null,
        refs: [],
        fields,
      }}
    />
  );
}
