/**
 * QuoteCreateDialog
 *
 * A Dialog that wraps QuoteRHFForm for creating a new quote under
 * a given transaction.
 *
 * Usage:
 *   <QuoteCreateDialog
 *     transactionId={txnId}
 *     open={open}
 *     onOpenChange={setOpen}
 *     onSuccess={(newQuoteId) => navigate(`/quotes/${newQuoteId}`)}
 *   />
 */

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateQuote } from "@/hooks/mutations";
import { usePackageTypes } from "@/hooks/queries";
import { QuoteRHFForm } from "./quote-rhf-form";
import type { QuoteFormValues, QuoteCreateDialogProps } from "@/types/quote";
import { defaultQuoteFormValues } from "@/types/quote";
import type { CreateQuoteData } from "@/types/quote";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildDateTime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
}

/** Convert QuoteFormValues → CreateQuoteData API payload */
function buildCreatePayload(
  values: QuoteFormValues,
  transactionId: string,
  packageTypesData: { id: string; name: string }[] | undefined
): CreateQuoteData {
  const packageTypeName =
    packageTypesData?.find((p) => p.id === values.packageType)?.name || values.packageType;
  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && values.cruiseOnly);

  const commissionValue =
    ((Number(values.commission) || 0) / 100) * (Number(values.price) || 0);

  const payload: CreateQuoteData = {
    transaction_id: transactionId,
    holiday_type_id: values.packageType,
    travel_date: values.travelDate || "",
    quote_type: "manual",
    num_of_nights: values.nights,
    adult: values.passengersAdults,
    child: values.passengersChildren,
    infant: values.passengersInfants,
    sales_price: String(values.price || 0),
    package_commission: String(commissionValue),
    discounts: String(values.discount || 0),
    service_charge: String(values.serviceCharge || 0),
    price_per_person: String(values.pricePerPerson || 0),
    title: values.quoteTitle || undefined,
    quote_link: values.quoteLink || undefined,
    lead_source: values.leadSource || undefined,
    quote_status: values.status,
    main_tour_operator_id: values.tourOperatorId || undefined,
    transfer_type: values.transferType || undefined,
    pre_booked_seats: values.preBookedSeats || undefined,
    flight_meals: values.flightMeals === "Yes",
    country: values.country || undefined,
    destination: values.destination || undefined,
    resort: values.resort || undefined,
  };

  if (showFlights) {
    payload.outboundFlight = {
      departing_airport_id: values.outboundDepartAirportId || null,
      arrival_airport_id: values.outboundArriveAirportId || null,
      departure_date_time: buildDateTime(values.outboundDepartDate, values.outboundDepartTime),
      arrival_date_time: buildDateTime(values.outboundArriveDate, values.outboundArriveTime),
      flight_number: values.outboundFlightNumber || null,
    };
    payload.inboundFlight = {
      departing_airport_id: values.inboundDepartAirportId || null,
      arrival_airport_id: values.inboundArriveAirportId || null,
      departure_date_time: buildDateTime(values.inboundDepartDate, values.inboundDepartTime),
      arrival_date_time: buildDateTime(values.inboundArriveDate, values.inboundArriveTime),
      flight_number: values.inboundFlightNumber || null,
    };
    payload.outboundConnectingLegs = values.outboundConnectingLegs.map((leg) => ({
      departing_airport_id: leg.departAirportId || null,
      arrival_airport_id: leg.arriveAirportId || null,
      departure_date_time: buildDateTime(leg.departDate, leg.departTime),
      arrival_date_time: buildDateTime(leg.arriveDate, leg.arriveTime),
      flight_number: leg.flightNumber || null,
    }));
    payload.inboundConnectingLegs = values.inboundConnectingLegs.map((leg) => ({
      departing_airport_id: leg.departAirportId || null,
      arrival_airport_id: leg.arriveAirportId || null,
      departure_date_time: buildDateTime(leg.departDate, leg.departTime),
      arrival_date_time: buildDateTime(leg.arriveDate, leg.arriveTime),
      flight_number: leg.flightNumber || null,
    }));
  }

  if (!isHotTubBreak) {
    payload.primaryAccommodation = {
      accomodation_id: values.accommodationId || null,
      board_basis_id: values.boardBasisId || null,
      room_type: values.roomType || null,
      no_of_nights: values.nights || 0,
      check_in_date_time: buildDateTime(values.checkInDate, values.checkInTime),
    };
  }

  if (isHotTubBreak) {
    payload.lodge_id = values.lodgeCode || undefined;
    payload.pets = values.pets ? 1 : 0;
  }

  if (isCruise) {
    payload.cruiseTitle = values.cruiseTitle || undefined;
    payload.cruiseLine = values.cruiseLine || undefined;
    payload.shipName = values.shipName || undefined;
    payload.cruiseDate = values.cruiseDate || undefined;
    payload.cabinType = values.cabinType || undefined;
    payload.embarkation = values.embarkation || undefined;
    payload.debarkation = values.debarkation || undefined;
    payload.cruiseExtras = values.cruiseExtras || undefined;
    payload.cruiseOnly = values.cruiseOnly;
  }

  return payload;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuoteCreateDialog({
  transactionId,
  open,
  onOpenChange,
  onSuccess,
  initialValues,
}: QuoteCreateDialogProps) {
  const { toast } = useToast();
  const createQuote = useCreateQuote();
  const { data: packageTypesData } = usePackageTypes();

  const defaultValues: Partial<QuoteFormValues> = {
    ...defaultQuoteFormValues,
    ...initialValues,
  };

  const handleSubmit = async (values: QuoteFormValues) => {
    const payload = buildCreatePayload(values, transactionId, packageTypesData);
    createQuote.mutate(payload, {
      onSuccess: (newQuote) => {
        toast({ title: "Quote created", description: "New quote has been created." });
        onOpenChange(false);
        onSuccess?.(newQuote.id);
      },
      onError: (err) => {
        toast({
          title: "Failed to create quote",
          description: err instanceof Error ? err.message : "Something went wrong.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">New Quote</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Fill in the quote details, accommodation, flights, and pricing.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="px-6 pb-6">
            <QuoteRHFForm
              key={transactionId + open}   // re-mount on each open to get a fresh form
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isLoading={createQuote.isPending}
              submitLabel="Create Quote"
              onCancel={() => onOpenChange(false)}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
