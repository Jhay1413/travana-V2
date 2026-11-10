import { useCallback, useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Hotel, Anchor, Loader2, PackagePlus, ShoppingBag, Tag, Wallet } from "lucide-react";
import type { JsonImportDeps } from "@/lib/json-import-handler";
import { useDealCaptureImport } from "@/features/quote/api/use-deal-capture-import";
import { DealImportFeedback } from "@/features/quote/components/sections/DealImportFeedback";
import { useQuoteImportBar } from "@/features/quote/components/sections/quote-import-bar";
import { hasImportErrors } from "@/features/quote/lib/import-validation";
import { deriveCheckIn, outboundArrivalOf } from "@/lib/check-in-time";
import { QuoteImagesSection } from "@/features/quote/components/sections/QuoteImagesSection";
import {
  existingImageItem,
  pendingFiles,
  resolvedUrls,
  urlImageItem,
  type FormImageItem,
} from "@/features/quote/lib/form-images";
import { bookingFormSchema, defaultBookingFormValues } from "@/features/booking/types";
import type { BookingFormValues, BookingRHFFormProps, ExtrasFormValues, UpsellsFormValues } from "@/features/booking/types";
import { QuoteExtrasSection as BookingExtrasSection } from "@/features/quote/components/quote-extras-section";
import { pricePerPersonFor } from "@/features/quote/lib/pricing";
import { BookingUpsellsSection } from "@/features/booking/components/BookingUpsellsSection";
import { BookingTagsSection } from "@/features/booking/components/booking-tags-section";
import { BookingWalletCreditSection } from "@/features/booking/components/booking-wallet-credit-section";
import { QuoteLodgeDetailsSection } from "@/features/quote/components/sections/QuoteLodgeDetailsSection";
import { QuoteCruiseDetailsSection } from "@/features/quote/components/sections/QuoteCruiseDetailsSection";
import { QuoteDestinationAccomSection } from "@/features/quote/components/sections/QuoteDestinationAccomSection";
import {
  QuoteDrawerOverview,
  QuoteDrawerTravelSection,
  QuoteDrawerFlightsSection,
  QuoteDrawerCostingsSection,
} from "@/features/quote/components/drawer-sections";
import { countExtras } from "@/features/quote/lib/form-extras";
import { extrasCustomerTotal, formFinalTotal, formTotalProfit, quoteMarginPercent } from "@/features/quote/lib/quote-money";
import { departureDatesForCheckIn } from "@/features/quote/lib/departure-dates";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import {
  bookingSectionState,
  holidayKindFromName,
  type BookingSectionInputs,
  type BookingSectionKey,
} from "@/features/booking/lib/booking-form-sections";
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

export { bookingFormSchema, defaultBookingFormValues } from "@/features/booking/types";
export type { BookingFormValues, FlightLegValue, BookingRHFFormProps } from "@/features/booking/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useAirports, useTourOperators, usePackageTypes, lookupKeys } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { collectFormErrorFields, summarizeFormErrors, scrollToFirstFormError } from "@/lib/form-errors";
import { HAYS_REF_MESSAGE, normaliseHaysRef } from "@shared/booking-refs";

const formatGbp = (n: number): string =>
  `${n < 0 ? "−" : ""}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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
  title = "Add booking",
  subtitle,
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
  const walletCreditAmount = useWatch({ control, name: "walletCreditAmount" });
  // Extras not marked "Included in package" add their cost to the Final Total.
  const [transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations] = useWatch({
    control,
    name: ["transfers", "carHires", "attractionTickets", "loungePasses", "airportParkings", "extraAccommodations"],
  });
  const extrasTotal = extrasCustomerTotal({ transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations });
  const checkInDate = useWatch({ control, name: "checkInDate" });
  const nights = useWatch({ control, name: "nights" });
  // Watched for the side-menu ticks.
  const haysRef = useWatch({ control, name: "haysRef" });
  const supplierRef = useWatch({ control, name: "supplierRef" });
  const quoteTitle = useWatch({ control, name: "quoteTitle" });
  const travelDate = useWatch({ control, name: "travelDate" });
  const accommodationId = useWatch({ control, name: "accommodationId" });
  const lodgeId = useWatch({ control, name: "lodgeId" });
  const cruiseLine = useWatch({ control, name: "cruiseLine" });
  const shipName = useWatch({ control, name: "shipName" });
  const upsells = useWatch({ control, name: "upsells" });
  const tags = useWatch({ control, name: "tags" });
  const [outboundDepartAirportId, outboundArriveAirportId, outboundDepartDate, inboundDepartAirportId, inboundDepartDate] = useWatch({
    control,
    name: ["outboundDepartAirportId", "outboundArriveAirportId", "outboundDepartDate", "inboundDepartAirportId", "inboundDepartDate"],
  });

  // ── Lookup data ──────────────────────────────────────────────────────────
  const { data: packageTypesData } = usePackageTypes();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();

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
  // Derived from price/discount/serviceCharge/traveller counts via the shared
  // helper (features/quote/lib/pricing) so this recomputes the same way whether
  // those fields changed from typing OR from an import's setValue calls.
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
  // The first run is skipped so merely opening a saved booking never rewrites its stored flight dates.
  const isDepartureFirstRun = useRef(true);
  useEffect(() => {
    if (isDepartureFirstRun.current) {
      isDepartureFirstRun.current = false;
      return;
    }
    const arrival = outboundArrivalOf(form.getValues());
    const update = departureDatesForCheckIn({
      checkInDate,
      nights,
      currentOutboundDepart: form.getValues("outboundDepartDate"),
      checkInIsDerived: !!arrival && deriveCheckIn(arrival, form.getValues("travelDate")).date === checkInDate,
    });
    if (update.outboundDepartDate) setValue("outboundDepartDate", update.outboundDepartDate, { shouldDirty: true });
    if (update.inboundDepartDate) setValue("inboundDepartDate", update.inboundDepartDate, { shouldDirty: true });
  }, [checkInDate, nights, setValue]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Import Deal ───────────────────────────────────────────────────────────
  // Same bookmarklet-capture flow as the quote form (useDealCaptureImport).
  const prepareJsonImport = (): JsonImportDeps => ({
    form,
    airportsData,
    packageTypesData,
    queryClient,
    lookupKeys,
    toast,
    setImageUrls: setImageUrlsFromJson,
    skipLodgeResetRef,
    fallbackFieldMapper: (data, setIfPresent) => {
      setIfPresent("haysRef", data.haysRef || data.hays_ref);
      setIfPresent("supplierRef", data.supplierRef || data.supplier_ref);
    },
  });
  const dealImport = useDealCaptureImport(prepareJsonImport);

  // ── Side menu + footer state ──────────────────────────────────────────────
  const holidayKind = holidayKindFromName(packageTypeName);
  const sectionInputs: BookingSectionInputs = {
    haysRef,
    supplierRef,
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
    upsellCount: (upsells ?? []).length,
    walletCreditAmount,
    tagCount: (tags ?? []).length,
  };
  const sectionState = bookingSectionState(holidayKind, { cruiseOnly, hasClient: !!clientId }, sectionInputs);
  const navItems = sectionState.map((s) => ({ key: formSectionDomId(s.key), label: s.label, done: s.done, optional: s.optional }));
  const bodyRef = useRef<HTMLDivElement>(null);
  const { current, jump } = useScrollSpy(bodyRef, navItems.map((n) => n.key));

  const extrasForMoney = { transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations };
  const profit = formTotalProfit(commission, extrasForMoney);
  const margin = quoteMarginPercent(profit, formFinalTotal(price, discount, serviceCharge, extrasForMoney));
  // Net payable keeps the formula the card layout used: price − discount + service charge − wallet credit.
  const walletCredit = Number(walletCreditAmount) || 0;
  const netPayable = (Number(price) || 0) - (Number(discount) || 0) + (Number(serviceCharge) || 0) - walletCredit;

  const { done: doneCount, total: totalCount } = countDone(sectionState);
  const errorCount = collectFormErrorFields(form.formState.errors).length;

  const importBar = useQuoteImportBar({ onPageCaptureImport: dealImport.importCapture, pending: dealImport.isPending });
  const hasImportFeedback = (dealImport.validation && hasImportErrors(dealImport.validation)) || !!dealImport.picks;
  const has = (key: BookingSectionKey) => sectionState.some((s) => s.key === key);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Form {...form}>
      <form
        // The head, side menu, body and footer are direct flex children of the pop-up.
        style={{ display: "contents" }}
        onSubmit={form.handleSubmit(
          (values) => {
            // HAYS Ref format: a non-empty value is checked on create, and on edit only when it
            // differs from the stored one (older bookings keep their legacy format).
            const haysRefValue = (values.haysRef ?? "").trim();
            let submitted = values;
            if (haysRefValue && haysRefValue !== (defaultValues?.haysRef ?? "").trim()) {
              const normalised = normaliseHaysRef(haysRefValue);
              if (!normalised) {
                form.setError("haysRef", { type: "validate", message: HAYS_REF_MESSAGE });
                toast({ title: "Can't save yet", description: HAYS_REF_MESSAGE, variant: "destructive" });
                scrollToFirstFormError();
                return;
              }
              submitted = { ...values, haysRef: normalised };
            }
            return onSubmit(submitted, {
              files: pendingFiles(imageItems),
              urls: resolvedUrls(imageItems),
              deletedImageIds,
              items: imageItems,
            });
          },
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
          icon={<BookOpen size={22} color="#D97706" strokeWidth={1.8} aria-hidden="true" />}
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
                {walletCredit > 0 && (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#6B7686" }} data-testid="form-net-payable">
                    Net payable: {formatGbp(netPayable)}
                  </div>
                )}
              </>
            }
          />

          <div style={{ position: "relative", flex: 1, minWidth: 0, display: "flex" }}>
            <div className="fm-q__body" ref={bodyRef}>
              <FormSection id={formSectionDomId("references")} title="Booking references" icon={<BookOpen size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-booking-refs">
                <div className="fm-grid fm-g2">
                  <FormField
                    control={control}
                    name="haysRef"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormLabel className={fmLabelClass}>Hays ref</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="e.g. HAY-1234567" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={control}
                    name="supplierRef"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <FormLabel className={fmLabelClass}>Supplier ref</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="Enter supplier reference..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </FormSection>
              <QuoteDrawerOverview titleLabel="Booking title" showQuoteLink={false} />
              <QuoteDrawerTravelSection showCruiseStay={isCruise} />
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
                <BookingExtrasSection
                  control={control as unknown as Control<ExtrasFormValues>}
                  initialAccomLabels={initialExtraAccomLabels}
                  mainTourOperatorId={tourOperatorId ?? ""}
                  isCruise={isCruise}
                />
              </FormSection>
              <FormSection id={formSectionDomId("upsells")} title="Upsells" icon={<ShoppingBag size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-upsells">
                <BookingUpsellsSection
                  bare
                  control={control as unknown as Control<UpsellsFormValues>}
                  setValue={setValue as unknown as UseFormSetValue<UpsellsFormValues>}
                />
              </FormSection>
              <QuoteImagesSection
                items={imageItems}
                setItems={setImageItems}
                setDeletedImageIds={setDeletedImageIds}
              />
              <QuoteDrawerCostingsSection />
              {clientId && (
                <FormSection id={formSectionDomId("wallet")} title="Wallet credit" icon={<Wallet size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-wallet-credit">
                  <BookingWalletCreditSection clientId={clientId} control={control} setValue={setValue} />
                </FormSection>
              )}
              <FormSection id={formSectionDomId("tags")} title="Tags" icon={<Tag size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-tags">
                <BookingTagsSection control={control} />
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
