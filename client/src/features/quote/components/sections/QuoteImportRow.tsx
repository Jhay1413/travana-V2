import { useFormContext } from "react-hook-form";
import { Upload } from "lucide-react";
import { FormField } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import type { QuoteFormValues } from "@/features/quote/types";

interface QuoteImportRowProps {
  onJsonUpload: (file: File) => void;
}

export function QuoteImportRow({ onJsonUpload }: QuoteImportRowProps) {
  const { control } = useFormContext<QuoteFormValues>();
  return (
    <div className="flex items-center justify-end gap-3">
      <FormField
        control={control}
        name="not_for_social"
        render={({ field }) => (
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 transition hover:bg-black/[0.03]">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            <span className="text-xs font-medium text-black/60 leading-none select-none">Not For Social</span>
          </label>
        )}
      />
      <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05]">
        <Upload className="h-3.5 w-3.5" />
        Import JSON
        <input
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onJsonUpload(file);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}
