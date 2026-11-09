import { useFormContext } from "react-hook-form";
import { ExternalLink, Tag, X } from "lucide-react";
import { FormSection } from "@/components/shared/form-shell";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormLabelTooltip } from "@/components/shared/label-tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePackageTypes, useTourOperators } from "@/hooks/queries";
import { findOperator, operatorSelectOptions, OperatorRateHint, useOperatorNames } from "@/features/tour-operator";
import { fmControlClass, fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import { commissionForOperator, operatorCommissionPct } from "@/features/quote/lib/pricing";
import { formatLeadSource } from "@/features/quote/components/quote-types";
import { cn } from "@/lib/utils";
import { LEAD_SOURCES } from "@/features/quote/types/quote-form.types";
import type { QuoteFormValues, SharedHolidayFormValues } from "@/features/quote/types";

interface QuoteDrawerOverviewProps {
  titleLabel?: string;
  /** Bookings have no quote link field. */
  showQuoteLink?: boolean;
}

/**
 * Top block of the Create / Edit drawer: title (with an inline clear button),
 * then Holiday Type / Tour Operator / Lead Source in one row. Shared by the
 * quote and booking forms — both carry these fields under the same names.
 */
export function QuoteDrawerOverview({ titleLabel = "Quote title", showQuoteLink = true }: QuoteDrawerOverviewProps) {
  const { control, setValue, getValues } = useFormContext<SharedHolidayFormValues>();
  const { data: packageTypesData } = usePackageTypes();
  const { data: tourOperatorsData } = useTourOperators();
  const operatorNames = useOperatorNames();

  return (
    <FormSection id={formSectionDomId("overview")} title={`${titleLabel.replace(/ title$/i, "")} details`} icon={<Tag size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-overview">
    <div className="fm-grid fm-g2">
      <FormField
        control={control}
        name="quoteTitle"
        render={({ field }) => (
          <FormItem className="fm-span2 space-y-0">
            <FormLabel className={fmLabelClass}>{titleLabel}</FormLabel>
            <div className="relative">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className={cn(fmInputClass, "pr-9")}
                  placeholder="e.g. Bahia Principe Explore Punta Cana"
                  data-testid="input-drawer-title"
                />
              </FormControl>
              {field.value && (
                <button
                  type="button"
                  onClick={() => field.onChange("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-black/40 transition hover:text-black/70"
                  aria-label="Clear title"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

        <FormField
          control={control}
          name="packageType"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabelTooltip className={fmLabelClass} tip="The kind of holiday being quoted. It decides which sections appear, such as cruise or lodge details.">Holiday type</FormLabelTooltip>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={fmControlClass}>
                    <SelectValue placeholder="Select holiday type..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(packageTypesData || []).map((pt: { id: string; name: string }) => (
                    <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="tourOperatorId"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Tour operator</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={fmControlClass}
                  options={operatorSelectOptions(tourOperatorsData, field.value, operatorNames[field.value ?? ""])}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const op = findOperator(tourOperatorsData, value);
                    const pct = operatorCommissionPct(op);
                    if (pct != null) {
                      setValue(
                        "commission",
                        commissionForOperator(pct, getValues("price"), getValues("discount"), getValues("serviceCharge")),
                        { shouldValidate: true, shouldDirty: true },
                      );
                    }
                  }}
                  placeholder="Select operator..."
                />
              </FormControl>
              <OperatorRateHint operators={tourOperatorsData} selectedId={field.value} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="leadSource"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabelTooltip className={fmLabelClass} tip="Where the customer first got in touch: Shop, Facebook, WhatsApp, Instagram or Phone Enquiry. Used for source reporting.">Lead source</FormLabelTooltip>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={fmControlClass}>
                    <SelectValue placeholder="Select lead source..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {LEAD_SOURCES.map((s) => (
                    <SelectItem key={s} value={s}>{formatLeadSource(s)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      {showQuoteLink && <QuoteLinkField />}
    </div>
    </FormSection>
  );
}

/** Quote-only field, so it reads the full quote form type rather than the shared subset. */
function QuoteLinkField() {
  const { control } = useFormContext<QuoteFormValues>();
  return (
    <FormField
      control={control}
      name="quoteLink"
      render={({ field }) => (
        <FormItem className="space-y-0">
          <FormLabel className={fmLabelClass}>Quote link</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="https://..." />
            </FormControl>
            {field.value && (
              <a
                href={field.value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-[42px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#E3E8EF] bg-white px-3.5 text-[13px] font-semibold text-[#B45309] transition hover:border-[#F59E0B]"
                data-testid="link-view-quote-link"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View link
              </a>
            )}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
