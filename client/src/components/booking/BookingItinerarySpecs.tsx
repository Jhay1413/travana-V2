import { formatUKDate, formatLeadSource } from "@/components/quote/quote-types";
import { CruiseSpecs } from "@/components/quote/CruiseSpecs";
import { SpecRow } from "@/components/ui/spec-row";

interface BookingItinerarySpecsProps {
  booking: any;
}

export function BookingItinerarySpecs({ booking }: BookingItinerarySpecsProps) {
  const packageType = booking.packageType?.toLowerCase() ?? "";

  if (packageType.includes("hot tub")) {
    return (
      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
          <SpecRow testId="travel-date" label="Travel Date" value={formatUKDate(booking.travelDate)} />
          <SpecRow testId="lodge-type" label="Lodge Type" value={booking.lodge?.type || "—"} />
          <SpecRow testId="pets" label="Pets" value={booking.pets} />
          <SpecRow
            testId="guests"
            label="Number of Guests"
            value={booking.passengers.adults + booking.passengers.children}
          />
        </div>
        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
          <SpecRow testId="operator" label="Tour Operator" value={booking.commissions.tourOperator} />
          <SpecRow
            testId="passengers"
            label="Passengers"
            value={
              <>
                {booking.passengers.adults} Adults
                {booking.passengers.children ? `, ${booking.passengers.children} Children` : ""}
              </>
            }
          />
          <SpecRow testId="nights" label="Number of Nights" value={booking.nights} />
          <SpecRow testId="lead-source" label="Lead Source" value={formatLeadSource(booking.leadSource)} />
        </div>
      </div>
    );
  }

  if (packageType.includes("cruise")) {
    return <CruiseSpecs cruise={booking.cruise} nights={booking.nights} passengers={booking.passengers} />;
  }

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
      <div className="grid content-start gap-2" data-testid="col-itinerary-left">
        <SpecRow testId="travel-date" label="Travel Date" value={formatUKDate(booking.travelDate)} />
        <SpecRow testId="hotel" label="Hotel" value={booking.accommodation.property} />
        <SpecRow testId="room" label="Room Type" value={booking.accommodation.roomType} />
        <SpecRow testId="board" label="Board Basis" value={booking.accommodation.board} />
        <SpecRow
          testId="transfer"
          label="Transfer Type"
          value={booking.transferType || "Private Transfer"}
        />
      </div>
      <div className="grid content-start gap-2" data-testid="col-itinerary-right">
        <SpecRow testId="operator" label="Tour Operator" value={booking.commissions.tourOperator} />
        <SpecRow
          testId="departure-airport"
          label="Departure Airport"
          value={booking.flights.outbound.from}
        />
        <SpecRow
          testId="passengers"
          label="Passengers"
          value={
            <>
              {booking.passengers.adults} Adults
              {booking.passengers.children
                ? `, ${booking.passengers.children} Children (${booking.passengers.childAges.join(", ")})`
                : ""}
            </>
          }
        />
        <SpecRow testId="nights" label="Number of Nights" value={booking.nights} />
        <SpecRow testId="lead-source" label="Lead Source" value={formatLeadSource(booking.leadSource)} />
      </div>
    </div>
  );
}
