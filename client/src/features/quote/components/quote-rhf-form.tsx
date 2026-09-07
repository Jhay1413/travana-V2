import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, X } from "lucide-react";
import { parseISO, isValid, addDays, format } from "date-fns";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { handleJsonUpload as handleJsonUploadUtil, handleJsonData, type JsonImportDeps } from "@/lib/json-import-handler";
import {
  usePageCaptureImport,
  type CapturedPage,
  type ImportValidation,
} from "@/features/quote/api/use-page-capture-import";
import { withMoneyFieldsQuarantined } from "@/features/quote/lib/import-validation";
import { ImportValidationPanel } from "@/features/quote/components/sections/ImportValidationPanel";
import { SupplierScraperPicksResultView, type SupplierScraperPicksResult } from "@/features/supplier-scraper";
import {
  existingImageItem,
  pendingFiles,
  resolvedUrls,
  urlImageItem,
  type FormImageItem,
} from "@/features/quote/lib/form-images";
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
import type { ExtrasFormValues } from "@/features/booking/types";
import { quoteFormSchema, defaultQuoteFormValues } from "@/features/quote/types";
import type { QuoteFormValues, QuoteRHFFormProps } from "@/features/quote/types";

export { quoteFormSchema, defaultQuoteFormValues } from "@/features/quote/types";
export type { QuoteFormValues, FlightLegValue, QuoteRHFFormProps } from "@/features/quote/types";
import { Form } from "@/components/ui/form";
import { useAirports, useTourOperators, usePackageTypes, lookupKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { summarizeFormErrors, scrollToFirstFormError } from "@/lib/form-errors";


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

  // Saved images first, then anything pre-seeded from a JSON import. One
  // ordered list — see features/quote/lib/form-images.
  const [imageItems, setImageItems] = useState<FormImageItem[]>(() => [
    ...existingImages.map((i) => existingImageItem(i.id, i.url)),
    ...initialImageUrls.map(urlImageItem),
  ]);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);

  // The JSON importer replaces the imported-URL images wholesale; saved and
  // picked-file entries keep their place in the order.
  const setImageUrlsFromJson = useCallback((updater: (prev: string[]) => string[]) => {
    setImageItems((prev) => {
      const kept = prev.filter((i) => i.kind !== "url");
      const nextUrls = updater(prev.flatMap((i) => (i.kind === "url" ? [i.url] : [])));
      return [...kept, ...nextUrls.map(urlImageItem)];
    });
  }, []);
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
  // Shared by the file-based JSON import and the easyJet URL import: stage the
  // current images for deletion and build the deps object the importer needs.
  const prepareJsonImport = (): JsonImportDeps => {
    // Clear all existing images and stage them for deletion before importing new ones
    setDeletedImageIds((prev) => [
      ...prev,
      ...imageItems.flatMap((i) => (i.kind === "existing" ? [i.id] : [])),
    ]);
    // Drop saved + picked-file entries; the importer repopulates the URL ones.
    setImageItems((prev) => prev.filter((i) => i.kind === "url"));

    return {
      form,
      airportsData,
      packageTypesData,
      queryClient,
      lookupKeys,
      toast,
      setImageUrls: setImageUrlsFromJson,
      skipLodgeResetRef,
      fallbackFieldMapper: (data, setIfPresent) => {
        setIfPresent("quoteLink", data.quoteLink || data.quote_link || data.link || data.source_url);
      },
    };
  };

  // True while a JSON file or supplier-URL import is running — drives the
  // blurred loading overlay over the whole form.
  const [isImporting, setIsImporting] = useState(false);

  const handleJsonUpload = async (file: File) => {
    setIsImporting(true);
    try {
      await handleJsonUploadUtil(file, prepareJsonImport());
    } finally {
      setIsImporting(false);
    }
  };

  // ── Captured-page import ──────────────────────────────────────────────────
  // For credentialed suppliers the agent captures the deal page in their own
  // (already logged-in) browser via the bookmarklet; the server only interprets
  // it. No stored credentials, no headless browser, no bot protection to clear.
  const pageCaptureImport = usePageCaptureImport();
  // The API validates the extracted quote (EXTRACTION_AUDIT.md §4 Phase 1) but
  // never blocks on it — the deal always lands in the form. What's shown here
  // is purely "double-check these before saving".
  const [importValidation, setImportValidation] = useState<ImportValidation | null>(null);
  // Present only when the pasted/clipboard capture carried field-picker picks
  // (see use-page-capture-import.ts's PickedField/picks) — i.e. an agent had
  // already told the picker where a field lived on THIS supplier's page.
  // Rendered below via the same SupplierScraperPicksResultView the standalone
  // "Apply field picks" screen uses, so an agent gets the same
  // applied/couldn't-map/preserved breakdown right here instead of having to
  // know that other screen exists.
  const [importPicks, setImportPicks] = useState<SupplierScraperPicksResult | null>(null);
  const handlePageCaptureImport = (capture: CapturedPage, supplierKey: string) => {
    setIsImporting(true);
    setImportValidation(null);
    setImportPicks(null);
    pageCaptureImport.mutate(
      // Omit the key entirely when auto-detecting, rather than sending "".
      supplierKey ? { ...capture, supplierKey } : capture,
      {
        onSuccess: async (result) => {
          try {
            // Money fields (sales_price, price_per_person) that failed
            // validation are dropped here rather than auto-filled — the
            // agent types the number instead of trusting one that may be
            // wrong. Fields with only a warning still populate.
            const quoteForImport = withMoneyFieldsQuarantined(result.quote, result.validation);
            await handleJsonData(quoteForImport as Record<string, any>, prepareJsonImport());
            setImportValidation(result.validation ?? null);
            setImportPicks(result.picks ?? null);
            // Surfaces "created supplier X / learned its spec — review it", so a
            // newly auto-configured supplier doesn't go unnoticed.
            if (result.message) toast({ title: "Imported", description: result.message });
          } finally {
            setIsImporting(false);
          }
        },
        onError: (error) => {
          setIsImporting(false);
          toast({
            title: "Import failed",
            description:
              error instanceof Error ? error.message : "Could not read the captured page.",
            variant: "destructive",
          });
        },
      },
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
      )} className="relative space-y-4">

        {/* ── IMPORT LOADER (blurs the form while a JSON/URL import runs) ───── */}
        {isImporting && (
          <div
            className="absolute inset-0 z-50 rounded-xl bg-background/60 backdrop-blur-sm"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="sticky top-[40vh] mx-auto flex w-fit flex-col items-center gap-3">
              <Loader2 className="h-9 w-9 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Importing your deal…</p>
            </div>
          </div>
        )}

        {/* ── JSON IMPORT + NOT FOR SOCIAL ─────────────────────────────────── */}
        <QuoteImportRow
          onJsonUpload={handleJsonUpload}
          onPageCaptureImport={handlePageCaptureImport}
          pageCapturePending={pageCaptureImport.isPending}
        />

        {/* ── IMPORT VALIDATION (errors/warnings from the last capture import) */}
        {importValidation && (
          <ImportValidationPanel validation={importValidation} onDismiss={() => setImportValidation(null)} />
        )}

        {/* ── FIELD PICKS APPLIED (only present when this capture carried
             field-picker picks — see use-page-capture-import.ts) — tells the
             agent what got mapped into the supplier's spec and what couldn't
             be, right where the import happened, instead of only being
             visible on the separate supplier-scrapers "Apply field picks"
             screen an agent has no reason to know about. */}
        {importPicks && (
          <div className="space-y-2 rounded-xl border border-black/10 bg-white/70 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-xs font-semibold text-black/70">Field picks applied to this supplier's spec</p>
              <button
                type="button"
                onClick={() => setImportPicks(null)}
                aria-label="Dismiss field-pick results"
                className="text-black/40 transition hover:text-black/70"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <SupplierScraperPicksResultView result={importPicks} />
          </div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <QuoteOverviewSection />

        {/* ── QUOTE IMAGES ─────────────────────────────────────────────────── */}
        <QuoteImagesSection
          items={imageItems}
          setItems={setImageItems}
          setDeletedImageIds={setDeletedImageIds}
        />

        {/* ── TRAVEL DETAILS ────────────────────────────────────────────────── */}
        <QuoteTravelDetailsSection showCruiseStay={isCruise} />

        {/* ── HOT TUB BREAK: LODGE DETAILS ─────────────────────────────────── */}
        {isHotTubBreak && <QuoteLodgeDetailsSection />}

        {/* ── CRUISE DETAILS ────────────────────────────────────────────────── */}
        {isCruise && <QuoteCruiseDetailsSection />}

        {/* ── DESTINATION & ACCOMMODATION (non-lodge, non-cruise) ────────────── */}
        {!isHotTubBreak && !isCruise && <QuoteDestinationAccomSection />}

        {/* ── FLIGHTS ───────────────────────────────────────────────────────── */}
        {showFlights && <QuoteFlightsSection />}

        {/* ── EXTRAS ────────────────────────────────────────────────────────── */}
        <QuoteExtrasSection control={control as unknown as Control<ExtrasFormValues>} initialAccomLabels={initialExtraAccomLabels} mainTourOperatorId={tourOperatorId ?? ""} isCruise={isCruise} />

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

