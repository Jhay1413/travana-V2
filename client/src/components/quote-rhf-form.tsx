import { useState, useEffect, useRef } from "react";
import { parseISO, isValid, addDays, format } from "date-fns";
import { useForm, useFieldArray, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Anchor, Hotel, Plane, Plus, X, PawPrint, FileText, DollarSign, MapPin, Users, Upload, ImagePlus, ExternalLink, Tag } from "lucide-react";
import { handleJsonUpload as handleJsonUploadUtil } from "@/lib/json-import-handler";
import { QuoteExtrasSection } from "@/components/quote-extras-section";
import type { ExtrasFormValues } from "@/types/booking";
import { getDepartureAirportOptions } from "@/lib/uk-airports";
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
  useAccommodationSearch,
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
import { useTags } from "@/hooks/queries/use-tags";
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

// ─── Tag Selector ─────────────────────────────────────────────────────────────

function TagSelectorSection({ control }: { control: any }) {
  const { data: allTagsData = [] } = useTags();
  const allTagNames: string[] = allTagsData.map((t: any) => t.name);
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <FormField
      control={control}
      name="tags"
      render={({ field }) => {
        const selected: string[] = field.value ?? [];
        const toggle = (name: string) => {
          if (selected.includes(name)) {
            field.onChange(selected.filter((t) => t !== name));
          } else {
            field.onChange([...selected, name]);
          }
        };
        const addTag = (name: string) => {
          const trimmed = name.trim();
          if (!trimmed || selected.includes(trimmed)) return;
          field.onChange([...selected, trimmed]);
          setInputValue("");
          setShowSuggestions(false);
        };
        const filtered = allTagNames.filter(
          (t) => (!inputValue.trim() || t.toLowerCase().includes(inputValue.trim().toLowerCase())) && !selected.includes(t)
        );
        return (
          <FormItem>
            <div className="rounded-2xl border border-black/10 bg-white/60 p-3">
              <SectionHeader icon={Tag} title="Tags" />
              {(allTagNames.length > 0 || selected.length > 0) && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {allTagNames.map((name) => {
                    const isSelected = selected.includes(name);
                    return (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggle(name)}
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                          isSelected
                            ? "border-blue-500/30 bg-blue-500/10 text-blue-700"
                            : "border-black/10 bg-white/70 text-black/50 hover:border-black/20 hover:text-black/70"
                        }`}
                      >
                        {isSelected && <span className="mr-1 text-blue-500">✓</span>}
                        {name}
                      </button>
                    );
                  })}
                  {selected.filter((s) => !allTagNames.includes(s)).map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggle(name)}
                      className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-700"
                    >
                      <span className="mr-1 text-blue-500">✓</span>
                      {name}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}
              <div className="relative flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Input
                    ref={inputRef}
                    placeholder="Add tag…"
                    className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
                    value={inputValue}
                    onChange={(e) => { setInputValue(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addTag(inputValue); }
                      if (e.key === "Escape") setShowSuggestions(false);
                    }}
                  />
                  {showSuggestions && filtered.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg"
                    >
                      {filtered.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className="w-full px-2.5 py-1.5 text-left text-[11px] text-black/70 transition hover:bg-black/[0.04]"
                          onClick={() => addTag(t)}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  type="button"
                  className="h-7 rounded-xl bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
                  disabled={!inputValue.trim()}
                  onClick={() => addTag(inputValue)}
                >
                  Add
                </Button>
              </div>
            </div>
          </FormItem>
        );
      }}
    />
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function QuoteRHFForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  onCancel,
  existingImages = [],
  initialImageUrls = [],
  initialExtraAccomLabels = [],
}: QuoteRHFFormProps) {
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { ...defaultQuoteFormValues, ...defaultValues },
  });

  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imageUrls, setImageUrls] = useState<string[]>(initialImageUrls);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [existingImagesState, setExistingImagesState] = useState<{ id: string; url: string }[]>(existingImages);
  const [destSearch, setDestSearch] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [accomSearch, setAccomSearch] = useState("");
  const [accomLabel, setAccomLabel] = useState("");
  const [resortLabel, setResortLabel] = useState("");
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
  const checkInDate = watch("checkInDate");
  const nights = watch("nights");

  // ── Lookup data ──────────────────────────────────────────────────────────
  const { data: packageTypesData } = usePackageTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();
  const { data: countriesData } = useCountries();
  const { data: destinationsData, isFetching: isDestFetching } = useDestinationSearch(destSearch, country || undefined);
  const { data: resortsData } = useResorts(destination || undefined, !destination ? (country || undefined) : undefined);
  const { data: accommodationsData, isFetching: isAccomFetching } = useAccommodationSearch(accomSearch, resort || undefined, !resort ? (destination || undefined) : undefined, !resort && !destination ? (country || undefined) : undefined);
  const { data: parksData } = useParks();
  const { data: lodgesData } = useLodges(parkId || undefined);

  // ── Package type name resolution ─────────────────────────────────────────
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
    const currentDiscount = Number(form.getValues("discount")) || 0;
    const currentServiceCharge = Number(form.getValues("serviceCharge")) || 0;
    const adults = Number(passengersAdults) || 0;
    const children = Number(passengersChildren) || 0;
    const total = adults + children;
    const netPrice = price - currentDiscount + currentServiceCharge;
    setValue("pricePerPerson", total > 0 ? parseFloat((netPrice / total).toFixed(2)) : 0);
  }, [passengersAdults, passengersChildren, discount, serviceCharge]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Flight date sync from check-in date ──────────────────────────────────
  useEffect(() => {
    if (!checkInDate) return;
    const date = parseISO(checkInDate);
    if (!isValid(date)) return;
    setValue("outboundDepartDate", checkInDate, { shouldDirty: true });
    const nightCount = Number(nights) || 0;
    if (nightCount > 0) {
      setValue("inboundDepartDate", format(addDays(date, nightCount), "yyyy-MM-dd"), { shouldDirty: true });
    }
  }, [checkInDate, nights, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Options ───────────────────────────────────────────────────────────────
  const airportOptions = (airportsData || []).map(
    (a: { id: string; airport_name: string; airport_code?: string | null }) => ({
      value: a.id,
      label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
    })
  );
  const departureAirportOptions = getDepartureAirportOptions(airportsData);

  // ── JSON upload ───────────────────────────────────────────────────────────
  const handleJsonUpload = (file: File) => {
    // Clear all existing images and stage them for deletion before importing new ones
    setDeletedImageIds((prev) => [...prev, ...existingImagesState.map((i) => i.id)]);
    setExistingImagesState([]);
    setImageFiles([]);

    handleJsonUploadUtil(file, {
      form,
      airportsData,
      packageTypesData,
      queryClient,
      lookupKeys,
      toast,
      setImageUrls,
      skipLodgeResetRef,
      fallbackFieldMapper: (data, setIfPresent) => {
        setIfPresent("quoteLink", data.quoteLink || data.quote_link || data.link);
      },
    });
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
      <form onSubmit={form.handleSubmit((values) => onSubmit(values, { files: imageFiles, urls: imageUrls, deletedImageIds }))} className="space-y-4">

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
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="https://..."
                      />
                    </FormControl>
                    {field.value && (
                      <a
                        href={field.value}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-600 transition hover:bg-blue-100 whitespace-nowrap"
                        data-testid="link-view-quote-link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        View Link
                      </a>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* ── QUOTE IMAGES ─────────────────────────────────────────────────── */}
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

            {existingImagesState.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {existingImagesState.map((img) => (
                  <div key={img.id} className="group relative overflow-hidden rounded-xl border border-black/10">
                    <img
                      src={img.url}
                      alt="Existing image"
                      className="h-20 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setDeletedImageIds((prev) => [...prev, img.id]);
                        setExistingImagesState((prev) => prev.filter((i) => i.id !== img.id));
                      }}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
                      Saved
                    </div>
                  </div>
                ))}
              </div>
            )}

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

              {/* Lodge */}
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
              {/* Cruise Title */}
              <FormField
                control={control}
                name="cruiseTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Title</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cruise Line - searchable dropdown */}
              <FormField
                control={control}
                name="cruiseLine"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cruise Line</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(cruiseLinesData || []).map(l => ({ value: l.name ?? l.id, label: l.name ?? l.id }))}
                        value={field.value ?? ""}
                        onValueChange={(name) => {
                          field.onChange(name);
                          setValue('shipName', '');
                          setValue('cruiseDate', '');
                        }}
                        placeholder="Select cruise line..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Ship - searchable dropdown filtered by cruise line */}
              <FormField
                control={control}
                name="shipName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Ship Name</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={(shipsData || []).map(s => ({ value: s.name ?? s.id, label: s.name ?? s.id }))}
                        value={field.value ?? ""}
                        onValueChange={(name) => {
                          field.onChange(name);
                          setValue('cruiseDate', '');
                        }}
                        placeholder={selectedCruiseLineId ? "Select ship..." : "Select cruise line first"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cruise Date - only selectable from available voyage dates for the selected ship */}
              <FormField
                control={control}
                name="cruiseDate"
                render={({ field }) => {
                  const cruiseDatePlaceholder = !selectedCruiseLineId
                    ? "Select a cruise line first"
                    : !selectedShipId
                      ? "Select a ship first"
                      : isFetchingCruiseDates
                        ? "Loading..."
                        : "No voyages available for this ship";
                  return (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-black/60">Cruise Date</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          disabled={!cruiseItineraries?.length}
                        >
                          <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                            <SelectValue placeholder={cruiseDatePlaceholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {(cruiseItineraries || []).map(it => (
                              <SelectItem key={it.id} value={it.date}>
                                {it.date}{it.departure_port ? ` — ${it.departure_port}` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Cabin Type */}
              <FormField
                control={control}
                name="cabinType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Cabin Type</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Embarkation Port */}
              <FormField
                control={control}
                name="embarkation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Embarkation Port</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Debarkation Port */}
              <FormField
                control={control}
                name="debarkation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Debarkation Port</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cruise Extras */}
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

        {/* ── DESTINATION & ACCOMMODATION (non-lodge, non-cruise) ────────────── */}
        {!isHotTubBreak && !isCruise && (
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
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("destination", "");
                          setValue("resort", "");
                          setValue("accommodationId", "");
                          setDestLabel("");
                          setResortLabel("");
                          setAccomLabel("");
                        }}
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
                        onValueChange={(value) => {
                          const label = (destinationsData || []).find((d) => d.id === value)?.name || "";
                          setDestLabel(label);
                          field.onChange(value);
                          setValue("resort", "");
                          setValue("accommodationId", "");
                          setResortLabel("");
                          setAccomLabel("");
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
                        selectedLabel={resortLabel}
                        onValueChange={(value) => {
                          field.onChange(value);
                          setValue("accommodationId", "");
                          setAccomLabel("");
                          const selectedResort = (resortsData || []).find((r) => r.id === value);
                          if (selectedResort?.destination_id) {
                            setValue("destination", selectedResort.destination_id);
                            setDestLabel(selectedResort.destination_name || "");
                          }
                          if (selectedResort?.country_id) {
                            setValue("country", selectedResort.country_id);
                          }
                          setResortLabel(selectedResort?.name || "");
                        }}
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
                        selectedLabel={accomLabel}
                        onSearch={setAccomSearch}
                        isLoading={isAccomFetching}
                        emptyMessage={!accomSearch && !resort && !destination && !country ? "Type to search accommodations..." : "No accommodations found."}
                        onValueChange={(value) => {
                          field.onChange(value);
                          const selected = (accommodationsData || []).find((a) => a.id === value);
                          if (selected) {
                            setAccomLabel(selected.name);
                            if (selected.resorts_id) {
                              setValue("resort", selected.resorts_id);
                              setResortLabel(selected.resort_name || "");
                            }
                            if (selected.destination_id) {
                              setValue("destination", selected.destination_id);
                              setDestLabel(selected.destination_name || "");
                            }
                            if (selected.country_id) {
                              setValue("country", selected.country_id);
                            }
                          }
                        }}
                        placeholder="Search accommodation..."
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

        {/* ── EXTRAS ────────────────────────────────────────────────────────── */}
        <QuoteExtrasSection control={control as unknown as Control<ExtrasFormValues>} initialAccomLabels={initialExtraAccomLabels} mainTourOperatorId={tourOperatorId ?? ""} />

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
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
                            
                            // Price per person = (salesPrice - discount + serviceCharge) / (adults + children)
                            const adults = Number(form.getValues("passengersAdults")) || 0;
                            const children = Number(form.getValues("passengersChildren")) || 0;
                            const total = adults + children;
                            const netPrice = currentPrice - currentDiscount + currentServiceCharge;
                            setValue("pricePerPerson", total > 0 ? parseFloat((netPrice / total).toFixed(2)) : 0);
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

        {/* ── TAGS ──────────────────────────────────────────────────────────── */}
        <TagSelectorSection control={control} />

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
          name={`${prefix}.arriveTime` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
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
