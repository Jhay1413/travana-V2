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
import { useUploadQuoteImages, useAddQuoteImageUrls, useDeleteQuoteImage } from "@/hooks/mutations/use-quote-image-mutations";
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

function toIso(val: Date | string | null | undefined): string | null | undefined {
  if (!val) return val as null | undefined;
  if (val instanceof Date) return val.toISOString();
  return val;
}

function buildExtrasPayload(values: {
  transfers: any[]; carHires: any[]; attractionTickets: any[];
  loungePasses: any[]; airportParkings: any[]; extraAccommodations: any[];
}) {
  const buildDateTime = (date: string, time: string) => {
    if (!date) return null;
    return time ? `${date}T${time}:00` : `${date}T00:00:00`;
  };
  return {
    transfers: values.transfers.map(t => ({
      booking_ref: t.bookingRef || null,
      tour_operator_id: t.tourOperatorId || null,
      pick_up_location: t.pickUpLocation || null,
      drop_off_location: t.dropOffLocation || null,
      pick_up_time: buildDateTime(t.pickUpDate, t.pickUpTime),
      drop_off_time: buildDateTime(t.dropOffDate, t.dropOffTime),
      note: t.note || null,
      cost: String(t.cost || 0),
      commission: String(t.commission || 0),
      is_included_in_package: t.isIncludedInPackage,
    })),
    carHires: values.carHires.map(c => ({
      booking_ref: c.bookingRef || null,
      tour_operator_id: c.tourOperatorId || null,
      pick_up_location: c.pickUpLocation || null,
      drop_off_location: c.dropOffLocation || null,
      pick_up_time: buildDateTime(c.pickUpDate, c.pickUpTime),
      drop_off_time: buildDateTime(c.dropOffDate, c.dropOffTime),
      no_of_days: c.noOfDays,
      driver_age: c.driverAge,
      cost: String(c.cost || 0),
      commission: String(c.commission || 0),
      is_included_in_package: c.isIncludedInPackage,
    })),
    attractionTickets: values.attractionTickets.map(t => ({
      booking_ref: t.bookingRef || null,
      tour_operator_id: t.tourOperatorId || null,
      ticket_type: t.ticketType || null,
      date_of_visit: t.dateOfVisit ? `${t.dateOfVisit}T00:00:00` : null,
      number_of_tickets: t.numberOfTickets,
      cost: String(t.cost || 0),
      commission: String(t.commission || 0),
      is_included_in_package: t.isIncludedInPackage,
    })),
    loungePasses: values.loungePasses.map(p => ({
      booking_ref: p.bookingRef || null,
      tour_operator_id: p.tourOperatorId || null,
      airport_id: p.airportId || null,
      terminal: p.terminal || null,
      date_of_usage: p.dateOfUsage ? `${p.dateOfUsage}T00:00:00` : null,
      note: p.note || null,
      cost: String(p.cost || 0),
      commission: String(p.commission || 0),
      is_included_in_package: p.isIncludedInPackage,
    })),
    airportParkings: values.airportParkings.map(p => ({
      booking_ref: p.bookingRef || null,
      tour_operator_id: p.tourOperatorId || null,
      airport_id: p.airportId || null,
      parking_type: p.parkingType || null,
      parking_date: p.parkingDate ? `${p.parkingDate}T00:00:00` : null,
      car_make: p.carMake || null,
      car_model: p.carModel || null,
      colour: p.colour || null,
      car_reg_number: p.carRegNumber || null,
      duration: p.duration || null,
      cost: String(p.cost || 0),
      commission: String(p.commission || 0),
      is_included_in_package: p.isIncludedInPackage,
    })),
    extraAccommodations: values.extraAccommodations.map(a => ({
      booking_ref: a.bookingRef || null,
      tour_operator_id: a.tourOperatorId || null,
      accomodation_id: a.accommodationId || null,
      board_basis_id: a.boardBasisId || null,
      room_type: a.roomType || null,
      check_in_date_time: buildDateTime(a.checkInDate, a.checkInTime),
      no_of_nights: a.noOfNights,
      cost: String(a.cost || 0),
      commission: String(a.commission || 0),
      is_included_in_package: a.isIncludedInPackage,
    })),
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
    childAges: (quoteData.passengers || []).filter((p: any) => p.type === "child").map((p: any) => p.age || 0),
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

    // Extras
    transfers: (quoteData.transfers || []).map((t: any) => ({
      bookingRef: t.booking_ref || "",
      tourOperatorId: t.tour_operator_id || "",
      pickUpLocation: t.pick_up_location || "",
      dropOffLocation: t.drop_off_location || "",
      pickUpDate: splitDateTime(toIso(t.pick_up_time)).date,
      pickUpTime: splitDateTime(toIso(t.pick_up_time)).time,
      dropOffDate: splitDateTime(toIso(t.drop_off_time)).date,
      dropOffTime: splitDateTime(toIso(t.drop_off_time)).time,
      note: t.note || "",
      cost: parseFloat(String(t.cost || 0)) || 0,
      commission: parseFloat(String(t.commission || 0)) || 0,
      isIncludedInPackage: t.is_included_in_package ?? true,
    })),
    carHires: (quoteData.carHires || []).map((c: any) => ({
      bookingRef: c.booking_ref || "",
      tourOperatorId: c.tour_operator_id || "",
      pickUpLocation: c.pick_up_location || "",
      dropOffLocation: c.drop_off_location || "",
      pickUpDate: splitDateTime(toIso(c.pick_up_time)).date,
      pickUpTime: splitDateTime(toIso(c.pick_up_time)).time,
      dropOffDate: splitDateTime(toIso(c.drop_off_time)).date,
      dropOffTime: splitDateTime(toIso(c.drop_off_time)).time,
      noOfDays: c.no_of_days ?? 1,
      driverAge: c.driver_age ?? 25,
      cost: parseFloat(String(c.cost || 0)) || 0,
      commission: parseFloat(String(c.commission || 0)) || 0,
      isIncludedInPackage: c.is_included_in_package ?? true,
    })),
    attractionTickets: (quoteData.attractionTickets || []).map((t: any) => ({
      bookingRef: t.booking_ref || "",
      tourOperatorId: t.tour_operator_id || "",
      ticketType: t.ticket_type || "",
      dateOfVisit: splitDateTime(toIso(t.date_of_visit)).date,
      numberOfTickets: t.number_of_tickets ?? 1,
      cost: parseFloat(String(t.cost || 0)) || 0,
      commission: parseFloat(String(t.commission || 0)) || 0,
      isIncludedInPackage: t.is_included_in_package ?? true,
    })),
    loungePasses: (quoteData.loungePasses || []).map((p: any) => ({
      bookingRef: p.booking_ref || "",
      tourOperatorId: p.tour_operator_id || "",
      airportId: p.airport_id || "",
      terminal: p.terminal || "",
      dateOfUsage: splitDateTime(toIso(p.date_of_usage)).date,
      note: p.note || "",
      cost: parseFloat(String(p.cost || 0)) || 0,
      commission: parseFloat(String(p.commission || 0)) || 0,
      isIncludedInPackage: p.is_included_in_package ?? true,
    })),
    airportParkings: (quoteData.airportParkings || []).map((p: any) => ({
      bookingRef: p.booking_ref || "",
      tourOperatorId: p.tour_operator_id || "",
      airportId: p.airport_id || "",
      parkingType: p.parking_type || "",
      parkingDate: splitDateTime(toIso(p.parking_date)).date,
      carMake: p.car_make || "",
      carModel: p.car_model || "",
      colour: p.colour || "",
      carRegNumber: p.car_reg_number || "",
      duration: p.duration || "",
      cost: parseFloat(String(p.cost || 0)) || 0,
      commission: parseFloat(String(p.commission || 0)) || 0,
      isIncludedInPackage: p.is_included_in_package ?? true,
    })),
    extraAccommodations: (quoteData.accommodations || [])
      .filter((a: any) => !a.is_primary)
      .map((a: any) => ({
        bookingRef: a.booking_ref || "",
        tourOperatorId: a.tour_operator_id || "",
        accommodationId: a.accomodation_id || "",
        boardBasisId: a.board_basis_id || "",
        roomType: a.room_type || "",
        checkInDate: splitDateTime(toIso(a.check_in_date_time)).date,
        checkInTime: splitDateTime(toIso(a.check_in_date_time)).time,
        noOfNights: a.no_of_nights ?? 0,
        cost: parseFloat(String(a.cost || 0)) || 0,
        commission: parseFloat(String(a.commission || 0)) || 0,
        isIncludedInPackage: a.is_included_in_package ?? true,
      })),
    tags: (quoteData.tags || []) as string[],
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
    childAges: values.childAges ?? [],
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

  Object.assign(payload, buildExtrasPayload(values));

  payload.tags = values.tags ?? [];

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
  const deleteImage = useDeleteQuoteImage();
  const { data: packageTypesData } = usePackageTypes();
  const { data: quoteData, isLoading, isError } = useQuote(quoteId);
  const defaultValues = quoteData ? buildDefaultValues(quoteData) : undefined;
  const initialExtraAccomLabels = (quoteData?.accommodations || [])
    .filter((a: any) => !a.is_primary)
    .map((a: any) => a.accomodation_name || "");
  const existingImages = (quoteData?.images || []).map((img: any) => ({ id: img.id, url: img.image_url }));

  const handleSubmit = async (values: QuoteFormValues, images?: { files: File[]; urls: string[]; deletedImageIds: string[] }) => {
    const payload = buildUpdatePayload(values, packageTypesData);
    const imageFiles = images?.files || [];
    const imageUrls = images?.urls || [];
    const deletedImageIds = images?.deletedImageIds || [];

    updateQuote.mutate(
      { id: quoteId, data: payload },
      {
        onSuccess: async () => {
          let imageUploadFailed = false;

          if (deletedImageIds.length > 0) {
            await Promise.allSettled(
              deletedImageIds.map((imageId) => deleteImage.mutateAsync({ quoteId, imageId }))
            );
          }

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
                existingImages={existingImages}
                initialExtraAccomLabels={initialExtraAccomLabels}
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
