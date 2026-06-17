import { useFormContext } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import type { QuoteFormValues } from "@/features/quote/types";

export function QuoteTestToggleSection() {
  const { control } = useFormContext<QuoteFormValues>();
  return (
    <FormField
      control={control}
      name="is_test"
      render={({ field }) => (
        <FormItem className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <FormControl>
            <Switch checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <div>
            <FormLabel className="text-sm font-medium text-orange-700">Test Quote</FormLabel>
            <p className="text-xs text-orange-500">Will not appear in pipeline, stats, or generate social posts</p>
          </div>
        </FormItem>
      )}
    />
  );
}
