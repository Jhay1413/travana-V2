import { formatUKDate, formatLeadSource } from "@/features/quote/components/quote-types";
import { CruiseSpecs } from "@/features/quote/components/CruiseSpecs";
import { SpecRow } from "@/components/ui/spec-row";

interface QuoteItinerarySpecsProps {
  quote: any;
  quoteData: any;
}

function passengersLabel(p: { adults: number; children: number; childAges?: number[] }, includeAges: boolean) {
  if (!p.children) return `${p.adults} Adults`;
  const childPart = includeAges
    ? `, ${p.children} Children${p.childAges?.length ? ` (${p.childAges.join(", ")})` : ""}`
    : `, ${p.children} Children (${p.childAges?.join(", ") ?? ""})`;
  return `${p.adults} Adults${childPart}`;
}

export function QuoteItinerarySpecs({ quote, quoteData }: QuoteItinerarySpecsProps) {
  const packageType = quote.packageType?.toLowerCase() ?? "";

  if (packageType.includes("hot tub")) {
    return (
      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
          <SpecRow testId="travel-date" label="Travel Date" value={formatUKDate(quote.travelDate)} />
          <SpecRow testId="lodge-type" label="Lodge Type" value={quote.lodge?.type || "—"} />
          <SpecRow testId="pets" label="Pets" value={quote.pets} />
          <SpecRow
            testId="guests"
            label="Number of Guests"
            value={quote.passengers.adults + quote.passengers.children}
          />
        </div>
        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
          <SpecRow testId="operator" label="Tour Operator" value={quote.commissions.tourOperator} />
          <SpecRow
            testId="passengers"
            label="Passengers"
            value={passengersLabel(quote.passengers, true)}
          />
          <SpecRow testId="nights" label="Number of Nights" value={quote.nights} />
          <SpecRow testId="lead-source" label="Lead Source" value={formatLeadSource(quote.leadSource)} />
          {quoteData?.lodge_code && (
            <SpecRow testId="lodge-code" label="Lodge Code" value={quoteData.lodge_code} />
          )}
        </div>
      </div>
    );
  }

  if (packageType.includes("cruise")) {
    return <CruiseSpecs cruise={quote.cruise} nights={quote.nights} passengers={quote.passengers} />;
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
      <div className="grid content-start gap-2" data-testid="col-itinerary-left">
        <SpecRow testId="travel-date" label="Travel Date" value={formatUKDate(quote.travelDate)} />
        <SpecRow testId="hotel" label="Hotel" value={quote.accommodation.property} />
        <SpecRow testId="room" label="Room Type" value={quote.accommodation.roomType} />
        <SpecRow testId="board" label="Board Basis" value={quote.accommodation.board} />
        <SpecRow
          testId="transfer"
          label="Transfer Type"
          value={quote.transferType || "Private Transfer"}
        />
      </div>
      <div className="grid content-start gap-2" data-testid="col-itinerary-right">
        <SpecRow testId="operator" label="Tour Operator" value={quote.commissions.tourOperator} />
        <SpecRow testId="departure-airport" label="Departure Airport" value={quote.flights.outbound.from} />
        <SpecRow
          testId="passengers"
          label="Passengers"
          value={passengersLabel(quote.passengers, false)}
        />
        <SpecRow testId="nights" label="Number of Nights" value={quote.nights} />
        <SpecRow testId="lead-source" label="Lead Source" value={formatLeadSource(quote.leadSource)} />
      </div>
    </div>
  );
}
