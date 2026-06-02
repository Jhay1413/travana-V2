import { formatUKDate, formatLeadSource } from "@/components/quote/quote-types";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BookingItinerarySpecsProps {
  booking: any;
}

function SpecRow({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: React.ReactNode;
}) {
  const valueEl = (
    <div
      className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-black"
      data-testid={`text-itinerary-${testId}-value`}
    >
      {value}
    </div>
  );

  return (
    <div
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
      data-testid={`row-itinerary-${testId}`}
    >
      <div
        className="shrink-0 text-xs font-semibold text-black/65"
        data-testid={`text-itinerary-${testId}-label`}
      >
        {label}
      </div>
      {typeof value === "string" && value ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{valueEl}</TooltipTrigger>
            <TooltipContent className="max-w-[280px] break-words">{value}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        valueEl
      )}
    </div>
  );
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
    return (
      <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
        <div className="grid content-start gap-2" data-testid="col-itinerary-left">
          <SpecRow testId="travel-date" label="Travel Date" value={formatUKDate(booking.travelDate)} />
          <SpecRow testId="cruise-line" label="Cruise Line" value={booking.cruise?.cruiseLine || "—"} />
          <SpecRow testId="ship" label="Ship" value={booking.cruise?.ship || "—"} />
          <SpecRow testId="cabin-type" label="Cabin Type" value={booking.cruise?.cabinType || "—"} />
        </div>
        <div className="grid content-start gap-2" data-testid="col-itinerary-right">
          <SpecRow testId="operator" label="Tour Operator" value={booking.commissions.tourOperator} />
          <SpecRow
            testId="cruise-date"
            label="Cruise Date"
            value={booking.cruise?.cruiseDate ? formatUKDate(booking.cruise.cruiseDate) : "—"}
          />
          <SpecRow
            testId="pre-cruise"
            label="Pre-Cruise Stay"
            value={`${booking.cruise?.preCruiseStay || 0} nights`}
          />
          <SpecRow
            testId="post-cruise"
            label="Post-Cruise Stay"
            value={`${booking.cruise?.postCruiseStay || 0} nights`}
          />
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
        </div>
      </div>
    );
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
