import { useFormContext } from "react-hook-form";
import { ExternalLink, X } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePackageTypes, useTourOperators } from "@/hooks/queries";
import { drawerControlClass, drawerInputClass, drawerLabelClass } from "@/components/shared/form-drawer";
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
export function QuoteDrawerOverview({ titleLabel = "Quote Title", showQuoteLink = true }: QuoteDrawerOverviewProps) {
  const { control, setValue, getValues } = useFormContext<SharedHolidayFormValues>();
  const { data: packageTypesData } = usePackageTypes();
  const { data: tourOperatorsData } = useTourOperators();

  return (
    <div className="space-y-5 px-7 pb-6 pt-6" data-testid="drawer-overview">
      <FormField
        control={control}
        name="quoteTitle"
        render={({ field }) => (
          <FormItem className="space-y-1.5">
            <FormLabel className={drawerLabelClass}>{titleLabel}</FormLabel>
            <div className="relative max-w-[340px]">
              <FormControl>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  className={cn(drawerInputClass, "pr-9")}
                  placeholder="Enter title..."
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

      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        <FormField
          control={control}
          name="packageType"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Holiday Type</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={drawerControlClass}>
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
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Tour Operator</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={drawerControlClass}
                  options={(tourOperatorsData || []).map((op: { id: string; name: string | null }) => ({
                    value: op.id,
                    label: op.name || op.id,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const op = tourOperatorsData?.find((o: { id: string }) => o.id === value);
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
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="leadSource"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Lead Source</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={drawerControlClass}>
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
      </div>

      {showQuoteLink && <QuoteLinkField />}
    </div>
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
        <FormItem className="space-y-1.5">
          <FormLabel className={drawerLabelClass}>Quote Link</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input {...field} value={field.value ?? ""} className={drawerInputClass} placeholder="https://..." />
            </FormControl>
            {field.value && (
              <a
                href={field.value}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border border-blue-200 bg-blue-50 px-3 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
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
  );
}
