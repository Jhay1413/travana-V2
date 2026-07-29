import { useMemo } from "react";
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
import { useUpdateBooking, useUploadBookingImages, useAddBookingImageUrls, useDeleteBookingImage, useReconcileUpsells } from "@/hooks/mutations";
import { useReorderBookingImages } from "@/features/booking/api/use-booking-image-mutations";
import { useBooking, usePackageTypes } from "@/hooks/queries";
import { BookingRHFForm } from "./booking-rhf-form";
import { defaultBookingFormValues, upsellsToFormValues } from "@/features/booking/types";
import type { BookingFormValues, BookingUpdateDialogProps, UpsellRecord } from "@/features/booking/types";
import { orderedImageUrls, type FormImageItem } from "@/features/quote/lib/form-images";

function splitDateTime(iso: string | null | undefined): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const tIdx = iso.indexOf("T");
  if (tIdx === -1) return { date: iso, time: "" };
  return {
    date: iso.substring(0, tIdx),
    time: iso.substring(tIdx + 1).substring(0, 5),
  };
}

/** Split a flight's arrival datetime, defaulting the arrival DATE to the
 * departure date when the data has no arrival date and no arrival time. */
function splitArrival(arrivalIso: string | null | undefined, departDate: string): { date: string; time: string } {
  const arr = splitDateTime(arrivalIso);
  if (!arr.date && !arr.time) arr.date = departDate;
  return arr;
}

function toIso(val: Date | string | null | undefined): string | null | undefined {
  if (!val) return val as null | undefined;
  if (val instanceof Date) return val.toISOString();
  return val;
}

function buildDateTime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
}

function buildDefaultValues(bookingData: any): BookingFormValues {
  const flights = bookingData.flights || [];
  const outboundFlights = flights
    .filter((f: any) => f.flight_type === "outbound")
    .sort((a: any, b: any) => (a.leg_order ?? 0) - (b.leg_order ?? 0));
  const inboundFlights = flights
    .filter((f: any) => f.flight_type === "inbound")
    .sort((a: any, b: any) => (a.leg_order ?? 0) - (b.leg_order ?? 0));

  const outbound = outboundFlights[0];
  const inbound = inboundFlights[0];

  const accommodations = bookingData.accommodations || [];
  const primaryAccom = accommodations.find((a: any) => a.is_primary) || accommodations[0];

  const outDep = splitDateTime(toIso(outbound?.departure_date_time));
  const outArr = splitArrival(toIso(outbound?.arrival_date_time), outDep.date);
  const inDep = splitDateTime(toIso(inbound?.departure_date_time));
  const inArr = splitArrival(toIso(inbound?.arrival_date_time), inDep.date);
  const checkIn = splitDateTime(toIso(primaryAccom?.check_in_date_time));

  return {
    ...defaultBookingFormValues,
    haysRef: bookingData.hays_ref || "",
    supplierRef: bookingData.supplier_ref || "",
    bookingStatus: bookingData.booking_status || "BOOKED",
    packageType: bookingData.holiday_type_id || "",
    quoteTitle: bookingData.title || "",
    tourOperatorId: bookingData.main_tour_operator_id || "",
    travelDate: bookingData.travel_date?.toString().split("T")[0] || "",
    nights: bookingData.num_of_nights || 7,
    passengersAdults: bookingData.adult || 2,
    passengersChildren: bookingData.child || 0,
    passengersInfants: bookingData.infant || 0,
    childAges: (bookingData.passengers || []).filter((p: any) => p.type === "child").map((p: any) => p.age || 0),
    transferType: bookingData.transfer_type || "",
    preBookedSeats: bookingData.pre_booked_seats || "",
    flightMeals: bookingData.flight_meals ? "Yes" : "No",

    country: bookingData.country_id || "",
    destination: bookingData.destination_id || "",
    resort: bookingData.resort_id || "",
    accommodationId: primaryAccom?.accomodation_id || "",
    boardBasisId: primaryAccom?.board_basis_id || "",
    checkInDate: checkIn.date,
    checkInTime: checkIn.time,
    roomType: primaryAccom?.room_type || "",

    outboundDepartAirportId: outbound?.departing_airport_id || "",
    outboundArriveAirportId: outbound?.arrival_airport_id || "",
    outboundDepartDate: outDep.date,
    outboundDepartTime: outDep.time,
    outboundArriveDate: outArr.date,
    outboundArriveTime: outArr.time,
    outboundFlightNumber: outbound?.flight_number || "",
    outboundConnectingLegs: outboundFlights.slice(1).map((f: any) => {
      const dep = splitDateTime(toIso(f.departure_date_time));
      const arr = splitArrival(toIso(f.arrival_date_time), dep.date);
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

    inboundDepartAirportId: inbound?.departing_airport_id || "",
    inboundArriveAirportId: inbound?.arrival_airport_id || "",
    inboundDepartDate: inDep.date,
    inboundDepartTime: inDep.time,
    inboundArriveDate: inArr.date,
    inboundArriveTime: inArr.time,
    inboundFlightNumber: inbound?.flight_number || "",
    inboundConnectingLegs: inboundFlights.slice(1).map((f: any) => {
      const dep = splitDateTime(toIso(f.departure_date_time));
      const arr = splitArrival(toIso(f.arrival_date_time), dep.date);
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

    lodgeId: bookingData.lodge_id || "",
    pets: bookingData.pets ?? 0,

    cruiseTitle: bookingData.cruises?.[0]?.cruise_name || "",
    cruiseLine: bookingData.cruises?.[0]?.cruise_line || "",
    shipName: bookingData.cruises?.[0]?.ship || "",
    cruiseDate: bookingData.cruises?.[0]?.cruise_date || "",
    cabinType: bookingData.cruises?.[0]?.cabin_type || "",
    cabinNumber: bookingData.cruises?.[0]?.cabin_number || "",
    embarkation: bookingData.cruises?.[0]?.embarkation || "",
    debarkation: bookingData.cruises?.[0]?.debarkation || "",
    cruiseExtras: (bookingData.cruises?.[0]?.extras || [])
      .map((e: any) => e.name)
      .filter(Boolean)
      .join(", "),
    preCruiseStay: bookingData.cruises?.[0]?.pre_cruise_stay ?? 0,
    postCruiseStay: bookingData.cruises?.[0]?.post_cruise_stay ?? 0,
    cruiseItinerary: (bookingData.cruises?.[0]?.itinerary || []).map((d: any) => ({
      day: Number(d.day_number) || 0,
      description: d.description || "",
    })),

    price: parseFloat(String(bookingData.sales_price || 0)) || 0,
    commission: parseFloat(String(bookingData.package_commission || 0)) || 0,
    discount: parseFloat(String(bookingData.discounts || 0)) || 0,
    serviceCharge: parseFloat(String(bookingData.service_charge || 0)) || 0,
    pricePerPerson: parseFloat(String(bookingData.price_per_person || 0)) || 0,

    transfers: (bookingData.transfers || []).map((t: any) => ({
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
    carHires: (bookingData.carHires || []).map((c: any) => ({
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
    attractionTickets: (bookingData.attractionTickets || []).map((t: any) => ({
      bookingRef: t.booking_ref || "",
      tourOperatorId: t.tour_operator_id || "",
      ticketType: t.ticket_type || "",
      dateOfVisit: splitDateTime(toIso(t.date_of_visit)).date,
      numberOfTickets: t.number_of_tickets ?? 1,
      cost: parseFloat(String(t.cost || 0)) || 0,
      commission: parseFloat(String(t.commission || 0)) || 0,
      isIncludedInPackage: t.is_included_in_package ?? true,
    })),
    loungePasses: (bookingData.loungePasses || []).map((p: any) => ({
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
    airportParkings: (bookingData.airportParkings || []).map((p: any) => ({
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
    extraAccommodations: (bookingData.accommodations || [])
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
    // Hydrate any upsells already attached to this booking so the in-form
    // Upsells section is populated when editing.
    upsells: upsellsToFormValues(bookingData.upsells),
  };
}

function buildUpdatePayload(
  values: BookingFormValues,
  packageTypesData: { id: string; name: string | null }[] | undefined
) {
  const packageTypeName =
    packageTypesData?.find((p) => p.id === values.packageType)?.name || values.packageType;
  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && values.cruiseOnly);

  const payload: Record<string, unknown> = {
    holiday_type_id: values.packageType || null,
    hays_ref: values.haysRef || null,
    supplier_ref: values.supplierRef || null,
    booking_status: values.bookingStatus || "BOOKED",
    title: values.quoteTitle || null,
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
    package_commission: String(values.commission || 0),
    discounts: String(values.discount || 0),
    service_charge: String(values.serviceCharge || 0),
    price_per_person: String(values.pricePerPerson || 0),
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
    payload.pets = values.pets ?? 0;
  }

  if (isCruise) {
    payload.cruiseTitle = values.cruiseTitle || undefined;
    payload.cruiseLine = values.cruiseLine || undefined;
    payload.shipName = values.shipName || undefined;
    payload.cruiseDate = values.cruiseDate || undefined;
    payload.cabinType = values.cabinType || undefined;
    payload.cabinNumber = values.cabinNumber || undefined;
    payload.embarkation = values.embarkation || undefined;
    payload.debarkation = values.debarkation || undefined;
    payload.cruiseExtras = values.cruiseExtras || undefined;
    payload.cruiseOnly = values.cruiseOnly;
    payload.preCruiseStay = values.preCruiseStay ?? 0;
    payload.postCruiseStay = values.postCruiseStay ?? 0;
    payload.cruiseItinerary = values.cruiseItinerary ?? [];
  }

  // Extras — all sent in single PATCH call
  payload.transfers = values.transfers.map(t => ({
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
  }));
  payload.carHires = values.carHires.map(c => ({
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
  }));
  payload.attractionTickets = values.attractionTickets.map(t => ({
    booking_ref: t.bookingRef || null,
    tour_operator_id: t.tourOperatorId || null,
    ticket_type: t.ticketType || null,
    date_of_visit: t.dateOfVisit ? `${t.dateOfVisit}T00:00:00` : null,
    number_of_tickets: t.numberOfTickets,
    cost: String(t.cost || 0),
    commission: String(t.commission || 0),
    is_included_in_package: t.isIncludedInPackage,
  }));
  payload.loungePasses = values.loungePasses.map(p => ({
    booking_ref: p.bookingRef || null,
    tour_operator_id: p.tourOperatorId || null,
    airport_id: p.airportId || null,
    terminal: p.terminal || null,
    date_of_usage: p.dateOfUsage ? `${p.dateOfUsage}T00:00:00` : null,
    note: p.note || null,
    cost: String(p.cost || 0),
    commission: String(p.commission || 0),
    is_included_in_package: p.isIncludedInPackage,
  }));
  payload.airportParkings = values.airportParkings.map(p => ({
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
  }));
  payload.extraAccommodations = values.extraAccommodations.map(a => ({
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
  }));
  // Upsells are NOT sent through the booking PATCH (it ignores the key); they're
  // persisted separately via the dedicated endpoints in handleSubmit.

  return payload;
}

export function BookingEditDialog({
  bookingId,
  open,
  onOpenChange,
  onSuccess,
  clientId,
}: BookingUpdateDialogProps) {
  const { toast } = useToast();
  const updateBooking = useUpdateBooking();
  const { reconcile: reconcileUpsells } = useReconcileUpsells();
  const uploadImages = useUploadBookingImages();
  const addImageUrls = useAddBookingImageUrls();
  const deleteImage = useDeleteBookingImage();
  const reorderImages = useReorderBookingImages();
  const { data: packageTypesData } = usePackageTypes();
  const { data: bookingData, isLoading, isError } = useBooking(bookingId);

  const defaultValues = useMemo(
    () => (bookingData ? buildDefaultValues(bookingData) : undefined),
    [bookingData],
  );

  const initialExtraAccomLabels = useMemo(
    () =>
      (bookingData?.accommodations || [])
        .filter((a: any) => !a.is_primary)
        .map((a: any) => a.accomodation_name || ""),
    [bookingData],
  );

  const existingImages = useMemo(
    () =>
      ((bookingData as any)?.images || []).map((img: any) => ({
        id: img.id,
        url: img.image_url,
      })),
    [bookingData],
  );

  const handleSubmit = async (
    values: BookingFormValues,
    images?: { files: File[]; urls: string[]; deletedImageIds: string[]; items?: FormImageItem[] }
  ) => {
    const payload = buildUpdatePayload(values, packageTypesData);
    const imageFiles = images?.files || [];
    // Only images that aren't already saved — addImageUrls appends with no
    // dedupe, so resubmitting saved ones would duplicate the whole gallery.
    const imageUrls = images?.items
      ? images.items.flatMap((i) => (i.kind === "url" ? [i.url] : []))
      : images?.urls || [];
    const deletedImageIds = images?.deletedImageIds || [];

    updateBooking.mutate(
      { id: bookingId, data: payload as any },
      {
        onSuccess: async () => {
          let imageUploadFailed = false;
          let upsellsFailed = false;

          // Persist upsells via their dedicated endpoints (the booking PATCH
          // ignores them), diffing the form rows against what was loaded.
          try {
            const existingUpsells: UpsellRecord[] = ((bookingData as any)?.upsells ?? []) as UpsellRecord[];
            await reconcileUpsells(bookingId, values.upsells, existingUpsells);
          } catch {
            upsellsFailed = true;
          }

          if (deletedImageIds.length > 0) {
            await Promise.allSettled(
              deletedImageIds.map((imageId) => deleteImage.mutateAsync({ bookingId, imageId }))
            );
          }

          // The upload endpoint returns the inserted rows in the same order as
          // the files it received, which is how a just-uploaded File is paired
          // back to its stored URL for the reorder step below.
          const urlByFile = new Map<File, string>();
          if (imageFiles.length > 0) {
            try {
              const uploaded = await uploadImages.mutateAsync({ bookingId, files: imageFiles });
              if (Array.isArray(uploaded)) {
                imageFiles.forEach((file, i) => {
                  const url = uploaded[i]?.url;
                  if (typeof url === "string" && url) urlByFile.set(file, url);
                });
              }
            } catch {
              imageUploadFailed = true;
            }
          }

          if (imageUrls.length > 0) {
            try {
              await addImageUrls.mutateAsync({ bookingId, urls: imageUrls });
            } catch {
              imageUploadFailed = true;
            }
          }

          // Persist the arrangement last, once every image exists as a row.
          // Matched by URL rather than id because images added in this same save
          // have no client-side id yet — the server resolves new and
          // already-saved rows alike. Mirrors the quote edit dialog.
          const orderedUrls = images?.items ? orderedImageUrls(images.items, urlByFile) : [];
          if (orderedUrls.length > 1) {
            try {
              await reorderImages.mutateAsync({ bookingId, imageUrls: orderedUrls });
            } catch {
              imageUploadFailed = true;
            }
          }

          const partialFailure = imageUploadFailed || upsellsFailed;
          toast({
            title: "Booking updated",
            description: partialFailure
              ? `Changes saved, but some ${upsellsFailed ? "upsells" : "images"} failed to save.`
              : "Changes saved successfully.",
            variant: partialFailure ? "destructive" : "default",
          });
          onOpenChange(false);
          onSuccess?.();
        },
        onError: (err) => {
          toast({
            title: "Failed to update booking",
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
          <DialogTitle className="text-lg font-semibold">Edit Booking</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Update booking details, accommodation, flights, and pricing.
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
                Failed to load booking data.
              </div>
            )}
            {!isLoading && !isError && bookingData && (
              <BookingRHFForm
                key={bookingId + open}
                defaultValues={defaultValues}
                initialExtraAccomLabels={initialExtraAccomLabels}
                existingImages={existingImages}
                onSubmit={handleSubmit}
                isLoading={updateBooking.isPending}
                submitLabel="Save Changes"
                onCancel={() => onOpenChange(false)}
                clientId={clientId}
              />
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
