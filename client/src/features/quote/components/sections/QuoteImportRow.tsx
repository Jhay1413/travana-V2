import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { Loader2, Upload } from "lucide-react";
import { FormField } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSupplierScrapers } from "@/features/supplier-scraper";
import type { QuoteFormValues } from "@/features/quote/types";

interface QuoteImportRowProps {
  onJsonUpload: (file: File) => void;
  // Scrape a supplier deal: (url, supplierKey) from the dropdown below.
  onSupplierImport?: (url: string, supplierKey: string) => void;
  supplierImportPending?: boolean;
}

export function QuoteImportRow({ onJsonUpload, onSupplierImport, supplierImportPending }: QuoteImportRowProps) {
  const { control } = useFormContext<QuoteFormValues>();
  const { data: scrapers, isLoading } = useSupplierScrapers();
  const [url, setUrl] = useState("");
  const [supplierKey, setSupplierKey] = useState("");

  // Only suppliers that are configured and enabled can be scraped.
  const active = (scrapers ?? []).filter((s) => s.isActive);

  const canImport = !supplierImportPending && !!url.trim() && !!supplierKey;
  const submit = () => {
    if (canImport && onSupplierImport) onSupplierImport(url.trim(), supplierKey);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {onSupplierImport && (
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Paste supplier deal link…"
            disabled={supplierImportPending}
            className="h-8 min-w-[200px] flex-1 rounded-xl border-black/10 bg-white/70 text-xs"
          />
          <Select value={supplierKey} onValueChange={setSupplierKey} disabled={supplierImportPending || isLoading}>
            <SelectTrigger className="h-8 w-[170px] rounded-xl border-black/10 bg-white/70 text-xs">
              <SelectValue placeholder={isLoading ? "Loading…" : active.length ? "Supplier" : "No suppliers"} />
            </SelectTrigger>
            <SelectContent>
              {active.map((s) => (
                <SelectItem key={s.id} value={s.supplierKey}>
                  {s.supplierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={submit}
            disabled={!canImport}
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {supplierImportPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {supplierImportPending ? "Importing…" : "Import"}
          </button>
        </div>
      )}
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
