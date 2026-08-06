import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseISO, isValid, addDays, format } from "date-fns";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import type { UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Anchor, Hotel, Plane, Plus, X, PawPrint, FileText, DollarSign, MapPin, Users, Upload, BookOpen, ImagePlus, Tag, Wallet, Ship, Trash2 } from "lucide-react";
import { walletApi } from "@/features/wallet/api/wallet.api";
import { handleJsonUpload as handleJsonUploadUtil } from "@/lib/json-import-handler";
import { QuoteImagesSection } from "@/features/quote/components/sections/QuoteImagesSection";
import {
  existingImageItem,
  pendingFiles,
  resolvedUrls,
  urlImageItem,
  type FormImageItem,
} from "@/features/quote/lib/form-images";
import { bookingFormSchema, defaultBookingFormValues } from "@/features/booking/types";
import type { BookingFormValues, FlightLegValue, BookingRHFFormProps, ExtrasFormValues, UpsellsFormValues } from "@/features/booking/types";
import { QuoteExtrasSection as BookingExtrasSection } from "@/features/quote/components/quote-extras-section";
import { TRANSFER_TYPES } from "@/features/quote/types/quote-form.types";
import { BookingUpsellsSection } from "@/features/booking/components/BookingUpsellsSection";

export { bookingFormSchema, defaultBookingFormValues } from "@/features/booking/types";
export type { BookingFormValues, FlightLegValue, BookingRHFFormProps } from "@/features/booking/types";
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
import { useTags } from "@/features/tag/api/use-tag-queries";
import { useToast } from "@/hooks/use-toast";
import { summarizeFormErrors, scrollToFirstFormError } from "@/lib/form-errors";
import { AddAccommodationModal } from "@/features/lookups/components/lookups/add-accommodation-modal";
import { AddBoardBasisModal } from "@/features/lookups/components/lookups/add-board-basis-modal";
import { AddRoomTypeModal } from "@/features/lookups/components/lookups/add-room-type-modal";

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

function WalletCreditSection({ clientId, control, setValue }: { clientId: string; control: any; setValue: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-balance", clientId],
    queryFn: () => walletApi.getBalance(clientId),
    enabled: !!clientId,
  });

  const available = parseFloat(data ?? "0");
  const allocatedAmount = useWatch({ control, name: "walletCreditAmount" }) as number;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={Wallet} title="Wallet Credit" />
      {isLoading ? (
        <div className="h-8 w-48 animate-pulse rounded-xl bg-black/5" />
      ) : available <= 0 ? (
        <p className="text-xs text-black/40">No wallet balance available for this client.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between rounded-xl border border-black/8 bg-black/[0.02] px-3 py-2">
            <span className="text-xs text-black/50">Available balance</span>
            <span className="text-sm font-semibold text-black/80">£{available.toFixed(2)}</span>
          </div>
          <FormField
            control={control}
            name="walletCreditAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-black/60">Amount to allocate (£)</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min={0}
                      max={available}
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        field.onChange(Math.min(val, available));
                      }}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 shrink-0 rounded-xl text-xs"
                    onClick={() => setValue("walletCreditAmount", available, { shouldDirty: true })}
                  >
                    Use all
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          {allocatedAmount > 0 && (
            <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-800">
              £{Number(allocatedAmount).toFixed(2)} will be applied as a booking credit when saved.
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function BookingRHFForm({
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  onCancel,
  initialExtraAccomLabels = [],
  existingImages = [],
  initialImageUrls = [],
  clientId,
}: BookingRHFFormProps) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: { ...defaultBookingFormValues, ...defaultValues },
  });
  // One ordered list — see features/quote/lib/form-images. Saved images first,
  // then anything pre-seeded from a JSON import.
  const [imageItems, setImageItems] = useState<FormImageItem[]>(() => [
    ...existingImages.map((i) => existingImageItem(i.id, i.url)),
    ...initialImageUrls.map(urlImageItem),
  ]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  const setImageUrlsFromJson = useCallback((updater: (prev: string[]) => string[]) => {
    setImageItems((prev) => {
      const kept = prev.filter((i) => i.kind !== "url");
      const nextUrls = updater(prev.flatMap((i) => (i.kind === "url" ? [i.url] : [])));
      return [...kept, ...nextUrls.map(urlImageItem)];
    });
  }, []);
  const [destSearch, setDestSearch] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [accomSearch, setAccomSearch] = useState("");
  const [accomLabel, setAccomLabel] = useState("");
  const [resortLabel, setResortLabel] = useState("");
  const [showAddAccomModal, setShowAddAccomModal] = useState(false);
  const [showAddBoardBasisModal, setShowAddBoardBasisModal] = useState(false);
  const [showAddRoomTypeModal, setShowAddRoomTypeModal] = useState(false);
  const [boardBasisSearch, setBoardBasisSearch] = useState("");
  const [roomTypeSearch, setRoomTypeSearch] = useState("");
  const imageInputRef = useRef<HTMLInputElement>(null);
  const skipLodgeResetRef = useRef(false);
  
  const { setValue, control, register } = form;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const packageType = useWatch({ control, name: "packageType" });
  const country = useWatch({ control, name: "country" });
  const destination = useWatch({ control, name: "destination" });
  const resort = useWatch({ control, name: "resort" });
  const parkId = useWatch({ control, name: "parkId" });
  const passengersAdults = useWatch({ control, name: "passengersAdults" });
  const passengersChildren = useWatch({ control, name: "passengersChildren" });
  const cruiseOnly = useWatch({ control, name: "cruiseOnly" });
  const tourOperatorId = useWatch({ control, name: "tourOperatorId" });
  const price = useWatch({ control, name: "price" });
  const discount = useWatch({ control, name: "discount" });
  const serviceCharge = useWatch({ control, name: "serviceCharge" });
  const commission = useWatch({ control, name: "commission" });
  const walletCreditAmount = useWatch({ control, name: "walletCreditAmount" });
  const checkInDate = useWatch({ control, name: "checkInDate" });
  const nights = useWatch({ control, name: "nights" });

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

  const packageTypeName =
    packageTypesData?.find((p: { id: string; name: string }) => p.id === packageType)?.name ||
    packageType;


  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && cruiseOnly);

  // ── Default new records to "Package Holiday" ──────────────────────────────
  // On create the package type starts empty; default it to the standard
  // "Package Holiday" once lookups load. Runs once and only when empty, so
  // edited records (which already carry a type) are left untouched.
  const didDefaultPackageType = useRef(false);
  useEffect(() => {
    if (didDefaultPackageType.current || !packageTypesData) return;
    didDefaultPackageType.current = true;
    if (!form.getValues("packageType")) {
      const pkg = packageTypesData.find((p: { id: string; name: string }) => p.name === "Package Holiday");
      if (pkg) setValue("packageType", pkg.id);
    }
  }, [packageTypesData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cruise cascade ────────────────────────────────────────────────────────
  const { data: cruiseLinesData } = useCruiseLines();
  const cruiseLine = useWatch({ control, name: "cruiseLine" });
  const shipName = useWatch({ control, name: "shipName" });
  const selectedCruiseLineId = cruiseLinesData?.find(l => l.name === cruiseLine)?.id;
  const { data: shipsData } = useShips(selectedCruiseLineId);
  const selectedShipId = shipsData?.find(s => s.name === shipName)?.id;
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
    // Total price = price − discount + service charge, split across all passengers.
    const netPrice = price - currentDiscount + currentServiceCharge;
    setValue("pricePerPerson", total > 0 ? parseFloat((netPrice / total).toFixed(2)) : 0);
  }, [passengersAdults, passengersChildren, discount, serviceCharge]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Commission auto-calculation ───────────────────────────────────────────
  // Commission = price × operator % − discount + service charge. The discount is
  // taken off the commission (not the price) and the service charge is added to it.
  useEffect(() => {
    if (tourOperatorId && tourOperatorsData) {
      const currentPrice = Number(price) || 0;
      const currentDiscount = Number(discount) || 0;
      const currentServiceCharge = Number(serviceCharge) || 0;
      const op = tourOperatorsData.find((o: { id: string }) => o.id === tourOperatorId);

      if (op?.commission_percentage != null && currentPrice > 0) {
        const operatorCommission = (currentPrice * parseFloat(op.commission_percentage)) / 100;
        const calculatedCommission = parseFloat((operatorCommission - currentDiscount + currentServiceCharge).toFixed(2));

        const currentCommission = form.getValues("commission");
        if (currentCommission !== calculatedCommission) {
          setValue("commission", calculatedCommission, { shouldValidate: true, shouldDirty: true });
        }
      }
    }
  }, [tourOperatorId, price, discount, serviceCharge, tourOperatorsData, form, setValue]);

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

  // ── Pricing breakdown (memoized to avoid recompute on every render) ────────
  const pricingBreakdown = useMemo(() => {
    const currentPrice = Number(price) || 0;
    const currentDiscount = Number(discount) || 0;
    const currentServiceCharge = Number(serviceCharge) || 0;
    const currentCommission = Number(commission) || 0;
    const currentWalletCredit = Number(walletCreditAmount) || 0;
    const hasAdjustments = currentDiscount > 0 || currentServiceCharge > 0 || currentWalletCredit > 0;
    // Total price = price − discount + service charge.
    const finalTotal = currentPrice - currentDiscount + currentServiceCharge;
    // The commission field already holds the total (operator % − discount + service charge);
    // recover the raw operator portion for the breakdown line.
    const operatorCommission = currentCommission + currentDiscount - currentServiceCharge;

    return (
      <>
        {currentPrice > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2">
            <span className="text-xs font-semibold text-black/65">Final Total</span>
            <span className="text-sm font-semibold text-black">£{finalTotal.toFixed(2)}</span>
          </div>
        )}
        {hasAdjustments && (
          <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3">
            <div className="text-xs font-medium text-blue-900">
              Total Commission: £{currentCommission.toFixed(2)}
            </div>
            <div className="mt-1 text-[10px] text-blue-700/70">
              Commission: £{operatorCommission.toFixed(2)}{" "}
              {currentDiscount > 0 && `Discount: -£${currentDiscount.toFixed(2)} `}
              {currentServiceCharge > 0 && `Service Charge: +£${currentServiceCharge.toFixed(2)} `}
              {currentWalletCredit > 0 && <span className="text-emerald-700">Wallet Credit: -£{currentWalletCredit.toFixed(2)}</span>}
            </div>
            {currentWalletCredit > 0 && (
              <div className="mt-1.5 text-[10px] text-blue-700/60">
                Net payable: £{(currentPrice - currentDiscount + currentServiceCharge - currentWalletCredit).toFixed(2)}
              </div>
            )}
          </div>
        )}
      </>
    );
  }, [price, discount, serviceCharge, commission, walletCreditAmount]);

  // ── Options ───────────────────────────────────────────────────────────────
  const airportOptions = useMemo(
    () =>
      (airportsData || []).map(
        (a: { id: string; airport_name: string; airport_code?: string | null }) => ({
          value: a.id,
          label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
        })
      ),
    [airportsData]
  );

  const tourOperatorOptions = useMemo(
    () =>
      (tourOperatorsData || []).map((op: { id: string; name: string | null }) => ({
        value: op.id,
        label: op.name || op.id,
      })),
    [tourOperatorsData]
  );

  const countryOptions = useMemo(
    () =>
      (countriesData || []).map((c: { id: string; country_name: string }) => ({
        value: c.id,
        label: c.country_name,
      })),
    [countriesData]
  );

  const destinationOptions = useMemo(
    () =>
      (destinationsData || []).map((d: { id: string; name: string }) => ({
        value: d.id,
        label: d.name,
      })),
    [destinationsData]
  );

  const resortOptions = useMemo(
    () =>
      (resortsData || []).map((r: { id: string; name: string }) => ({
        value: r.id,
        label: r.name,
      })),
    [resortsData]
  );

  const accommodationOptions = useMemo(
    () =>
      (accommodationsData || []).map((a: { id: string; name: string }) => ({
        value: a.id,
        label: a.name,
      })),
    [accommodationsData]
  );

  const boardBasisOptions = useMemo(
    () =>
      (boardBasisData || []).map((b: { id: string; type: string }) => ({
        value: b.id,
        label: b.type,
      })),
    [boardBasisData]
  );

  const roomTypeOptions = useMemo(
    () =>
      (roomTypeData || []).map((r: { id: string; name: string | null }) => ({
        value: r.id,
        label: r.name || r.id,
      })),
    [roomTypeData]
  );

  const parkOptions = useMemo(
    () =>
      (parksData ?? []).map((p: { id: string; name: string | null }) => ({
        value: p.id,
        label: p.name || p.id,
      })),
    [parksData]
  );

  const lodgeOptions = useMemo(
    () =>
      (lodgesData ?? []).map(
        (l: { id: string; lodge_name: string | null; lodge_code: string | null }) => ({
          value: l.id,
          label: l.lodge_name || l.lodge_code || l.id,
        })
      ),
    [lodgesData]
  );

  const cruiseLineOptions = useMemo(
    () => (cruiseLinesData || []).map((l) => ({ value: l.name ?? "", label: l.name ?? "" })),
    [cruiseLinesData]
  );

  const shipOptions = useMemo(
    () => (shipsData || []).map((s) => ({ value: s.name ?? "", label: s.name ?? "" })),
    [shipsData]
  );

  const cruiseDateOptions = useMemo(
    () =>
      (cruiseItineraries || []).map((it) => ({
        value: it.date,
        label: `${it.date}${it.departure_port ? ` — ${it.departure_port}` : ""}`,
      })),
    [cruiseItineraries]
  );

  const handleJsonUpload = (file: File) => {
    handleJsonUploadUtil(file, {
      form,
      airportsData,
      packageTypesData,
      queryClient,
      lookupKeys,
      toast,
      setImageUrls: setImageUrlsFromJson,
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

  const {
    fields: itineraryFields,
    append: appendItineraryDay,
    remove: removeItineraryDay,
  } = useFieldArray({ control, name: "cruiseItinerary" });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(
        (values) => onSubmit(values, {
          files: pendingFiles(imageItems),
          urls: resolvedUrls(imageItems),
          deletedImageIds,
          items: imageItems,
        }),
        // Without this, a failed validation makes the Save button appear to do
        // nothing — the inline message can be scrolled out of view in this
        // long dialog.
        (errors) => {
          toast({
            title: "Can't save yet",
            description: summarizeFormErrors(errors),
            variant: "destructive",
          });
          scrollToFirstFormError();
        },
      )} className="space-y-4">

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
                    onValueChange={field.onChange}
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
                      options={tourOperatorOptions}
                      value={field.value ?? ""}
                      onValueChange={(value) => {
                        field.onChange(value);
                        const op = tourOperatorsData?.find((o: { id: string }) => o.id === value);
                        const currentPrice = Number(form.getValues("price")) || 0;
                        if (op?.commission_percentage != null && currentPrice > 0) {
                          const currentDiscount = Number(form.getValues("discount")) || 0;
                          const currentServiceCharge = Number(form.getValues("serviceCharge")) || 0;
                          // Commission = price × operator % − discount + service charge.
                          const operatorCommission = (currentPrice * parseFloat(op.commission_percentage)) / 100;
                          setValue("commission", parseFloat((operatorCommission - currentDiscount + currentServiceCharge).toFixed(2)), { shouldValidate: true, shouldDirty: true });
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
        <QuoteImagesSection
          title="Booking Images"
          items={imageItems}
          setItems={setImageItems}
          setDeletedImageIds={setDeletedImageIds}
        />
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
                      {TRANSFER_TYPES.map((t) => (
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

            {isCruise && (
              <>
                <FormField
                  control={control}
                  name="preCruiseStay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-black/60">Pre-Cruise Stay (nights)</FormLabel>
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
                  name="postCruiseStay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-black/60">Post-Cruise Stay (nights)</FormLabel>
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
              </>
            )}
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
                        options={parkOptions}
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
                        options={lodgeOptions}
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
                        No. of Pets
                      </div>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                      />
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
                { name: "cabinNumber" as const, label: "Cabin Number" },
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
                        options={cruiseLineOptions}
                        value={field.value ?? ""}
                        selectedLabel={field.value || undefined}
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
                        options={shipOptions}
                        value={field.value ?? ""}
                        selectedLabel={field.value || undefined}
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
                        {cruiseItineraries?.length || isFetchingCruiseDates ? (
                          // Catalog has voyages for this ship → pick a real sailing.
                          <SearchableSelect
                            options={cruiseDateOptions}
                            value={field.value ?? ""}
                            selectedLabel={field.value || undefined}
                            onValueChange={field.onChange}
                            placeholder={cruiseDatePlaceholder}
                            searchPlaceholder="Search dates or port…"
                            emptyMessage="No matching voyages."
                            isLoading={isFetchingCruiseDates}
                          />
                        ) : (
                          // No catalog voyages for this ship → free date entry.
                          <DatePicker value={field.value ?? ""} onChange={field.onChange} disablePast />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
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

            {/* ── Itinerary (day-by-day) ──────────────────────────────────── */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeader icon={Ship} title="Itinerary" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-xl border-black/10 bg-white/70"
                  onClick={() => appendItineraryDay({ day: itineraryFields.length + 1, description: "", subDescription: "" })}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Day
                </Button>
              </div>

              <div className="grid gap-2">
                {itineraryFields.map((row, i) => (
                  <div key={row.id} className="flex items-start gap-2">
                    <Input
                      type="number"
                      min={1}
                      {...register(`cruiseItinerary.${i}.day` as const, { valueAsNumber: true })}
                      className="h-9 w-20 rounded-xl border-black/10 bg-white/70"
                      placeholder="Day"
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        {...register(`cruiseItinerary.${i}.description` as const)}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="Port / description"
                      />
                      <Input
                        {...register(`cruiseItinerary.${i}.subDescription` as const)}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="Sub-description (optional)"
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 rounded-xl text-black/50 hover:text-red-600"
                      onClick={() => removeItineraryDay(i)}
                      aria-label="Remove day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {itineraryFields.length === 0 && (
                  <p className="text-xs text-black/45">No itinerary days. Use "Add Day" to start.</p>
                )}
              </div>
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
                        options={countryOptions}
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

              <FormField
                control={control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Destination</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={destinationOptions}
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

              <FormField
                control={control}
                name="resort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Resort</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={resortOptions}
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

              <FormField
                control={control}
                name="accommodationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Accommodation</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={accommodationOptions}
                        value={field.value ?? ""}
                        selectedLabel={accomLabel}
                        onSearch={setAccomSearch}
                        isLoading={isAccomFetching}
                        emptyMessage={!accomSearch && !resort && !destination && !country ? "Type to search accommodations..." : "No accommodations found."}
                        onAddNew={
                          accomSearch && !isAccomFetching && (!accommodationsData || accommodationsData.length === 0)
                            ? () => setShowAddAccomModal(true)
                            : undefined
                        }
                        addNewLabel="Add Accommodation"
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

              <AddAccommodationModal
                open={showAddAccomModal}
                onOpenChange={setShowAddAccomModal}
                initialName={accomSearch}
                initialCountryId={country || ""}
                initialDestinationId={destination || ""}
                initialDestinationName={destLabel}
                initialResortId={resort || ""}
                initialResortName={resortLabel}
                onSuccess={(acc) => {
                  setValue("accommodationId", acc.id);
                  setAccomLabel(acc.name);
                  if (acc.resorts_id) {
                    setValue("resort", acc.resorts_id);
                    setResortLabel(acc.resort_name || "");
                  }
                  if (acc.destination_id) {
                    setValue("destination", acc.destination_id);
                    setDestLabel(acc.destination_name || "");
                  }
                  if (acc.country_id) {
                    setValue("country", acc.country_id);
                  }
                  setAccomSearch("");
                }}
              />

              <AddBoardBasisModal
                open={showAddBoardBasisModal}
                onOpenChange={setShowAddBoardBasisModal}
                initialName={boardBasisSearch}
                onSuccess={(bb) => { setValue("boardBasisId", bb.id); setBoardBasisSearch(""); }}
              />

              <AddRoomTypeModal
                open={showAddRoomTypeModal}
                onOpenChange={setShowAddRoomTypeModal}
                initialName={roomTypeSearch}
                onSuccess={(rt) => { setValue("roomType", rt.id); setRoomTypeSearch(""); }}
              />

              <FormField
                control={control}
                name="boardBasisId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium text-black/60">Board Basis</FormLabel>
                    <FormControl>
                      <SearchableSelect
                        options={boardBasisOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        onSearchCapture={setBoardBasisSearch}
                        onAddNew={() => setShowAddBoardBasisModal(true)}
                        addNewLabel="Add Board Basis"
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
                        options={roomTypeOptions}
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                        onSearchCapture={setRoomTypeSearch}
                        onAddNew={() => setShowAddRoomTypeModal(true)}
                        addNewLabel="Add Room Type"
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
        <BookingExtrasSection control={control as unknown as Control<ExtrasFormValues>} initialAccomLabels={initialExtraAccomLabels} mainTourOperatorId={tourOperatorId ?? ""} isCruise={isCruise} />

        {/* ── UPSELLS ───────────────────────────────────────────────────────── */}
        <BookingUpsellsSection
          control={control as unknown as Control<UpsellsFormValues>}
          setValue={setValue as unknown as UseFormSetValue<UpsellsFormValues>}
        />

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
                          // Capture the previous discount / service charge BEFORE RHF updates them,
                          // so we can adjust commission by the delta when there is no operator base.
                          const prevDiscount = Number(form.getValues("discount")) || 0;
                          const prevServiceCharge = Number(form.getValues("serviceCharge")) || 0;
                          field.onChange(e);
                          if (name === "price" || name === "discount" || name === "serviceCharge") {
                            const currentPrice = name === "price" ? parseFloat(e.target.value) || 0 : Number(form.getValues("price")) || 0;
                            const currentDiscount = name === "discount" ? parseFloat(e.target.value) || 0 : prevDiscount;
                            const currentServiceCharge = name === "serviceCharge" ? parseFloat(e.target.value) || 0 : prevServiceCharge;

                            const currentOperatorId = form.getValues("tourOperatorId");
                            const op = currentOperatorId ? tourOperatorsData?.find((o: { id: string }) => o.id === currentOperatorId) : undefined;

                            if (op?.commission_percentage != null && currentPrice > 0) {
                              // Commission = price × operator % − discount + service charge.
                              const operatorCommission = (currentPrice * parseFloat(op.commission_percentage)) / 100;
                              const adjustedCommission = operatorCommission - currentDiscount + currentServiceCharge;
                              setValue("commission", parseFloat(adjustedCommission.toFixed(2)), { shouldValidate: true, shouldDirty: true });
                            } else if (name === "discount" || name === "serviceCharge") {
                              // No operator base to recompute from — adjust the existing commission by
                              // the change: discount is deducted, service charge is added.
                              const currentCommission = Number(form.getValues("commission")) || 0;
                              const delta = name === "discount" ? prevDiscount - currentDiscount : currentServiceCharge - prevServiceCharge;
                              setValue("commission", parseFloat((currentCommission + delta).toFixed(2)), { shouldValidate: true, shouldDirty: true });
                            }

                            // Price per person = (salesPrice − discount + serviceCharge) / (adults + children)
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
          {pricingBreakdown}
        </div>

        {/* ── WALLET CREDIT ─────────────────────────────────────────────────── */}
        {clientId && <WalletCreditSection clientId={clientId} control={control} setValue={setValue} />}

        {/* ── TAGS ──────────────────────────────────────────────────────────── */}
        <TagSelectorSection control={control} />

        {/* ── TEST TRANSACTION ──────────────────────────────────────────────── */}
        <FormField
          control={control}
          name="is_test"
          render={({ field }) => (
            <FormItem className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <div>
                <FormLabel className="text-sm font-medium text-orange-700">Test Booking</FormLabel>
                <p className="text-xs text-orange-500">Will not appear in pipeline, stats, or generate social posts</p>
              </div>
            </FormItem>
          )}
        />

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
          name={`${prefix}.arriveDate` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
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
