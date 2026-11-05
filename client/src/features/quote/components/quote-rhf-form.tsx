import { useState, useEffect, useRef, useCallback } from "react";
import { departureDatesForCheckIn } from "@/features/quote/lib/departure-dates";
import { Loader2 } from "lucide-react";
import { parseISO, isValid, addDays, format } from "date-fns";
import { useForm, useWatch, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import type { JsonImportDeps } from "@/lib/json-import-handler";
import { useDealCaptureImport } from "@/features/quote/api/use-deal-capture-import";
import { pricePerPersonFor } from "@/features/quote/lib/pricing";
import { deriveCheckIn, outboundArrivalOf } from "@/lib/check-in-time";
import { DealImportFeedback } from "@/features/quote/components/sections/DealImportFeedback";
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
import { Form, FormField } from "@/components/ui/form";
import { FormDrawerSection, FormDrawerFooter, FormDrawerCheckbox } from "@/components/shared/form-drawer";
import {
  QuoteDrawerOverview,
  QuoteDrawerTravelSection,
  QuoteDrawerFlightsSection,
  QuoteDrawerCostingsSection,
} from "@/features/quote/components/drawer-sections";
import { countExtras } from "@/features/quote/lib/form-extras";
import { useAirports, useTourOperators, usePackageTypes, lookupKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { summarizeFormErrors, scrollToFirstFormError } from "@/lib/form-errors";

// ─── Main Component ──────────────────────────────────────────────────────────

export function QuoteRHFForm({
  quoteId,
  defaultValues,
  onSubmit,
  isLoading,
  submitLabel = "Save",
  onCancel,
  existingImages = [],
  initialImageUrls = [],
  initialExtraAccomLabels = [],
  layout = "card",
  socialPost = false,
}: QuoteRHFFormProps) {
  const isDrawer = layout === "drawer";
  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteFormSchema),
    defaultValues: { ...defaultQuoteFormValues, ...defaultValues },
  });

  // Optional drawer sections start collapsed when the record has nothing in
  // them. Read once at mount — it only seeds the initial open state.
  const [initialExtrasCount] = useState(() => countExtras(form.getValues()));
  const [initialTagsCount] = useState(() => (form.getValues("tags") ?? []).length);

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
  // Only reconciles childAges with the children count on a genuine change to
  // that count during this session — never on mount. A loaded quote/booking
  // can legitimately have a childAges array whose length doesn't match its
  // stored child count (e.g. AI-extracted enquiries, legacy data); running
  // this on the initial render would "helpfully" pad/truncate that array
  // and silently wipe out real ages the moment an edit form opens.
  const isChildAgesFirstRender = useRef(true);
  useEffect(() => {
    if (isChildAgesFirstRender.current) {
      isChildAgesFirstRender.current = false;
      return;
    }
    const currentAges = form.getValues("childAges");
    const count = Number(passengersChildren) || 0;
    if (currentAges.length !== count) {
      const newAges = Array.from({ length: count }, (_, i) => currentAges[i] ?? 0);
      setValue("childAges", newAges);
    }
  }, [passengersChildren, setValue, form]);

  // ── Price per person calculation ──────────────────────────────────────────
  // Derived from price/discount/serviceCharge/traveller counts via the shared
  // helper (features/quote/lib/pricing) so this recomputes the same way whether
  // those fields changed from typing OR from a deal import's setValue calls.
  // `price` must be a dependency, not just read off getValues — otherwise an
  // import that sets price without changing the traveller counts (which start
  // at the same default) never re-fires this effect and price-per-person is
  // left stale until the agent edits price/discount/service charge by hand.
  useEffect(() => {
    setValue(
      "pricePerPerson",
      pricePerPersonFor(price, discount, serviceCharge, passengersAdults, passengersChildren),
    );
  }, [price, passengersAdults, passengersChildren, discount, serviceCharge, setValue]);

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
  const outboundArriveDate = useWatch({ control, name: "outboundArriveDate" });
  const outboundArriveTime = useWatch({ control, name: "outboundArriveTime" });
  const outboundConnectingLegs = useWatch({ control, name: "outboundConnectingLegs" });
  const travelDate = useWatch({ control, name: "travelDate" });
  // The first run is skipped so merely opening a saved quote (non-social) never rewrites its stored flight dates.
  const isDepartureFirstRun = useRef(true);
  useEffect(() => {
    if (isDepartureFirstRun.current) {
      isDepartureFirstRun.current = false;
      if (!socialPost) return;
    }
    const arrival = outboundArrivalOf(form.getValues());
    const update = departureDatesForCheckIn({
      checkInDate,
      nights,
      currentOutboundDepart: form.getValues("outboundDepartDate"),
      checkInIsDerived: !!arrival && deriveCheckIn(arrival, form.getValues("travelDate")).date === checkInDate,
      socialPost,
    });
    if (update.outboundDepartDate) setValue("outboundDepartDate", update.outboundDepartDate, { shouldDirty: true });
    if (update.inboundDepartDate) setValue("inboundDepartDate", update.inboundDepartDate, { shouldDirty: true });
  }, [checkInDate, nights, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-fill check-in from the outbound arrival (every quote) ────────────
  // House rule (see deriveCheckIn): 15:00, or an hour after landing when later.
  // Applies only while the user hasn't hand-edited the value (it is empty, the
  // 15:00 default, or still what we last filled in). The first run is skipped
  // so merely opening a saved (non-social) quote never rewrites its stored check-in.
  const lastAutoCheckIn = useRef<{ date: string; time: string } | null>(null);
  const isCheckInFirstRun = useRef(true);
  useEffect(() => {
    if (isCheckInFirstRun.current) {
      isCheckInFirstRun.current = false;
      // Social posts have always derived on mount (their defaults carry the
      // flights but not the check-in); saved normal quotes must be left alone.
      if (!socialPost) return;
    }
    const arrival = outboundArrivalOf({ outboundArriveDate, outboundArriveTime, outboundConnectingLegs });
    if (!arrival) return;
    const derived = deriveCheckIn(arrival, travelDate);
    const last = lastAutoCheckIn.current;
    const currentDate = form.getValues("checkInDate") ?? "";
    const currentTime = form.getValues("checkInTime") ?? "";
    if (derived.date && (!currentDate || currentDate === last?.date || currentDate === derived.date)) {
      if (currentDate !== derived.date) setValue("checkInDate", derived.date, { shouldDirty: true });
    }
    if (!currentTime || currentTime === "15:00" || currentTime === last?.time || currentTime === derived.time) {
      if (currentTime !== derived.time) setValue("checkInTime", derived.time, { shouldDirty: true });
    }
    lastAutoCheckIn.current = derived;
  }, [socialPost, outboundArriveDate, outboundArriveTime, outboundConnectingLegs, travelDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── JSON upload ───────────────────────────────────────────────────────────
  // Used by the Import Deal flow: stage the current images for deletion and
  // build the deps object the importer needs.
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

  // ── Captured-page import ──────────────────────────────────────────────────
  // Shared with the booking form — see useDealCaptureImport.
  const dealImport = useDealCaptureImport(prepareJsonImport);

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
      )} className={isDrawer ? "relative" : "relative space-y-4"} data-form-layout={layout}>

        {/* ── IMPORT LOADER (blurs the form while a JSON/URL import runs) ───── */}
        {dealImport.isImporting && (
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

        {isDrawer ? (
          <>
            {/* ── DRAWER LAYOUT: teal section bars, full-bleed ─────────────── */}
            <div className="px-7 pt-5">
              <QuoteImportRow
                hideNotForSocial
                onPageCaptureImport={dealImport.importCapture}
                pageCapturePending={dealImport.isPending}
              />
              <DealImportFeedback
                spaced
                validation={dealImport.validation}
                picks={dealImport.picks}
                onDismissValidation={dealImport.dismissValidation}
                onDismissPicks={dealImport.dismissPicks}
              />
            </div>
            <QuoteDrawerOverview />
            <QuoteDrawerTravelSection showCruiseStay={isCruise} showFlightExtras={!isHotTubBreak} />
            {isHotTubBreak && (
              <FormDrawerSection title="Lodge Details" data-testid="drawer-section-lodge">
                <QuoteLodgeDetailsSection bare />
              </FormDrawerSection>
            )}
            {isCruise && (
              <FormDrawerSection title="Cruise Details" data-testid="drawer-section-cruise">
                <QuoteCruiseDetailsSection bare />
              </FormDrawerSection>
            )}
            {!isHotTubBreak && !isCruise && <QuoteDestinationAccomSection layout="drawer" />}
            {showFlights && <QuoteDrawerFlightsSection />}
            {/* Cruise pre/post-stay rows are managed by an effect inside the
                extras section, so it must stay mounted for cruises. */}
            <FormDrawerSection
              title="Extras"
              defaultOpen={initialExtrasCount > 0 || isCruise}
              collapsible={!isCruise}
              data-testid="drawer-section-extras"
            >
              <QuoteExtrasSection
                bare
                control={control as unknown as Control<ExtrasFormValues>}
                initialAccomLabels={initialExtraAccomLabels}
                mainTourOperatorId={tourOperatorId ?? ""}
                isCruise={isCruise}
              />
            </FormDrawerSection>
            <QuoteImagesSection
              layout="drawer"
              items={imageItems}
              setItems={setImageItems}
              setDeletedImageIds={setDeletedImageIds}
            />
            <QuoteDrawerCostingsSection />
            <FormDrawerSection title="Tags" defaultOpen={initialTagsCount > 0} data-testid="drawer-section-tags">
              <QuoteTagsSection bare quoteId={quoteId} />
            </FormDrawerSection>
            <FormField
              control={control}
              name="is_test"
              render={({ field }) => (
                <FormDrawerFooter
                  isTest={field.value}
                  onTestChange={field.onChange}
                  isLoading={isLoading}
                  submitLabel={submitLabel}
                  data-testid="drawer-footer"
                >
                  {!socialPost && (
                    <FormField
                      control={control}
                      name="not_for_social"
                      render={({ field: social }) => (
                        <FormDrawerCheckbox
                          label="Not for social"
                          checked={!!social.value}
                          onCheckedChange={social.onChange}
                          data-testid="form-drawer-not-for-social"
                        />
                      )}
                    />
                  )}
                </FormDrawerFooter>
              )}
            />
          </>
        ) : (
          <>
        {/* ── JSON IMPORT + NOT FOR SOCIAL ─────────────────────────────────── */}
        <QuoteImportRow
          hideNotForSocial={socialPost}
          onPageCaptureImport={dealImport.importCapture}
          pageCapturePending={dealImport.isPending}
        />

        {/* ── IMPORT FEEDBACK (validation warnings + field picks applied) ───── */}
        <DealImportFeedback
          validation={dealImport.validation}
          picks={dealImport.picks}
          onDismissValidation={dealImport.dismissValidation}
          onDismissPicks={dealImport.dismissPicks}
        />

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        <QuoteOverviewSection />

        {/* ── QUOTE IMAGES ─────────────────────────────────────────────────── */}
        <QuoteImagesSection
          items={imageItems}
          setItems={setImageItems}
          setDeletedImageIds={setDeletedImageIds}
        />

        {/* ── TRAVEL DETAILS ────────────────────────────────────────────────── */}
        <QuoteTravelDetailsSection showCruiseStay={isCruise} showFlightExtras={!isHotTubBreak} />

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
        <QuoteTagsSection quoteId={quoteId} />

        {/* ── TEST TRANSACTION ──────────────────────────────────────────────── */}
        <QuoteTestToggleSection />

        {/* ── ACTIONS ───────────────────────────────────────────────────────── */}
        <QuoteFormActions isLoading={isLoading} submitLabel={submitLabel} onCancel={onCancel} />
          </>
        )}
      </form>
    </Form>
  );
}

