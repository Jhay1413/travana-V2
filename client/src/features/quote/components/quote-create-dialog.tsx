import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateQuote, useCreateTransaction, useCreateSocialQuote, useDuplicateQuote } from "@/hooks/mutations";
import { usePackageTypes } from "@/hooks/queries";
import { uploadImagesDirect } from "@/features/quote/api/upload-images-direct";
import { orderedImageUrls, type FormImageItem } from "@/features/quote/lib/form-images";
import { QuoteRHFForm } from "./quote-rhf-form";
import type { QuoteFormValues, QuoteCreateDialogProps } from "@/features/quote/types";
import { defaultQuoteFormValues } from "@/features/quote/types";
import type { CreateQuoteData, CreateTransactionData } from "@/features/quote/types";

function buildDateTime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
}

function buildExtrasPayload(values: {
  transfers: any[]; carHires: any[]; attractionTickets: any[];
  loungePasses: any[]; airportParkings: any[]; extraAccommodations: any[];
}) {
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

export function buildQuotePayload(
  values: QuoteFormValues,
  packageTypesData: { id: string; name: string }[] | undefined
): Omit<CreateQuoteData, "transaction_id"> & { transaction_id?: string } {
  const packageTypeName =
    packageTypesData?.find((p) => p.id === values.packageType)?.name || values.packageType;
  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && values.cruiseOnly);

  const commissionValue = Number(values.commission) || 0;

  const payload: any = {
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
    quote_ref: values.quoteLink || undefined,
    lead_source: values.leadSource || undefined,
    quote_status: values.status && values.status !== "draft" ? values.status : "QUOTE_IN_PROGRESS",
    main_tour_operator_id: values.tourOperatorId || undefined,
    not_for_social: values.not_for_social === true,
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

  payload.pets = values.pets ?? 0;
  payload.childAges = values.childAges ?? [];

  if (isHotTubBreak) {
    payload.lodge_id = values.lodgeId || undefined;
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

  Object.assign(payload, buildExtrasPayload(values));

  if (values.tags?.length) {
    payload.tags = values.tags;
  }

  return payload;
}

export function QuoteCreateDialog({
  transactionId,
  clientId,
  userId,
  open,
  onOpenChange,
  onSuccess,
  initialValues,
  initialImages,
  socialPost = false,
  markAsCopy = false,
  duplicateFromQuoteId,
}: QuoteCreateDialogProps) {
  const { toast } = useToast();
  const createQuote = useCreateQuote();
  const createTransaction = useCreateTransaction();
  const createSocialQuote = useCreateSocialQuote();
  const duplicateQuote = useDuplicateQuote();
  const { data: packageTypesData } = usePackageTypes();
  const [isUploadingImages, setIsUploadingImages] = useState(false);

  const defaultValues = useMemo<Partial<QuoteFormValues>>(
    () => ({ ...defaultQuoteFormValues, ...initialValues }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialValues],
  );

  const isSubmitting =
    isUploadingImages ||
    createQuote.isPending ||
    createTransaction.isPending ||
    createSocialQuote.isPending ||
    duplicateQuote.isPending;

  const warnFailedUploads = (failed: number) => {
    if (failed > 0) {
      toast({
        title: "Some images failed to upload",
        description: `${failed} image(s) failed to upload. The rest of your changes were saved.`,
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (
    values: QuoteFormValues,
    images?: { files: File[]; urls: string[]; items?: FormImageItem[] },
  ) => {
    const quotePayload = buildQuotePayload(values, packageTypesData);
    const imageFiles = images?.files || [];

    // Upload any picked files straight to S3 (presigned PUT) before building the
    // request payload, so the whole submission — quote fields + image URLs —
    // goes to the server as a single plain-JSON request instead of multipart.
    let urlByFile = new Map<File, string>();
    let failedUploads = 0;
    if (imageFiles.length > 0) {
      setIsUploadingImages(true);
      try {
        const result = await uploadImagesDirect(imageFiles);
        urlByFile = result.urlByFile;
        failedUploads = result.failed;
      } finally {
        setIsUploadingImages(false);
      }
    }
    // Slot the uploads back into the order the user arranged in the form; the
    // server assigns `position` from this array's index (and marks the first
    // one primary), so this order is what the gallery ends up showing.
    const imageUrls = images?.items
      ? orderedImageUrls(images.items, urlByFile)
      : [...(images?.urls || []), ...Array.from(urlByFile.values())];

    if (socialPost) {
      const json = {
        ...quotePayload,
        ...(imageUrls.length > 0 && { images: imageUrls }),
      };

      createSocialQuote.mutate(json, {
        onSuccess: (newQuote) => {
          toast({ title: "Social post created", description: "New social post has been created." });
          warnFailedUploads(failedUploads);
          onOpenChange(false);
          onSuccess?.(newQuote.id);
        },
        onError: (err) => {
          toast({
            title: "Failed to create social post",
            description: err instanceof Error ? err.message : "Something went wrong.",
            variant: "destructive",
          });
        },
      });
      return;
    }

    // When converting from enquiry, transactionId is required (unless a clientId is present to create a new transaction)
    if (initialValues && Object.keys(initialValues).length > 0 && !transactionId && !clientId) {
      toast({
        title: "Conversion Error",
        description: "Unable to convert enquiry - transaction ID is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (transactionId) {
      const json: CreateQuoteData = {
        ...quotePayload,
        transaction_id: transactionId,
        ...(imageUrls.length > 0 && { images: imageUrls }),
        ...(markAsCopy && initialValues && Object.keys(initialValues).length > 0 && { isQuoteCopy: true }),
      } as CreateQuoteData;

      // Copying an existing quote goes through the duplicate endpoint: it clones
      // the source's extras (each with its own cost/commission), tags and child
      // ages server-side, then applies these form values on top. Plain create
      // would silently drop all of that, because the form never loads extras.
      if (duplicateFromQuoteId) {
        duplicateQuote.mutate(
          { id: duplicateFromQuoteId, data: json },
          {
            onSuccess: (newQuote) => {
              toast({ title: "Quote copied", description: "The copy has been created." });
              warnFailedUploads(failedUploads);
              onOpenChange(false);
              onSuccess?.(newQuote.id);
            },
            onError: (err) => {
              toast({
                title: "Failed to copy quote",
                description: err instanceof Error ? err.message : "Something went wrong.",
                variant: "destructive",
              });
            },
          },
        );
        return;
      }

      createQuote.mutate(json, {
        onSuccess: (newQuote) => {
          toast({ title: "Quote created", description: "New quote has been created." });
          warnFailedUploads(failedUploads);
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
    } else if (clientId && userId) {
      const txnJson = {
        client_id: clientId,
        user_id: userId,
        lead_source: values.leadSource || undefined,
        is_test: values.is_test === true,
        quote: {
          ...quotePayload,
          quote_status: values.status || "QUOTE_IN_PROGRESS",
          ...(imageUrls.length > 0 && { images: imageUrls }),
          ...(markAsCopy && initialValues && Object.keys(initialValues).length > 0 && { isQuoteCopy: true }),
        },
      };

      createTransaction.mutate(txnJson as CreateTransactionData, {
          onSuccess: (txn) => {
            toast({ title: "Quote created", description: "New quote has been created." });
            warnFailedUploads(failedUploads);
            onOpenChange(false);
            const newQuoteId = txn.quotes?.[0]?.id;
            if (newQuoteId) {
              onSuccess?.(newQuoteId);
            }
          },
          onError: (err) => {
            toast({
              title: "Failed to create quote",
              description: err instanceof Error ? err.message : "Something went wrong.",
              variant: "destructive",
            });
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">{socialPost ? "New Social Post" : "New Quote"}</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            {socialPost
              ? "Fill in the details to create a social post. No client will be attached."
              : "Fill in the quote details, accommodation, flights, and pricing."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="px-6 pb-6">
            <QuoteRHFForm
              key={(transactionId || clientId || "social") + open}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isLoading={isSubmitting}
              submitLabel={socialPost ? "Create Social Post" : "Create Quote"}
              onCancel={() => onOpenChange(false)}
              initialImageUrls={initialImages}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
