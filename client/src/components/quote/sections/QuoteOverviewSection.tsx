import { useFormContext } from "react-hook-form";
import { FileText, ExternalLink } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { usePackageTypes, useTourOperators } from "@/hooks/queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

export function QuoteOverviewSection() {
  const { control, setValue, getValues } = useFormContext<QuoteFormValues>();
  const { data: packageTypesData } = usePackageTypes();
  const { data: tourOperatorsData } = useTourOperators();

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={FileText} title="Quote Overview" />
      <div className="grid gap-3 md:grid-cols-2">
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
          name="quoteTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Quote Title</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="Enter title..." />
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
                  options={(tourOperatorsData || []).map((op: { id: string; name: string | null }) => ({
                    value: op.id,
                    label: op.name || op.id,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    const op = tourOperatorsData?.find((o: { id: string }) => o.id === value);
                    if (op?.commission_percentage != null) {
                      const currentPrice = Number(getValues("price")) || 0;
                      const currentDiscount = Number(getValues("discount")) || 0;
                      const currentServiceCharge = Number(getValues("serviceCharge")) || 0;
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
                    <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="quoteLink"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Quote Link</FormLabel>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="https://..." />
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
  );
}
