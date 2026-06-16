import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useCreateTransaction } from "@/hooks/mutations";
import { usePackageTypes, useCurrentUser } from "@/hooks/queries";
import { BookingRHFForm } from "./BookingRhfForm";
import type { BookingFormValues, BookingCreateDialogProps } from "@/types/booking";
import { defaultBookingFormValues } from "@/types/booking";
import type { CreateTransactionData } from "@/types/quote";

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

function buildCreatePayload(
  values: BookingFormValues,
  clientId: string,
  userId: string,
  packageTypesData: { id: string; name: string }[] | undefined
): CreateTransactionData {
  const packageTypeName =
    packageTypesData?.find((p) => p.id === values.packageType)?.name || values.packageType;
  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && values.cruiseOnly);

  const outboundFlight = showFlights
    ? {
        departing_airport_id: values.outboundDepartAirportId || undefined,
        arrival_airport_id: values.outboundArriveAirportId || undefined,
        departure_date_time: buildDateTime(values.outboundDepartDate, values.outboundDepartTime) || undefined,
        arrival_date_time: buildDateTime(values.outboundArriveDate, values.outboundArriveTime) || undefined,
        flight_number: values.outboundFlightNumber || undefined,
      }
    : undefined;

  const inboundFlight = showFlights
    ? {
        departing_airport_id: values.inboundDepartAirportId || undefined,
        arrival_airport_id: values.inboundArriveAirportId || undefined,
        departure_date_time: buildDateTime(values.inboundDepartDate, values.inboundDepartTime) || undefined,
        arrival_date_time: buildDateTime(values.inboundArriveDate, values.inboundArriveTime) || undefined,
        flight_number: values.inboundFlightNumber || undefined,
      }
    : undefined;

  const outboundConnectingLegs = showFlights
    ? values.outboundConnectingLegs.map((leg) => ({
        departing_airport_id: leg.departAirportId || undefined,
        arrival_airport_id: leg.arriveAirportId || undefined,
        departure_date_time: buildDateTime(leg.departDate, leg.departTime) || undefined,
        arrival_date_time: buildDateTime(leg.arriveDate, leg.arriveTime) || undefined,
        flight_number: leg.flightNumber || undefined,
      }))
    : undefined;

  const inboundConnectingLegs = showFlights
    ? values.inboundConnectingLegs.map((leg) => ({
        departing_airport_id: leg.departAirportId || undefined,
        arrival_airport_id: leg.arriveAirportId || undefined,
        departure_date_time: buildDateTime(leg.departDate, leg.departTime) || undefined,
        arrival_date_time: buildDateTime(leg.arriveDate, leg.arriveTime) || undefined,
        flight_number: leg.flightNumber || undefined,
      }))
    : undefined;

  const primaryAccommodation = !isHotTubBreak
    ? {
        accomodation_id: values.accommodationId || undefined,
        board_basis_id: values.boardBasisId || undefined,
        room_type: values.roomType || undefined,
        no_of_nights: values.nights || 0,
        check_in_date_time: buildDateTime(values.checkInDate, values.checkInTime) || undefined,
      }
    : undefined;

  return {
    client_id: clientId,
    user_id: userId,
    lead_source: values.leadSource || undefined,
    is_test: values.is_test === true,
    booking: {
      holiday_type_id: values.packageType,
      hays_ref: values.haysRef || "",
      supplier_ref: values.supplierRef || "",
      travel_date: values.travelDate,
      title: values.quoteTitle,
      num_of_nights: values.nights || 0,
      adult: values.passengersAdults || 0,
      child: values.passengersChildren || 0,
      infant: values.passengersInfants || 0,
      sales_price: values.price ? String(values.price) : undefined,
      price_per_person: String(values.pricePerPerson || 0),
      package_commission: values.commission ? String(values.commission) : undefined,
      discounts: values.discount ? String(values.discount) : undefined,
      service_charge: values.serviceCharge ? String(values.serviceCharge) : undefined,
      wallet_credit: String(values.walletCreditAmount || 0),
      transfer_type: values.transferType || undefined,
      lodge_id: isHotTubBreak ? (values.lodgeId || undefined) : undefined,
      pets: isHotTubBreak ? (values.pets ?? 0) : 0,
      main_tour_operator_id: values.tourOperatorId || undefined,
      outboundFlight,
      inboundFlight,
      outboundConnectingLegs,
      inboundConnectingLegs,
      primaryAccommodation,
      ...(isCruise
        ? {
            cruiseTitle: values.cruiseTitle || undefined,
            cruiseLine: values.cruiseLine || undefined,
            shipName: values.shipName || undefined,
            cruiseDate: values.cruiseDate || undefined,
            cabinType: values.cabinType || undefined,
            cabinNumber: values.cabinNumber || undefined,
            embarkation: values.embarkation || undefined,
            debarkation: values.debarkation || undefined,
            cruiseExtras: values.cruiseExtras || undefined,
            cruiseOnly: values.cruiseOnly,
            cruiseItinerary: values.cruiseItinerary ?? [],
          }
        : {}),
      ...buildExtrasPayload(values),
    },
  };
}

export function BookingCreateDialog({
  clientId,
  open,
  onOpenChange,
  onSuccess,
  initialValues,
}: BookingCreateDialogProps) {
  const { toast } = useToast();
  const createTransaction = useCreateTransaction();
  const { data: packageTypesData } = usePackageTypes();
  const { data: currentUser } = useCurrentUser();

  const defaultValues = useMemo<Partial<BookingFormValues>>(
    () => ({ ...defaultBookingFormValues, ...initialValues }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialValues],
  );

  const handleSubmit = async (values: BookingFormValues) => {
    if (!currentUser?.id) {
      toast({
        title: "Error",
        description: "Unable to determine current user.",
        variant: "destructive",
      });
      return;
    }

    const payload = buildCreatePayload(values, clientId, currentUser.id, packageTypesData);
    createTransaction.mutate(payload, {
      onSuccess: async (result) => {
        const bookingId = result?.booking?.id;
        toast({ title: "Booking created", description: "New booking has been created." });
        onOpenChange(false);
        onSuccess?.(bookingId || "");
      },
      onError: (err) => {
        toast({
          title: "Failed to create booking",
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
          <DialogTitle className="text-lg font-semibold">New Booking</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Fill in the booking details, accommodation, flights, and pricing.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-100px)]">
          <div className="px-6 pb-6">
            <BookingRHFForm
              key={clientId + open}
              defaultValues={defaultValues}
              onSubmit={handleSubmit}
              isLoading={createTransaction.isPending}
              submitLabel="Create Booking"
              onCancel={() => onOpenChange(false)}
              clientId={clientId}
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
