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
import { BookingRHFForm } from "./booking-rhf-form";
import type { BookingFormValues, BookingCreateDialogProps } from "@/types/booking";
import { defaultBookingFormValues } from "@/types/booking";
import type { CreateTransactionData } from "@/types/quote";

function buildDateTime(date: string, time: string): string | null {
  if (!date) return null;
  return time ? `${date}T${time}:00` : `${date}T00:00:00`;
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
      package_commission: values.commission ? String(values.commission) : undefined,
      discounts: values.discount ? String(values.discount) : undefined,
      service_charge: values.serviceCharge ? String(values.serviceCharge) : undefined,
      transfer_type: values.transferType || undefined,
      lodge_id: isHotTubBreak ? (values.lodgeId || undefined) : undefined,
      pets: isHotTubBreak ? (values.pets ? 1 : 0) : 0,
      main_tour_operator_id: values.tourOperatorId || undefined,
      outboundFlight,
      inboundFlight,
      outboundConnectingLegs,
      inboundConnectingLegs,
      primaryAccommodation,
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

  const defaultValues: Partial<BookingFormValues> = {
    ...defaultBookingFormValues,
    ...initialValues,
  };

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
      onSuccess: (result) => {
        toast({ title: "Booking created", description: "New booking has been created." });
        onOpenChange(false);
        onSuccess?.(result?.id || "");
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
            />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
