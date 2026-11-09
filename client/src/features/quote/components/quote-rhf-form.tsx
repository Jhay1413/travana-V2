import { useState, useEffect, useRef, useCallback } from "react";
import { departureDatesForCheckIn } from "@/features/quote/lib/departure-dates";
import { Anchor, Check, FileText, Hotel, Loader2, PackagePlus, Tag } from "lucide-react";
import { extrasCustomerTotal, formFinalTotal, formTotalProfit, quoteMarginPercent } from "@/features/quote/lib/quote-money";
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
import { useQuoteImportBar } from "@/features/quote/components/sections/quote-import-bar";
import { hasImportErrors } from "@/features/quote/lib/import-validation";
import {
  holidayKindFromName,
  quoteSectionState,
  type QuoteSectionInputs,
  type QuoteSectionKey,
} from "@/features/quote/lib/quote-form-sections";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { QuoteImagesSection } from "@/features/quote/components/sections/QuoteImagesSection";
import { QuoteLodgeDetailsSection } from "@/features/quote/components/sections/QuoteLodgeDetailsSection";
import { QuoteCruiseDetailsSection } from "@/features/quote/components/sections/QuoteCruiseDetailsSection";
import { QuoteDestinationAccomSection } from "@/features/quote/components/sections/QuoteDestinationAccomSection";
import { QuoteTagsSection } from "@/features/quote/components/sections/QuoteTagsSection";
import type { ExtrasFormValues } from "@/features/booking/types";
import { quoteFormSchema, defaultQuoteFormValues } from "@/features/quote/types";
import type { QuoteFormValues, QuoteRHFFormProps } from "@/features/quote/types";

export { quoteFormSchema, defaultQuoteFormValues } from "@/features/quote/types";
export type { QuoteFormValues, FlightLegValue, QuoteRHFFormProps } from "@/features/quote/types";
import { Form, FormField } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FormButton,
  FormCloseButton,
  FormFooter,
  FormHead,
  FormSection,
  FormSideNav,
  countDone,
  footerStatus,
  useScrollSpy,
} from "@/components/shared/form-shell";
import {
  QuoteDrawerOverview,
  QuoteDrawerTravelSection,
  QuoteDrawerFlightsSection,
  QuoteDrawerCostingsSection,
} from "@/features/quote/components/drawer-sections";
import { countExtras } from "@/features/quote/lib/form-extras";
import { useAirports, useTourOperators, usePackageTypes, lookupKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { collectFormErrorFields, summarizeFormErrors, scrollToFirstFormError } from "@/lib/form-errors";

const formatGbp = (n: number): string =>
  `${n < 0 ? "−" : ""}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  title = "Add quote",
  subtitle,
  note,
  socialPost = false,
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
  const parkId = useWatch({ control, name: "parkId" });
  const passengersAdults = useWatch({ control, name: "passengersAdults" });
  const passengersChildren = useWatch({ control, name: "passengersChildren" });
  const cruiseOnly = useWatch({ control, name: "cruiseOnly" });
  const tourOperatorId = useWatch({ control, name: "tourOperatorId" });
  const price = useWatch({ control, name: "price" });
  const discount = useWatch({ control, name: "discount" });
  const serviceCharge = useWatch({ control, name: "serviceCharge" });
  const commission = useWatch({ control, name: "commission" });
  // Extras not marked "Included in package" are part of what each traveller pays.
  const [transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations] = useWatch({
    control,
    name: ["transfers", "carHires", "attractionTickets", "loungePasses", "airportParkings", "extraAccommodations"],
  });
  const extrasTotal = extrasCustomerTotal({ transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations });
  const checkInDate = useWatch({ control, name: "checkInDate" });
  const nights = useWatch({ control, name: "nights" });
  // Watched for the side-menu ticks.
  const quoteTitle = useWatch({ control, name: "quoteTitle" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const accommodationId = useWatch({ control, name: "accommodationId" });
  const lodgeId = useWatch({ control, name: "lodgeId" });
  const cruiseLine = useWatch({ control, name: "cruiseLine" });
  const shipName = useWatch({ control, name: "shipName" });
  const [outboundDepartAirportId, outboundArriveAirportId, outboundDepartDate, inboundDepartAirportId, inboundDepartDate] = useWatch({
    control,
    name: ["outboundDepartAirportId", "outboundArriveAirportId", "outboundDepartDate", "inboundDepartAirportId", "inboundDepartDate"],
  });

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
      pricePerPersonFor(price, discount, serviceCharge, passengersAdults, passengersChildren, extrasTotal),
    );
  }, [price, passengersAdults, passengersChildren, discount, serviceCharge, extrasTotal, setValue]);

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

  // ── Side menu + footer state ──────────────────────────────────────────────
  const tags = useWatch({ control, name: "tags" });
  const holidayKind = holidayKindFromName(packageTypeName);
  const sectionInputs: QuoteSectionInputs = {
    packageType,
    quoteTitle,
    tourOperatorId,
    travelDate,
    nights,
    passengersAdults,
    accommodationId,
    parkId,
    lodgeId,
    cruiseLine,
    shipName,
    outboundDepartAirportId,
    outboundArriveAirportId,
    outboundDepartDate,
    inboundDepartAirportId,
    inboundDepartDate,
    price,
    imageCount: imageItems.length,
    extrasCount: countExtras({ transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations }),
    tagCount: (tags ?? []).length,
  };
  const sectionState = quoteSectionState(holidayKind, { cruiseOnly }, sectionInputs);
  const navItems = sectionState.map((s) => ({ key: formSectionDomId(s.key), label: s.label, done: s.done, optional: s.optional }));
  const bodyRef = useRef<HTMLDivElement>(null);
  const { current, jump } = useScrollSpy(bodyRef, navItems.map((n) => n.key));

  const extrasForMoney = { transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations };
  const profit = formTotalProfit(commission, extrasForMoney);
  const margin = quoteMarginPercent(profit, formFinalTotal(price, discount, serviceCharge, extrasForMoney));

  const { done: doneCount, total: totalCount } = countDone(sectionState);
  const errorCount = collectFormErrorFields(form.formState.errors).length;

  const importBar = useQuoteImportBar({ onPageCaptureImport: dealImport.importCapture, pending: dealImport.isPending });
  const hasImportFeedback = (dealImport.validation && hasImportErrors(dealImport.validation)) || !!dealImport.picks;
  const has = (key: QuoteSectionKey) => sectionState.some((s) => s.key === key);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form
        // The head, side menu, body and footer are direct flex children of the pop-up.
        style={{ display: "contents" }}
        onSubmit={form.handleSubmit(
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
        )}
      >
        <FormHead
          icon={<FileText size={22} color="#D97706" strokeWidth={1.8} aria-hidden="true" />}
          title={title}
          subtitle={subtitle}
          right={
            <>
              {importBar.button}
              {onCancel ? <FormCloseButton onClick={onCancel} disabled={isLoading} /> : null}
            </>
          }
        />

        {importBar.bar}
        {note ? (
          <div className="fm-q__imported" role="status" data-testid="quote-form-note">
            <Check size={16} color="#047857" strokeWidth={2.2} aria-hidden="true" /> {note}
          </div>
        ) : null}
        {hasImportFeedback ? (
          <div style={{ padding: "12px 28px", borderBottom: "1px solid #E3E8EF", background: "#fff", flex: "none" }}>
            <DealImportFeedback
              validation={dealImport.validation}
              picks={dealImport.picks}
              onDismissValidation={dealImport.dismissValidation}
              onDismissPicks={dealImport.dismissPicks}
            />
          </div>
        ) : null}

        <div className="fm-q__main">
          <FormSideNav
            items={navItems}
            current={current}
            onJump={jump}
            footer={
              <>
                <div style={{ fontSize: 12, color: "#6B7686" }}>Your profit</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: profit < 0 ? "#B91C1C" : "#047857" }} data-testid="form-profit">
                  {formatGbp(profit)}
                </div>
                <div style={{ fontSize: 12, color: "#6B7686" }} data-testid="form-margin">
                  {margin === null ? "Add the total price" : `${margin.toFixed(1)}% margin`}
                </div>
              </>
            }
          />

          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
            <div className="fm-q__body" ref={bodyRef}>
              <QuoteDrawerOverview />
              <QuoteDrawerTravelSection showCruiseStay={isCruise} showFlightExtras={!isHotTubBreak} />
              {has("lodge") && (
                <FormSection id={formSectionDomId("lodge")} title="Lodge details" icon={<Hotel size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-lodge">
                  <QuoteLodgeDetailsSection />
                </FormSection>
              )}
              {has("cruise") && (
                <FormSection id={formSectionDomId("cruise")} title="Cruise details" icon={<Anchor size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-cruise">
                  <QuoteCruiseDetailsSection />
                </FormSection>
              )}
              {has("hotel") && <QuoteDestinationAccomSection />}
              {showFlights && <QuoteDrawerFlightsSection />}
              {/* Cruise pre/post-stay rows are managed by an effect inside the
                  extras section, so it must stay mounted for cruises. */}
              <FormSection id={formSectionDomId("extras")} title="Extras" icon={<PackagePlus size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-extras">
                <QuoteExtrasSection
                  control={control as unknown as Control<ExtrasFormValues>}
                  initialAccomLabels={initialExtraAccomLabels}
                  mainTourOperatorId={tourOperatorId ?? ""}
                  isCruise={isCruise}
                />
              </FormSection>
              <QuoteImagesSection
                items={imageItems}
                setItems={setImageItems}
                setDeletedImageIds={setDeletedImageIds}
              />
              <QuoteDrawerCostingsSection />
              <FormSection id={formSectionDomId("tags")} title="Tags" icon={<Tag size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-tags">
                <QuoteTagsSection quoteId={quoteId} />
              </FormSection>
            </div>

            {/* ── IMPORT LOADER (covers the body while a JSON/URL import runs) ─ */}
            {dealImport.isImporting && (
              <div
                className="absolute inset-0 z-50 bg-white/60 backdrop-blur-sm"
                aria-busy="true"
                aria-live="polite"
              >
                <div className="mx-auto flex w-fit flex-col items-center gap-3 pt-[20vh]">
                  <Loader2 className="h-9 w-9 animate-spin text-primary" />
                  <p className="text-sm font-medium text-foreground">Importing your deal…</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <FormFooter
          status={
            <>
              <span data-testid="form-footer-status" style={{ color: errorCount > 0 ? "#B91C1C" : "#6B7686", fontWeight: 500 }}>
                {footerStatus(doneCount, totalCount, errorCount)}
              </span>
              <FormField
                control={control}
                name="is_test"
                render={({ field }) => (
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#6B7686]">
                    <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} data-testid="form-drawer-test-checkbox" />
                    Test
                  </label>
                )}
              />
              {!socialPost && (
                <FormField
                  control={control}
                  name="not_for_social"
                  render={({ field }) => (
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#6B7686]">
                      <Checkbox checked={!!field.value} onCheckedChange={(v) => field.onChange(v === true)} data-testid="form-drawer-not-for-social" />
                      Not for social
                    </label>
                  )}
                />
              )}
            </>
          }
        >
          {onCancel ? <FormButton onClick={onCancel} disabled={isLoading}>Cancel</FormButton> : null}
          <FormButton type="submit" tone="primary" disabled={isLoading} data-testid="form-drawer-submit">
            {isLoading ? "Saving..." : submitLabel}
          </FormButton>
        </FormFooter>
      </form>
    </Form>
  );
}
