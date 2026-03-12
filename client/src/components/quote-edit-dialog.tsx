/**
 * QuoteEditDialog
 *
 * A Dialog that wraps QuoteRHFForm for editing an existing quote.
 * Fetches quote data internally by quoteId, pre-populates the form,
 * then calls useUpdateQuote on submit.
 *
 * Usage:
 *   <QuoteEditDialog
 *     quoteId={quoteId}
 *     open={open}
 *     onOpenChange={setOpen}
 *     onSuccess={() => refetch()}
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
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useUpdateQuote } from "@/hooks/mutations";
import { useUploadQuoteImages, useAddQuoteImageUrls } from "@/hooks/mutations/use-quote-image-mutations";
import { useQuote } from "@/hooks/queries";
import { usePackageTypes } from "@/hooks/queries";
import { QuoteRHFForm } from "./quote-rhf-form";
import { defaultQuoteFormValues } from "@/types/quote";
import type { QuoteEditDialogProps, QuoteFormValues } from "@/types/quote";
import type { EnrichedQuote } from "@/types/quote";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function splitDateTime(iso: string | undefined | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const tIdx = iso.indexOf("T");
  if (tIdx === -1) return { date: iso, time: "" };
  return {
    date: iso.substring(0, tIdx),
    time: iso.substring(tIdx + 1).substring(0, 5),
  };
}

function buildDefaultValues(quoteData: EnrichedQuote): QuoteFormValues {
  const flights = quoteData.flights || [];
  const outboundFlights = flights
    .filter((f) => f.flight_type === "outbound")
    .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
  const inboundFlights = flights
    .filter((f) => f.flight_type === "inbound")
    .sort((a, b) => (a.leg_order ?? 0) - (b.leg_order ?? 0));

  const outbound = outboundFlights[0];
  const inbound = inboundFlights[0];

  const accommodations = quoteData.accommodations || [];
  const primaryAccom = accommodations.find((a) => a.is_primary) || accommodations[0];

  const outDep = splitDateTime(outbound?.departure_date_time);
  const outArr = splitDateTime(outbound?.arrival_date_time);
  const inDep = splitDateTime(inbound?.departure_date_time);
  const inArr = splitDateTime(inbound?.arrival_date_time);

  const checkIn = splitDateTime(primaryAccom?.check_in_date_time);

  const salesPrice = parseFloat(String(quoteData.sales_price || 0)) || 0;
  const commission = parseFloat(String(quoteData.package_commission || 0)) || 0;
  const discounts = parseFloat(String(quoteData.discounts || 0)) || 0;
  const serviceCharge = parseFloat(String(quoteData.service_charge || 0)) || 0;
  const pricePerPerson = parseFloat(String(quoteData.price_per_person || 0)) || 0;

  return {
    ...defaultQuoteFormValues,
    // Overview
    packageType: quoteData.holiday_type_id || "",
    quoteTitle: quoteData.title || "",
    quoteLink: quoteData.quote_ref as string || "",
    leadSource: quoteData.lead_source || "",
    status: quoteData.quote_status || "draft",
    tourOperatorId: quoteData.main_tour_operator_id || "",

    // Travel
    travelDate: quoteData.travel_date?.toString().split("T")[0] || "",
    nights: quoteData.num_of_nights || 7,
    passengersAdults: quoteData.adult || 2,
    passengersChildren: quoteData.child || 0,
    passengersInfants: quoteData.infant || 0,
    transferType: quoteData.transfer_type || "",
    preBookedSeats: quoteData.pre_booked_seats || "",
    flightMeals: quoteData.flight_meals ? "Yes" : "",

    // Destination
    country: quoteData.country_id || "",
    destination: quoteData.destination_id || "",
    resort: quoteData.resort_id || "",
    accommodationId: primaryAccom?.accomodation_id || "",
    boardBasisId: primaryAccom?.board_basis_id || "",
    checkInDate: checkIn.date,
    checkInTime: checkIn.time,
    roomType: primaryAccom?.room_type || "",
   

    // Outbound flight
    outboundDepartAirportId: outbound?.departing_airport_id || "",
    outboundArriveAirportId: outbound?.arrival_airport_id || "",
    outboundDepartDate: outDep.date,
    outboundDepartTime: outDep.time,
    outboundArriveDate: outArr.date,
    outboundArriveTime: outArr.time,
    outboundFlightNumber: outbound?.flight_number || "",
    outboundConnectingLegs: outboundFlights.slice(1).map((f) => {
      const dep = splitDateTime(f.departure_date_time);
      const arr = splitDateTime(f.arrival_date_time);
      return {
        departAirportId: f.departing_airport_id || "",
        departAirport: "",
        arriveAirportId: f.arrival_airport_id || "",
        arriveAirport: "",
        departDate: dep.date,
        departTime: dep.time,
        arriveDate: arr.date,
        arriveTime: arr.time,
        flightNumber: f.flight_number || "",
      };
    }),

    // Inbound flight
    inboundDepartAirportId: inbound?.departing_airport_id || "",
    inboundArriveAirportId: inbound?.arrival_airport_id || "",
    inboundDepartDate: inDep.date,
    inboundDepartTime: inDep.time,
    inboundArriveDate: inArr.date,
    inboundArriveTime: inArr.time,
    inboundFlightNumber: inbound?.flight_number || "",
    inboundConnectingLegs: inboundFlights.slice(1).map((f) => {
      const dep = splitDateTime(f.departure_date_time);
      const arr = splitDateTime(f.arrival_date_time);
      return {
        departAirportId: f.departing_airport_id || "",
        departAirport: "",
        arriveAirportId: f.arrival_airport_id || "",
        arriveAirport: "",
        departDate: dep.date,
        departTime: dep.time,
        arriveDate: arr.date,
        arriveTime: arr.time,
        flightNumber: f.flight_number || "",
      };
    }),

    // Lodge
    parkId: quoteData.park_id || "",
    lodgeId: quoteData.lodge_id || "",
    pets: (quoteData.pets ?? 0) > 0,

    // Pricing
    price: salesPrice,
    commission: commission,
    discount: discounts,
    serviceCharge: serviceCharge,
    pricePerPerson: pricePerPerson,
  };
}

function buildUpdatePayload(
  values: QuoteFormValues,
  packageTypesData: { id: string; name: string | null }[] | undefined
) {
  const packageTypeName =
    packageTypesData?.find((p) => p.id === values.packageType)?.name || values.packageType;
  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && values.cruiseOnly);

  const buildDateTime = (date: string, time: string) => {
    if (!date) return null;
    return time ? `${date}T${time}:00` : `${date}T00:00:00`;
  };

  const commissionValue = Number(values.commission) || 0;

  const payload: Record<string, unknown> = {
    holiday_type_id: values.packageType || null,
    title: values.quoteTitle || null,
    quote_ref: values.quoteLink || null,
    lead_source: values.leadSource || null,
    quote_status: values.status,
    main_tour_operator_id: values.tourOperatorId || null,
    travel_date: values.travelDate || null,
    num_of_nights: values.nights,
    adult: values.passengersAdults,
    child: values.passengersChildren,
    infant: values.passengersInfants,
    transfer_type: values.transferType || null,
    pre_booked_seats: values.preBookedSeats || null,
    flight_meals: values.flightMeals === "Yes",
    sales_price: String(values.price || 0),
    package_commission: String(commissionValue),
    discounts: String(values.discount || 0),
    service_charge: String(values.serviceCharge || 0),
    price_per_person: String(values.pricePerPerson || 0),
    country: values.country || null,
    destination: values.destination || null,
    resort: values.resort || null,
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
    payload.lodge_id = values.lodgeId || null;
    payload.pets = values.pets ? 1 : 0;
  }

  if (isCruise) {
    payload.cruiseTitle = values.cruiseTitle || null;
    payload.cruiseLine = values.cruiseLine || null;
    payload.shipName = values.shipName || null;
    payload.cruiseDate = values.cruiseDate || null;
    payload.cabinType = values.cabinType || null;
    payload.embarkation = values.embarkation || null;
    payload.debarkation = values.debarkation || null;
    payload.cruiseExtras = values.cruiseExtras || null;
    payload.cruiseOnly = values.cruiseOnly;
  }

  return payload;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QuoteEditDialog({
  quoteId,
  open,
  onOpenChange,
  onSuccess,
}: QuoteEditDialogProps) {
  const { toast } = useToast();
  const updateQuote = useUpdateQuote();
  const uploadImages = useUploadQuoteImages();
  const addImageUrls = useAddQuoteImageUrls();
  const { data: packageTypesData } = usePackageTypes();
  const { data: quoteData, isLoading, isError } = useQuote(quoteId);
  const defaultValues = quoteData ? buildDefaultValues(quoteData) : undefined;

  const handleSubmit = async (values: QuoteFormValues, images?: { files: File[]; urls: string[] }) => {
    const payload = buildUpdatePayload(values, packageTypesData);
    const imageFiles = images?.files || [];
    const imageUrls = images?.urls || [];

    updateQuote.mutate(
      { id: quoteId, data: payload },
      {
        onSuccess: async () => {
          let imageUploadFailed = false;

          if (imageFiles.length > 0) {
            try {
              await uploadImages.mutateAsync({ quoteId, files: imageFiles });
            } catch {
              imageUploadFailed = true;
            }
          }

          if (imageUrls.length > 0) {
            try {
              await addImageUrls.mutateAsync({ quoteId, urls: imageUrls });
            } catch {
              imageUploadFailed = true;
            }
          }

          toast({
            title: "Quote updated",
            description: imageUploadFailed
              ? "Changes saved, but some images failed to upload."
              : "Changes saved successfully.",
            variant: imageUploadFailed ? "destructive" : "default",
          });
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err) => {
          toast({
            title: "Failed to update quote",
            description: err instanceof Error ? err.message : "Something went wrong.",
            variant: "destructive",
          });
        },
      }
    );
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">Edit Quote</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Update quote details, accommodation, flights, and pricing.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="px-6 pb-6">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            {isError && (
              <div className="py-12 text-center text-sm text-red-500">
                Failed to load quote data.
              </div>
            )}
            {!isLoading && !isError && quoteData && (
              <QuoteRHFForm
                key={quoteId + open}
                defaultValues={defaultValues}
                onSubmit={handleSubmit}
                isLoading={updateQuote.isPending}
                submitLabel="Save Changes"
                onCancel={() => onOpenChange(false)}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
