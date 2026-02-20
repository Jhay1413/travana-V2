import { useEffect, useRef } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Anchor, Hotel, Plane, Plus, X, PawPrint, FileText, DollarSign, MapPin, Users, Upload } from "lucide-react";
import { quoteFormSchema, defaultQuoteFormValues } from "@/types/quote";
import type { QuoteFormValues, FlightLegValue, QuoteRHFFormProps } from "@/types/quote";

export { quoteFormSchema, defaultQuoteFormValues } from "@/types/quote";
export type { QuoteFormValues, FlightLegValue, QuoteRHFFormProps } from "@/types/quote";
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
  useDestinations,
  useAllDestinations,
  useResorts,
  usePackageTypes,
  useRoomTypes,
  useParks,
  useLodges,
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

// ─── Section Header ──────────────────────────────────────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────────

export function QuoteRHFForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  onCancel,
}: QuoteRHFFormProps) {
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { ...defaultQuoteFormValues, ...defaultValues },
  });

  const { watch, setValue, control } = form;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const packageType = watch("packageType");
  const country = watch("country");
  const destination = watch("destination");
  const resort = watch("resort");
  const parkName = watch("parkName");
  const passengersChildren = watch("passengersChildren");
  const cruiseOnly = watch("cruiseOnly");

  // ── Lookup data ──────────────────────────────────────────────────────────
  const { data: packageTypesData } = usePackageTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();
  const { data: countriesData } = useCountries();
  const { data: filteredDestinationsData } = useDestinations(country || undefined);
  const { data: allDestinationsData } = useAllDestinations();
  const { data: resortsData } = useResorts(destination || undefined);
  const { data: accommodationsData } = useAccommodations(resort || undefined);
  const { data: parksData } = useParks();
  const { data: lodgesData } = useLodges(parkName || undefined);

  const destinationsData = country ? filteredDestinationsData : allDestinationsData;

  // ── Package type name resolution ─────────────────────────────────────────
  const packageTypeName =
    packageTypesData?.find((p: { id: string; name: string }) => p.id === packageType)?.name ||
    packageType;

  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && cruiseOnly);

  // ── Cascading select resets (skip on first render to preserve defaultValues) ──
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setValue("destination", "");
    setValue("resort", "");
    setValue("accommodationId", "");
  }, [country]); // eslint-disable-line react-hooks/exhaustive-deps

  const isDestFirstRender = useRef(true);
  useEffect(() => {
    if (isDestFirstRender.current) {
      isDestFirstRender.current = false;
      return;
    }
    setValue("resort", "");
    setValue("accommodationId", "");
  }, [destination]); // eslint-disable-line react-hooks/exhaustive-deps

  const isResortFirstRender = useRef(true);
  useEffect(() => {
    if (isResortFirstRender.current) {
      isResortFirstRender.current = false;
      return;
    }
    setValue("accommodationId", "");
  }, [resort]); // eslint-disable-line react-hooks/exhaustive-deps

  const isParkFirstRender = useRef(true);
  useEffect(() => {
    if (isParkFirstRender.current) {
      isParkFirstRender.current = false;
      return;
    }
    setValue("lodgeCode", "");
  }, [parkName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Child ages sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const currentAges = form.getValues("childAges");
    const count = Number(passengersChildren) || 0;
    if (currentAges.length !== count) {
      const newAges = Array.from({ length: count }, (_, i) => currentAges[i] ?? 0);
      setValue("childAges", newAges);
    }
  }, [passengersChildren, setValue, form]);

  // ── Options ───────────────────────────────────────────────────────────────
  const airportOptions = (airportsData || []).map(
    (a: { id: string; airport_name: string; airport_code?: string | null }) => ({
      value: a.id,
      label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
    })
  );

  // ── JSON upload ───────────────────────────────────────────────────────────
  const handleJsonUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const content = (ev.target?.result as string) || "";
      const toIsoDate = (d: string | undefined): string => {
        if (!d) return "";
        const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (match) {
          const [, day, month, year] = match;
          return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
        }
        return d;
      };
      try {
        const data = JSON.parse(content);

        const isScraperFormat =
          Array.isArray(data.flights) ||
          data.sales_price !== undefined ||
          data.departure_airport !== undefined ||
          data.lodge_id !== undefined ||
          data.lodge_type !== undefined ||
          data.lodge_code !== undefined ||
          data.lodge_park_name !== undefined ||
          data.cottage_id !== undefined ||
          data.hot_tub !== undefined ||
          data.pets !== undefined ||
          Array.isArray(data.lodge_images) ||
          data.board_basis_name !== undefined;

        if (isScraperFormat) {
          try {
            const { mapScraperJsonToFormFields } = await import("@/lib/scraper-json-parser");
            const { jsonMapperApi } = await import("@/api/endpoints/json-mapper.api");

            const result = mapScraperJsonToFormFields(data);

            const resolveAirportId = (airportText: string | undefined): string => {
              if (!airportText || !airportsData) return "";
              const needle = airportText.trim().toLowerCase();
              if (!needle) return "";
              const exact = airportsData.find(
                (a: { id: string; airport_name: string; airport_code?: string | null }) =>
                  (a.airport_name || "").trim().toLowerCase() === needle ||
                  (a.airport_code || "").trim().toLowerCase() === needle
              );
              if (exact) return exact.id;
              const partial = airportsData.find(
                (a: { id: string; airport_name: string; airport_code?: string | null }) => {
                  const name = (a.airport_name || "").trim().toLowerCase();
                  const code = (a.airport_code || "").trim().toLowerCase();
                  return (
                    name.includes(needle) ||
                    needle.includes(name) ||
                    (code.length > 0 && (code.includes(needle) || needle.includes(code)))
                  );
                }
              );
              return partial?.id || "";
            };

            const hasLodgeFieldsInJson = !!(
              data.lodge_type ||
              data.lodge_code ||
              data.lodge_id ||
              data.lodge_park_name ||
              Array.isArray(data.lodge_images) ||
              data.cottage_id !== undefined ||
              data.hot_tub !== undefined ||
              data.pets !== undefined
            );
            const currentPackageType = form.getValues("packageType");
            const currentPackageName =
              packageTypesData?.find(
                (p: { id: string; name: string }) => p.id === currentPackageType
              )?.name || currentPackageType;
            const isCurrentFormLodge = currentPackageName === "Hot Tub Break";
            const tourOp = (data.tour_operator || result.fields.tourOperator || "").toLowerCase().trim();
            const lodgeTourOperators = [
              "hoseasons", "haven", "parkdean", "park dean", "butlins",
              "center parcs", "centre parcs", "away resorts", "park holidays",
            ];
            const isLodgeTourOperator = lodgeTourOperators.some((op) => tourOp.includes(op));
            const isLodgeQuote = hasLodgeFieldsInJson || isCurrentFormLodge || isLodgeTourOperator;

            const lodgeParkName = data.lodge_park_name || data.resort || result.fields.resort || "";
            const lodgeCodeVal = data.lodge_code || data.cottage_id || null;
            const lodgeName = data.accommodation || result.fields.accommodation || "";
            const lodgeType = data.lodge_type || "";
            const parkCode = data.lodge_id || null;

            const mappingInput: Record<string, unknown> = {
              country: result.fields.country,
              destination: result.fields.destination,
              resort: result.fields.resort,
              accommodation: result.fields.accommodation,
              boardBasis: result.fields.boardBasis,
              tourOperator: result.fields.tourOperator,
              outboundDepartAirport: result.fields.outboundDepartAirport,
              outboundArriveAirport: result.fields.outboundArriveAirport,
              inboundDepartAirport: result.fields.inboundDepartAirport,
              inboundArriveAirport: result.fields.inboundArriveAirport,
              roomType: result.fields.roomType,
              isLodgeQuote,
              lodgeCode: lodgeCodeVal,
              lodgeName: isLodgeQuote ? (lodgeName || undefined) : undefined,
              parkName: isLodgeQuote ? (lodgeParkName || undefined) : undefined,
              parkCode,
            };

            const idMapping = await jsonMapperApi.mapToIds(mappingInput);

            if (idMapping.warnings.length > 0) {
              toast({
                title: idMapping.warnings.some((w: string) => w.startsWith("Created"))
                  ? "Entities created"
                  : "Some values need attention",
                description: idMapping.warnings.join(", "),
              });
            } else {
              toast({ title: "JSON imported successfully", description: "All values mapped to database IDs" });
            }

            // Apply text fields (skip ID-only fields)
            const idOnlyFields = new Set([
              "country", "destination", "resort", "accommodation", "accommodationId",
              "boardBasis", "boardBasisId", "tourOperator", "tourOperatorId",
              "outboundDepartAirport", "outboundDepartAirportId",
              "outboundArriveAirport", "outboundArriveAirportId",
              "inboundDepartAirport", "inboundDepartAirportId",
              "inboundArriveAirport", "inboundArriveAirportId",
              "roomType",
            ]);
            for (const [k, v] of Object.entries(result.fields)) {
              if (v !== "" && v !== null && v !== undefined && !idOnlyFields.has(k)) {
                setValue(k as keyof QuoteFormValues, v as never);
              }
            }

            // Apply resolved IDs
            if (idMapping.countryId) setValue("country", idMapping.countryId);
            if (idMapping.destinationId) setValue("destination", idMapping.destinationId);
            if (idMapping.resortId) setValue("resort", idMapping.resortId);
            if (idMapping.accommodationId) setValue("accommodationId", idMapping.accommodationId);
            if (idMapping.boardBasisId) setValue("boardBasisId", idMapping.boardBasisId);
            if (idMapping.tourOperatorId) setValue("tourOperatorId", idMapping.tourOperatorId);
            if (idMapping.outboundDepartAirportId) setValue("outboundDepartAirportId", idMapping.outboundDepartAirportId);
            if (idMapping.outboundArriveAirportId) setValue("outboundArriveAirportId", idMapping.outboundArriveAirportId);
            if (idMapping.inboundDepartAirportId) setValue("inboundDepartAirportId", idMapping.inboundDepartAirportId);
            if (idMapping.inboundArriveAirportId) setValue("inboundArriveAirportId", idMapping.inboundArriveAirportId);
            if (idMapping.roomTypeId) setValue("roomType", idMapping.roomTypeId);

            // Apply lodge fields
            const serverDetectedLodge = (idMapping as Record<string, unknown>).isLodge === true;
            if (isLodgeQuote || serverDetectedLodge) {
              const hotTubPackage = packageTypesData?.find(
                (p: { id: string; name: string }) => p.name === "Hot Tub Break"
              );
              if (hotTubPackage) setValue("packageType", hotTubPackage.id);
              if (idMapping.parkId) setValue("parkName", idMapping.parkId);
              if (idMapping.lodgeId) setValue("lodgeCode", idMapping.lodgeId);
              setValue("country", "");
              setValue("destination", "");
              setValue("resort", "");
              setValue("accommodationId", "");

              queryClient.invalidateQueries({ queryKey: lookupKeys.parks });
              if (idMapping.parkId) {
                queryClient.invalidateQueries({ queryKey: lookupKeys.lodges(idMapping.parkId as string) });
              }
            }

            // Apply connecting legs
            setValue(
              "outboundConnectingLegs",
              result.outboundConnectingLegs.map((leg) => ({
                ...leg,
                departAirportId: resolveAirportId(leg.departAirport),
                arriveAirportId: resolveAirportId(leg.arriveAirport),
              }))
            );
            setValue(
              "inboundConnectingLegs",
              result.inboundConnectingLegs.map((leg) => ({
                ...leg,
                departAirportId: resolveAirportId(leg.departAirport),
                arriveAirportId: resolveAirportId(leg.arriveAirport),
              }))
            );
          } catch (error) {
            toast({
              title: "Error processing JSON",
              description: error instanceof Error ? error.message : "Failed to map values.",
              variant: "destructive",
            });
          }
          return;
        }

        // Fallback for non-scraper JSON
        const setIfPresent = <K extends keyof QuoteFormValues>(key: K, val: unknown) => {
          if (val !== undefined && val !== null && val !== "") setValue(key, val as QuoteFormValues[K]);
        };
        setIfPresent("packageType", data.packageType || data.package_type);
        setIfPresent("quoteTitle", data.quoteTitle || data.quote_title || data.title);
        setIfPresent("quoteLink", data.quoteLink || data.quote_link || data.link);
        setIfPresent("travelDate", toIsoDate(data.travelDate || data.travel_date || data.departureDate));
        setIfPresent("passengersAdults", data.passengers?.adults || data.adults || data.passengersAdults);
        setIfPresent("passengersChildren", data.passengers?.children || data.children || data.passengersChildren);
        setIfPresent("passengersInfants", data.passengers?.infants || data.infants || data.passengersInfants);
        setIfPresent("checkInDate", toIsoDate(data.checkInDate || data.check_in_date || data.checkin));
        setIfPresent("checkInTime", data.checkInTime || data.check_in_time);
        setIfPresent("nights", data.nights || data.duration);
        setIfPresent("transferType", data.transferType || data.transfer_type || data.transfers);
        setIfPresent("preBookedSeats", data.preBookedSeats || data.pre_booked_seats || data.seats);
        setIfPresent("flightMeals", data.flightMeals || data.flight_meals || data.meals);
        setIfPresent("outboundDepartDate", toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date));
        setIfPresent("outboundDepartTime", data.flights?.outbound?.departTime || data.outbound?.time);
        setIfPresent("outboundArriveDate", toIsoDate(data.flights?.outbound?.arriveDate));
        setIfPresent("outboundArriveTime", data.flights?.outbound?.arriveTime);
        setIfPresent("inboundDepartDate", toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date));
        setIfPresent("inboundDepartTime", data.flights?.inbound?.departTime || data.inbound?.time);
        setIfPresent("inboundArriveDate", toIsoDate(data.flights?.inbound?.arriveDate));
        setIfPresent("inboundArriveTime", data.flights?.inbound?.arriveTime);
        setIfPresent("price", data.commissions?.price || data.price || data.total);
        setIfPresent("commission", data.commissions?.commission || data.commission);
        setIfPresent("discount", data.commissions?.discount || data.discount);
        setIfPresent("serviceCharge", data.commissions?.serviceCharge || data.serviceCharge || data.service_charge);
        setIfPresent("pricePerPerson", data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp);
        toast({ title: "JSON imported", description: "Form populated from JSON." });
      } catch (err) {
        toast({
          title: "Error parsing JSON",
          description: err instanceof Error ? err.message : "Unknown error occurred",
          variant: "destructive",
        });
      }
    };
    reader.onerror = () => {
      toast({ title: "Error reading file", description: "Could not read the file.", variant: "destructive" });
    };
    reader.readAsText(file);
  };

  // ── Connecting legs ───────────────────────────────────────────────────────
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

        {/* ── JSON IMPORT ──────────────────────────────────────────────────── */}
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

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={FileText} title="Quote Overview" />
          <div className="grid gap-3 md:grid-cols-2">

            {/* Package Type */}
            <FormField
              control={control}
              name="packageType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Package Type *</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
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

            {/* Status */}
            <FormField
              control={control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Status</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder="Select status..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {["draft", "sent", "accepted", "rejected", "expired"].map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Quote Title */}
            <FormField
              control={control}
              name="quoteTitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Quote Title</FormLabel>
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

            {/* Tour Operator */}
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
                      onValueChange={field.onChange}
                      placeholder="Select operator..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Lead Source */}
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

            {/* Quote Link */}
            <FormField
              control={control}
              name="quoteLink"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-medium text-black/60">Quote Link</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      placeholder="https://..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── TRAVEL DETAILS ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={Users} title="Travel Details" />
          <div className="grid gap-3 md:grid-cols-3">

            {/* Travel Date */}
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

            {/* Nights */}
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

            {/* Transfer Type */}
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

            {/* Adults */}
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

            {/* Children */}
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

            {/* Infants */}
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

            {/* Flight Meals */}
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

            {/* Pre-booked Seats */}
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

          {/* Child Ages */}
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

        {/* ── HOT TUB BREAK: LODGE DETAILS ─────────────────────────────────── */}
        {isHotTubBreak && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Hotel} title="Lodge Details" />
            <div className="grid gap-3 md:grid-cols-3">

              {/* Park */}
              <FormField
                control={control}
                name="parkName"
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

              {/* Lodge */}
              <FormField
                control={control}
                name="lodgeCode"
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
                        placeholder={parkName ? "Select lodge..." : "Select a park first"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Nights */}
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

              {/* Check-in Date */}
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

              {/* Pets */}
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

        {/* ── CRUISE DETAILS ────────────────────────────────────────────────── */}
        {isCruise && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Anchor} title="Cruise Details" />

            {/* Cruise Only toggle */}
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
                { name: "cruiseLine" as const, label: "Cruise Line" },
                { name: "shipName" as const, label: "Ship Name" },
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
                name="cruiseDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Date</FormLabel>
                    <FormControl>
                      <DatePicker value={field.value ?? ""} onChange={field.onChange} />
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

        {/* ── DESTINATION & ACCOMMODATION (non-lodge) ────────────────────────── */}
        {!isHotTubBreak && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={MapPin} title="Destination & Accommodation" />
            <div className="grid gap-3 md:grid-cols-2">

              {/* Country */}
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

              {/* Destination */}
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
                        onValueChange={field.onChange}
                        placeholder="Select destination..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Resort */}
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

              {/* Accommodation */}
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

              {/* Board Basis */}
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

              {/* Room Type */}
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

              {/* Check-in Date */}
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

              {/* Check-in Time */}
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

        {/* ── FLIGHTS ───────────────────────────────────────────────────────── */}
        {showFlights && (
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <SectionHeader icon={Plane} title="Flights" />

            {/* Outbound */}
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

            {/* Outbound connecting legs */}
            {outboundLegs.map((leg, idx) => (
              <ConnectingLegFields
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

            {/* Inbound */}
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

            {/* Inbound connecting legs */}
            {inboundLegs.map((leg, idx) => (
              <ConnectingLegFields
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

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
          <SectionHeader icon={DollarSign} title="Pricing" />
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { name: "price" as const, label: "Total Price (£)" },
                { name: "commission" as const, label: "Commission (%)" },
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
        </div>

        {/* ── ACTIONS ───────────────────────────────────────────────────────── */}
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

// ─── Connecting Leg Sub-component ────────────────────────────────────────────

import type { Control } from "react-hook-form";

interface ConnectingLegFieldsProps {
  control: Control<QuoteFormValues>;
  direction: "outbound" | "inbound";
  index: number;
  airportOptions: { value: string; label: string }[];
  onRemove: () => void;
}

function ConnectingLegFields({
  control,
  direction,
  index,
  airportOptions,
  onRemove,
}: ConnectingLegFieldsProps) {
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
