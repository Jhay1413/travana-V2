import { useState, useEffect, useRef } from "react";
import { parseISO, isValid, addDays, format } from "date-fns";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { handleJsonUpload as handleJsonUploadUtil } from "@/lib/json-import-handler";
import { QuoteExtrasSection } from "@/features/quote/components/quote-extras-section";
import { QuoteTestToggleSection } from "@/features/quote/components/sections/QuoteTestToggleSection";
import { QuoteImportRow } from "@/features/quote/components/sections/QuoteImportRow";
import { QuoteOverviewSection } from "@/features/quote/components/sections/QuoteOverviewSection";
import { QuoteImagesSection } from "@/features/quote/components/sections/QuoteImagesSection";
import { QuoteTravelDetailsSection } from "@/features/quote/components/sections/QuoteTravelDetailsSection";
import { QuoteLodgeDetailsSection } from "@/features/quote/components/sections/QuoteLodgeDetailsSection";
import { QuoteCruiseDetailsSection } from "@/features/quote/components/sections/QuoteCruiseDetailsSection";
import { QuoteDestinationAccomSection } from "@/features/quote/components/sections/QuoteDestinationAccomSection";
import { QuoteFlightsSection } from "@/features/quote/components/sections/QuoteFlightsSection";
import { QuotePricingSection } from "@/features/quote/components/sections/QuotePricingSection";
import { QuoteFormActions } from "@/features/quote/components/sections/QuoteFormActions";
import { QuoteTagsSection } from "@/features/quote/components/sections/QuoteTagsSection";
import type { ExtrasFormValues } from "@/types/booking";
import { quoteFormSchema, defaultQuoteFormValues } from "@/types/quote";
import type { QuoteFormValues, QuoteRHFFormProps } from "@/types/quote";

export { quoteFormSchema, defaultQuoteFormValues } from "@/types/quote";
export type { QuoteFormValues, FlightLegValue, QuoteRHFFormProps } from "@/types/quote";
import { Form } from "@/components/ui/form";
import { useAirports, useTourOperators, usePackageTypes, lookupKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";


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
  const skipLodgeResetRef = useRef(false);

  const { setValue, control } = form;
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
  const checkInDate = useWatch({ control, name: "checkInDate" });
  const nights = useWatch({ control, name: "nights" });

  // ── Lookup data ──────────────────────────────────────────────────────────
  const { data: packageTypesData } = usePackageTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();

  // ── Package type name resolution ─────────────────────────────────────────
  const packageTypeName =
    packageTypesData?.find((p: { id: string; name: string }) => p.id === packageType)?.name ||
    packageType;

  const isHotTubBreak = packageTypeName === "Hot Tub Break";
  const isCruise = packageTypeName === "Cruise Package";
  const showFlights = !isHotTubBreak && !(isCruise && cruiseOnly);

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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((values) => onSubmit(values, { files: imageFiles, urls: imageUrls, deletedImageIds }))} className="space-y-4">

        {/* ── JSON IMPORT + NOT FOR SOCIAL ─────────────────────────────────── */}
        <QuoteImportRow onJsonUpload={handleJsonUpload} />

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <QuoteOverviewSection />

        {/* ── QUOTE IMAGES ─────────────────────────────────────────────────── */}
        <QuoteImagesSection
          imageFiles={imageFiles}
          setImageFiles={setImageFiles}
          imageUrls={imageUrls}
          setImageUrls={setImageUrls}
          existingImagesState={existingImagesState}
          setExistingImagesState={setExistingImagesState}
          setDeletedImageIds={setDeletedImageIds}
        />

        {/* ── TRAVEL DETAILS ────────────────────────────────────────────────── */}
        <QuoteTravelDetailsSection />

        {/* ── HOT TUB BREAK: LODGE DETAILS ─────────────────────────────────── */}
        {isHotTubBreak && <QuoteLodgeDetailsSection />}

        {/* ── CRUISE DETAILS ────────────────────────────────────────────────── */}
        {isCruise && <QuoteCruiseDetailsSection />}

        {/* ── DESTINATION & ACCOMMODATION (non-lodge, non-cruise) ────────────── */}
        {!isHotTubBreak && !isCruise && <QuoteDestinationAccomSection />}

        {/* ── FLIGHTS ───────────────────────────────────────────────────────── */}
        {showFlights && <QuoteFlightsSection />}

        {/* ── EXTRAS ────────────────────────────────────────────────────────── */}
        <QuoteExtrasSection control={control as unknown as Control<ExtrasFormValues>} initialAccomLabels={initialExtraAccomLabels} mainTourOperatorId={tourOperatorId ?? ""} />

        {/* ── PRICING ───────────────────────────────────────────────────────── */}
        <QuotePricingSection />

        {/* ── TAGS ──────────────────────────────────────────────────────────── */}
        <QuoteTagsSection />

        {/* ── TEST TRANSACTION ──────────────────────────────────────────────── */}
        <QuoteTestToggleSection />

        {/* ── ACTIONS ───────────────────────────────────────────────────────── */}
        <QuoteFormActions isLoading={isLoading} submitLabel={submitLabel} onCancel={onCancel} />
      </form>
    </Form>
  );
}

