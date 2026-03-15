import { useEffect, useRef, useState } from "react";
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Anchor, Hotel, Plane, Plus, X, PawPrint, FileText, DollarSign, MapPin, Users, Upload, BookOpen, ImagePlus } from "lucide-react";
import { handleJsonUpload as handleJsonUploadUtil } from "@/lib/json-import-handler";
import { getDepartureAirportOptions } from "@/lib/uk-airports";
import { bookingFormSchema, defaultBookingFormValues } from "@/types/booking";
import type { BookingFormValues, FlightLegValue, BookingRHFFormProps, ExtrasFormValues } from "@/types/booking";
import { QuoteExtrasSection as BookingExtrasSection } from "@/components/quote-extras-section";

export { bookingFormSchema, defaultBookingFormValues } from "@/types/booking";
export type { BookingFormValues, FlightLegValue, BookingRHFFormProps } from "@/types/booking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  useAirports,
  useTourOperators,
  useBoardBasis,
  useAccommodations,
  useCountries,
  useDestinationSearch,
  useResorts,
  usePackageTypes,
  useRoomTypes,
  useParks,
  useLodges,
  useCruiseLines,
  useShips,
  useCruiseItineraries,
  lookupKeys,
} from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";

const emptyFlightLeg: FlightLegValue = {
  departAirportId: "",
  departAirport: "",
  arriveAirportId: "",
  arriveAirport: "",
  departDate: "",
  departTime: "",
  arriveDate: "",
  arriveTime: "",
  flightNumber: "",
};

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

export function BookingRHFForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  onCancel,
}: BookingRHFFormProps) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { ...defaultBookingFormValues, ...defaultValues },
  });
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [destSearch, setDestSearch] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const skipLodgeResetRef = useRef(false);
  
  const { watch, setValue, control } = form;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const packageType = watch("packageType");
  const country = watch("country");
  const destination = watch("destination");
  const resort = watch("resort");
  const parkId = watch("parkId");
  const passengersAdults = watch("passengersAdults");
  const passengersChildren = watch("passengersChildren");
  const cruiseOnly = watch("cruiseOnly");
  const tourOperatorId = watch("tourOperatorId");
  const price = watch("price");
  const discount = watch("discount");
  const serviceCharge = watch("serviceCharge");
  const commission = watch("commission");


  // ── Lookup data ──────────────────────────────────────────────────────────
  const { data: packageTypesData } = usePackageTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();
  const { data: countriesData } = useCountries();
  const { data: destinationsData, isFetching: isDestFetching } = useDestinationSearch(destSearch, country || undefined);
  const { data: resortsData } = useResorts(destination || undefined);
  const { data: accommodationsData } = useAccommodations(resort || undefined);
  const { data: parksData } = useParks();
  const { data: lodgesData } = useLodges(parkId || undefined);

  const packageTypeName =
    packageTypesData?.find((p: { id: string; name: string }) => p.id === packageType)?.name ||
    packageType;


  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && cruiseOnly);

  // ── Cruise cascade ────────────────────────────────────────────────────────
  const { data: cruiseLinesData } = useCruiseLines();
  const selectedCruiseLineId = cruiseLinesData?.find(l => l.name === watch('cruiseLine'))?.id;
  const { data: shipsData } = useShips(selectedCruiseLineId);
  const selectedShipId = shipsData?.find(s => s.name === watch('shipName'))?.id;
  const { data: cruiseItineraries, isFetching: isFetchingCruiseDates } = useCruiseItineraries(selectedShipId);

  // ── Lodge park reset ─────────────────────────────────────────────────────
  const isParkFirstRender = useRef(true);
  useEffect(() => {
    if (isParkFirstRender.current) {
      isParkFirstRender.current = false;
      return;
    }
    if (skipLodgeResetRef.current) {
      skipLodgeResetRef.current = false;
      return;
    }
    setValue("lodgeId", "");
  }, [parkId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Child ages sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const currentAges = form.getValues("childAges");
    const count = Number(passengersChildren) || 0;
    if (currentAges.length !== count) {
      const newAges = Array.from({ length: count }, (_, i) => currentAges[i] ?? 0);
      setValue("childAges", newAges);
    }
  }, [passengersChildren, setValue, form]);

  // ── Price per person calculation ──────────────────────────────────────────
  useEffect(() => {
    const price = Number(form.getValues("price")) || 0;
    const adults = Number(passengersAdults) || 0;
    const children = Number(passengersChildren) || 0;
    const total = adults + children;
    setValue("pricePerPerson", total > 0 ? parseFloat((price / total).toFixed(2)) : 0);
  }, [passengersAdults, passengersChildren]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commission auto-calculation ───────────────────────────────────────────
  useEffect(() => {
    if (tourOperatorId && packageType && tourOperatorsData) {
      const currentPrice = Number(price) || 0;
      const currentDiscount = Number(discount) || 0;
      const currentServiceCharge = Number(serviceCharge) || 0;
      const op = tourOperatorsData.find((o: { id: string }) => o.id === tourOperatorId);
      const commission = op?.commissions?.find((c: { package_type_id: string | null }) => c.package_type_id === packageType);
      
      if (commission?.percentage_commission != null && currentPrice > 0) {
        // Calculate base commission from price, then adjust with discount and service charge
        const baseCommission = (currentPrice * parseFloat(commission.percentage_commission)) / 100;
        const calculatedCommission = parseFloat((baseCommission - currentDiscount + currentServiceCharge).toFixed(2));
        
        // Only update if different from current value to avoid infinite loops
        const currentCommission = form.getValues("commission");
        if (currentCommission !== calculatedCommission) {
          setValue("commission", calculatedCommission, { shouldValidate: true, shouldDirty: true });
        }
      }
    }
  }, [tourOperatorId, packageType, price, discount, serviceCharge, tourOperatorsData, form, setValue]);

  // ── Options ───────────────────────────────────────────────────────────────
  const airportOptions = (airportsData || []).map(
    (a: { id: string; airport_name: string; airport_code?: string | null }) => ({
      value: a.id,
      label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
    })
  );
  const departureAirportOptions = getDepartureAirportOptions(airportsData);
  const handleJsonUpload = (file: File) => {
    handleJsonUploadUtil(file, {
      form,
      airportsData,
      packageTypesData,
      queryClient,
      lookupKeys,
      toast,
      setImageUrls,
      fallbackFieldMapper: (data, setIfPresent) => {
        setIfPresent("haysRef", data.haysRef || data.hays_ref);
        setIfPresent("supplierRef", data.supplierRef || data.supplier_ref);
      },
    });
  };

  const {
    fields: outboundLegs,
    append: appendOutbound,
    remove: removeOutbound,
  } = useFieldArray({ control, name: "outboundConnectingLegs" });

  const {
    fields: inboundLegs,
    append: appendInbound,
    remove: removeInbound,
  } = useFieldArray({ control, name: "inboundConnectingLegs" });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        <div className="flex items-center justify-end">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05]">
            <Upload className="h-3.5 w-3.5" />
            Import JSON
            <input
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleJsonUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={BookOpen} title="Booking References" />
          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              control={control}
              name="haysRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Hays Ref</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      placeholder="Enter Hays reference..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="supplierRef"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Supplier Ref</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      placeholder="Enter supplier reference..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="bookingStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Booking Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["BOOKED", "CONFIRMED", "CANCELLED", "COMPLETED"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0) + s.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={FileText} title="Package Details" />
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={control}
              name="packageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Package Type *</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(value) => {
                      field.onChange(value);
                      const currentOperatorId = form.getValues("tourOperatorId");
                      if (currentOperatorId) {
                        const op = tourOperatorsData?.find((o: { id: string }) => o.id === currentOperatorId);
                        const commission = op?.commissions?.find((c: { package_type_id: string | null }) => c.package_type_id === value);
                        if (commission?.percentage_commission != null) {
                          const currentPrice = form.getValues("price");
                          const currentDiscount = Number(form.getValues("discount")) || 0;
                          const currentServiceCharge = Number(form.getValues("serviceCharge")) || 0;
                          const baseCommission = (currentPrice * parseFloat(commission.percentage_commission)) / 100;
                          setValue("commission", parseFloat((baseCommission - currentDiscount + currentServiceCharge).toFixed(2)), { shouldValidate: true, shouldDirty: true });
                        }
                      }
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select package type..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(packageTypesData || []).map((pt: { id: string; name: string }) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="quoteTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Booking Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      placeholder="Enter title..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="tourOperatorId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Tour Operator</FormLabel>
                  <FormControl>
                    <SearchableSelect
                      options={(tourOperatorsData || []).map((op: { id: string; name: string | null }) => ({
                        value: op.id,
                        label: op.name || op.id,
                      }))}
                      value={field.value ?? ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const currentPackageType = form.getValues("packageType");
                        if (currentPackageType) {
                          const op = tourOperatorsData?.find((o: { id: string }) => o.id === value);
                          const commission = op?.commissions?.find((c: { package_type_id: string | null }) => c.package_type_id === currentPackageType);
                          if (commission?.percentage_commission != null) {
                            const currentPrice = form.getValues("price");
                            const currentDiscount = Number(form.getValues("discount")) || 0;
                            const currentServiceCharge = Number(form.getValues("serviceCharge")) || 0;
                            const baseCommission = (currentPrice * parseFloat(commission.percentage_commission)) / 100;
                            setValue("commission", parseFloat((baseCommission - currentDiscount + currentServiceCharge).toFixed(2)), { shouldValidate: true, shouldDirty: true });
                          }
                        }
                      }}
                      placeholder="Select operator..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="leadSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Lead Source</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select lead source..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["SHOP", "FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE_ENQUIRY"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={ImagePlus} title="Quote Images" />
          <div className="space-y-3">
            <div className="space-y-1.5">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length > 0) {
                    setImageFiles((prev) => [...prev, ...files]);
                  }
                  if (imageInputRef.current) imageInputRef.current.value = "";
                }}
                className="hidden"
                data-testid="input-quote-images"
              />
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full rounded-xl border-black/10 bg-white/70 text-sm"
                onClick={() => imageInputRef.current?.click()}
                data-testid="button-add-images"
              >
                <ImagePlus className="mr-2 h-4 w-4" />
                Add images
              </Button>
            </div>

            {(imageFiles.length > 0 || imageUrls.length > 0) && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {imageFiles.map((file, idx) => (
                  <div key={`file-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="h-20 w-full object-cover"
                      data-testid={`img-quote-preview-file-${idx}`}
                    />
                    <button
                      type="button"
                      onClick={() => setImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      data-testid={`button-remove-image-file-${idx}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">
                      {file.name}
                    </div>
                  </div>
                ))}
                {imageUrls.map((url, idx) => (
                  <div key={`url-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                    <img
                      src={url}
                      alt={`Image ${idx + 1}`}
                      className="h-20 w-full object-cover"
                      data-testid={`img-quote-preview-url-${idx}`}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "";
                        (e.target as HTMLImageElement).alt = "Failed to load";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                      data-testid={`button-remove-image-url-${idx}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
                      From JSON
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={Users} title="Travel Details" />
          <div className="grid gap-3 md:grid-cols-3">
            <FormField
              control={control}
              name="travelDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Travel Date</FormLabel>
                  <FormControl>
                    <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="nights"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Nights</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      min={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="transferType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Transfer Type</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select transfer..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[
                        "Private Transfer",
                        "Shared Transfer",
                        "Seaplane",
                        "Speedboat",
                        "Self-drive",
                        "None",
                      ].map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="passengersAdults"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Adults</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      min={1}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="passengersChildren"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Children</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      min={0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="passengersInfants"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Infants</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      min={0}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="flightMeals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Flight Meals</FormLabel>
                  <Select value={field.value ?? ""} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="preBookedSeats"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Pre-booked Seats</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      placeholder="e.g. 2A, 2B"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {Number(passengersChildren) > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-black/60">Child Ages</p>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Number(passengersChildren) }, (_, i) => (
                  <FormField
                    key={i}
                    control={control}
                    name={`childAges.${i}`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <Input
                            type="number"
                            {...field}
                            className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                            placeholder={`Child ${i + 1}`}
                            min={0}
                            max={17}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {isHotTubBreak && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Hotel} title="Lodge Details" />
            <div className="grid gap-3 md:grid-cols-3">
              <FormField
                control={control}
                name="parkId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Park</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(parksData ?? []).map(
                          (p: { id: string; name: string | null }) => ({
                            value: p.id,
                            label: p.name || p.id,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select park..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="lodgeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Lodge</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(lodgesData ?? []).map(
                          (l: { id: string; lodge_name: string | null; lodge_code: string | null }) => ({
                            value: l.id,
                            label: l.lodge_name || l.lodge_code || l.id,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder={parkId ? "Select lodge..." : "Select a park first"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="nights"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Nights</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        min={1}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Check-in Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="pets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">
                      <div className="flex items-center gap-1.5">
                        <PawPrint className="h-3.5 w-3.5" />
                        Pets Allowed
                      </div>
                    </FormLabel>
                    <FormControl>
                      <div className="flex h-9 items-center">
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {isCruise && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Anchor} title="Cruise Details" />

            <FormField
              control={control}
              name="cruiseOnly"
              render={({ field }) => (
                <FormItem className="mb-3 flex items-center gap-3">
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="text-xs font-medium text-black/60 !mt-0">Cruise Only (no flights)</FormLabel>
                </FormItem>
              )}
            />

            <div className="grid gap-3 md:grid-cols-2">
              {[
                { name: "cruiseTitle" as const, label: "Cruise Title" },
                { name: "cabinType" as const, label: "Cabin Type" },
                { name: "embarkation" as const, label: "Embarkation Port" },
                { name: "debarkation" as const, label: "Debarkation Port" },
              ].map(({ name, label }) => (
                <FormField
                  key={name}
                  control={control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-black/60">{label}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}

              <FormField
                control={control}
                name="cruiseLine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Line</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(cruiseLinesData || []).map((l) => ({ value: l.name ?? "", label: l.name ?? "" }))}
                        value={field.value ?? ""}
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("shipName", "");
                          setValue("cruiseDate", "");
                        }}
                        placeholder="Select cruise line..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="shipName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Ship Name</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(shipsData || []).map((s) => ({ value: s.name ?? "", label: s.name ?? "" }))}
                        value={field.value ?? ""}
                        onValueChange={(val) => {
                          field.onChange(val);
                          setValue("cruiseDate", "");
                        }}
                        placeholder={!selectedCruiseLineId ? "Select a cruise line first" : "Select ship..."}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="cruiseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Date</FormLabel>
                    <FormControl>
                      <Select
                        disabled={!cruiseItineraries?.length}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                          <SelectValue
                            placeholder={
                              !selectedCruiseLineId
                                ? "Select a cruise line first"
                                : !selectedShipId
                                  ? "Select a ship first"
                                  : isFetchingCruiseDates
                                    ? "Loading..."
                                    : "No voyages available for this ship"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {(cruiseItineraries || []).map((it) => (
                            <SelectItem key={it.id} value={it.date}>
                              {it.date}{it.departure_port ? ` — ${it.departure_port}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="cruiseExtras"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Extras</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="Any extras..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {!isHotTubBreak && !isCruise && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={MapPin} title="Destination & Accommodation" />
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name="country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Country</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(countriesData || []).map(
                          (c: { id: string; country_name: string }) => ({
                            value: c.id,
                            label: c.country_name,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select country..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Destination</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(destinationsData || []).map(
                          (d: { id: string; name: string }) => ({
                            value: d.id,
                            label: d.name,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={(value) => {
                          const label = (destinationsData || []).find((d) => d.id === value)?.name || "";
                          setDestLabel(label);
                          field.onChange(value);
                        }}
                        selectedLabel={destLabel}
                        onSearch={setDestSearch}
                        isLoading={isDestFetching}
                        placeholder="Search destinations..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="resort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Resort</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(resortsData || []).map(
                          (r: { id: string; name: string }) => ({
                            value: r.id,
                            label: r.name,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select resort..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="accommodationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Accommodation</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(accommodationsData || []).map(
                          (a: { id: string; name: string }) => ({
                            value: a.id,
                            label: a.name,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select accommodation..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="boardBasisId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Board Basis</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(boardBasisData || []).map(
                          (b: { id: string; type: string }) => ({
                            value: b.id,
                            label: b.type,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select board basis..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="roomType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Room Type</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(roomTypeData || []).map(
                          (r: { id: string; name: string | null }) => ({
                            value: r.id,
                            label: r.name || r.id,
                          })
                        )}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select room type..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="checkInDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Check-in Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="checkInTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Check-in Time</FormLabel>
                    <FormControl>
                      <Input
                        type="time"
                        {...field}
                        value={field.value ?? ""}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        )}

        {showFlights && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Plane} title="Flights" />

            <p className="mb-2 text-xs font-semibold text-black/50 uppercase tracking-wide">Outbound</p>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name="outboundDepartAirportId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={departureAirportOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select airport..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundArriveAirportId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={airportOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select airport..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundDepartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundDepartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundArriveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundArriveTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="outboundFlightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA2490" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {outboundLegs.map((leg, idx) => (
              <BookingConnectingLegFields
                key={leg.id}
                control={control}
                direction="outbound"
                index={idx}
                airportOptions={airportOptions}
                onRemove={() => removeOutbound(idx)}
              />
            ))}
            {outboundLegs.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 rounded-xl text-xs"
                onClick={() => appendOutbound({ ...emptyFlightLeg })}
              >
                <Plus className="mr-1 h-3 w-3" /> Add connecting leg
              </Button>
            )}

            <p className="mb-2 mt-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Inbound</p>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField
                control={control}
                name="inboundDepartAirportId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={airportOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select airport..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundArriveAirportId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={airportOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        placeholder="Select airport..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundDepartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundDepartTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundArriveDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundArriveTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name="inboundFlightNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA2491" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {inboundLegs.map((leg, idx) => (
              <BookingConnectingLegFields
                key={leg.id}
                control={control}
                direction="inbound"
                index={idx}
                airportOptions={airportOptions}
                onRemove={() => removeInbound(idx)}
              />
            ))}
            {inboundLegs.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 h-7 rounded-xl text-xs"
                onClick={() => appendInbound({ ...emptyFlightLeg })}
              >
                <Plus className="mr-1 h-3 w-3" /> Add connecting leg
              </Button>
            )}
          </div>
        )}

        {/* ── EXTRAS ────────────────────────────────────────────────────────── */}
        <BookingExtrasSection control={control as Control<ExtrasFormValues>} />

        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={DollarSign} title="Pricing" />
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { name: "price" as const, label: "Total Price (£)" },
                { name: "commission" as const, label: "Commission (£)" },
                { name: "discount" as const, label: "Discount (£)" },
                { name: "serviceCharge" as const, label: "Service Charge (£)" },
                { name: "pricePerPerson" as const, label: "Price Per Person (£)" },
              ] as const
            ).map(({ name, label }) => (
              <FormField
                key={name}
                control={control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">{label}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          if (name === "price" || name === "discount" || name === "serviceCharge") {
                            const currentPrice = name === "price" ? parseFloat(e.target.value) || 0 : Number(form.getValues("price")) || 0;
                            const currentDiscount = name === "discount" ? parseFloat(e.target.value) || 0 : Number(form.getValues("discount")) || 0;
                            const currentServiceCharge = name === "serviceCharge" ? parseFloat(e.target.value) || 0 : Number(form.getValues("serviceCharge")) || 0;
                            
                            // Recalculate commission: base commission from price, then adjust with discount/service charge
                            const currentOperatorId = form.getValues("tourOperatorId");
                            const currentPackageType = form.getValues("packageType");
                            
                            if (currentOperatorId && currentPackageType) {
                              const op = tourOperatorsData?.find((o: { id: string }) => o.id === currentOperatorId);
                              const comm = op?.commissions?.find((c: { package_type_id: string | null }) => c.package_type_id === currentPackageType);
                              
                              if (comm?.percentage_commission != null) {
                                // Calculate base commission from original price, then subtract discount and add service charge
                                const baseCommission = (currentPrice * parseFloat(comm.percentage_commission)) / 100;
                                const adjustedCommission = baseCommission - currentDiscount + currentServiceCharge;
                                
                                setValue("commission", parseFloat(adjustedCommission.toFixed(2)), { shouldValidate: true, shouldDirty: true });
                              }
                            }
                            
                            // Price per person is fixed by total price (not affected by discount/service charge)
                            const adults = Number(form.getValues("passengersAdults")) || 0;
                            const children = Number(form.getValues("passengersChildren")) || 0;
                            const total = adults + children;
                            setValue("pricePerPerson", total > 0 ? parseFloat((currentPrice / total).toFixed(2)) : 0);
                          }
                        }}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        min={0}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          {(() => {
            const currentPrice = Number(price) || 0;
            const currentDiscount = Number(discount) || 0;
            const currentServiceCharge = Number(serviceCharge) || 0;
            const currentCommission = Number(commission) || 0;
            const hasAdjustments = currentDiscount > 0 || currentServiceCharge > 0;
            
            if (hasAdjustments) {
              return (
                <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3">
                  <div className="text-xs font-medium text-blue-900">
                    Commission Adjusted: £{currentCommission.toFixed(2)}
                  </div>
                  <div className="mt-1 text-[10px] text-blue-700/70">
                    {currentDiscount > 0 && `Discount: -£${currentDiscount.toFixed(2)} `}
                    {currentServiceCharge > 0 && `Service Charge: +£${currentServiceCharge.toFixed(2)}`}
                  </div>
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          {onCancel && (
            <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
          )}
          <Button type="submit" className="rounded-xl" disabled={isLoading}>
            {isLoading ? "Saving..." : submitLabel}
          </Button>
        </div>
      </form>
    </Form>
  );
}

import type { Control } from "react-hook-form";

interface BookingConnectingLegFieldsProps {
  control: Control<BookingFormValues>;
  direction: "outbound" | "inbound";
  index: number;
  airportOptions: { value: string; label: string }[];
  onRemove: () => void;
}

function BookingConnectingLegFields({
  control,
  direction,
  index,
  airportOptions,
  onRemove,
}: BookingConnectingLegFieldsProps) {
  const prefix = direction === "outbound"
    ? (`outboundConnectingLegs.${index}` as const)
    : (`inboundConnectingLegs.${index}` as const);

  return (
    <div className="relative mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full p-0.5 text-black/40 hover:bg-black/10 hover:text-black/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="mb-2 text-xs font-semibold text-black/50">Connecting Leg {index + 1}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <FormField
          control={control}
          name={`${prefix}.departAirportId` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={airportOptions}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  placeholder="Select airport..."
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.arriveAirportId` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={airportOptions}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  placeholder="Select airport..."
                />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.departDate` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.departTime` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.flightNumber` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA123" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
