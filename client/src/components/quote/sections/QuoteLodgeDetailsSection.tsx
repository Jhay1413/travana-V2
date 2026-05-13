import { useFormContext, useWatch } from "react-hook-form";
import { Hotel, PawPrint } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useParks, useLodges } from "@/hooks/queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

export function QuoteLodgeDetailsSection() {
  const { control } = useFormContext<QuoteFormValues>();
  const parkId = useWatch({ control, name: "parkId" });
  const { data: parksData } = useParks();
  const { data: lodgesData } = useLodges(parkId || undefined);

  return (
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
                  options={(parksData ?? []).map((p: { id: string; name: string | null }) => ({
                    value: p.id,
                    label: p.name || p.id,
                  }))}
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
                  options={(lodgesData ?? []).map((l: { id: string; lodge_name: string | null; lodge_code: string | null }) => ({
                    value: l.id,
                    label: l.lodge_name || l.lodge_code || l.id,
                  }))}
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
                <Input type="number" {...field} className="h-9 rounded-xl border-black/10 bg-white/70" min={1} />
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
  );
}
