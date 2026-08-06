import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import { FormField } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useSupplierScrapers } from "@/features/supplier-scraper";
import type { QuoteFormValues } from "@/features/quote/types";
import { QuotePageCaptureDialog } from "./QuotePageCaptureDialog";
import { parseCapture, type CapturedPage } from "@/features/quote/api/use-page-capture-import";

interface QuoteImportRowProps {
  onJsonUpload: (file: File) => void;
  // Import from a page the agent captured in their own browser (bookmarklet).
  onPageCaptureImport?: (capture: CapturedPage, supplierKey: string) => void;
  pageCapturePending?: boolean;
}

export function QuoteImportRow({
  onJsonUpload,
  onPageCaptureImport,
  pageCapturePending,
}: QuoteImportRowProps) {
  const { control } = useFormContext<QuoteFormValues>();
  const { data: scrapers } = useSupplierScrapers();
  const [captureOpen, setCaptureOpen] = useState(false);
  const [clipboardText, setClipboardText] = useState("");

  // Only suppliers that are configured and enabled can be scraped.
  const active = (scrapers ?? []).filter((s) => s.isActive);

  // The capture dialog resolves the supplier from the captured link, and creates
  // one for an unrecognised site — so it needs no supplier configured up front.
  // The list is only offered as an override.

  // The bookmarklet already put the capture on the clipboard, so read it here
  // and import straight away — pasting it into a box first is a step that adds
  // nothing. The supplier is worked out from the captured URL server-side, so
  // there is nothing else to ask for.
  //
  // Reading the clipboard needs permission and isn't available in every browser
  // (Firefox has no readText outside extensions), so any failure — blocked,
  // unsupported, or the clipboard holding something that isn't a capture —
  // falls back to the paste dialog rather than dead-ending.
  const captureFromClipboard = async () => {
    if (!onPageCaptureImport) return;
    let raw = "";
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      setClipboardText(""); // clipboard unreadable — offer the paste box empty
      setCaptureOpen(true);
      return;
    }
    try {
      onPageCaptureImport(parseCapture(raw), "");
    } catch {
      // Read fine, but it isn't a capture. Hand the text to the dialog so the
      // user can see what was actually on the clipboard.
      setClipboardText(raw);
      setCaptureOpen(true);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
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
      {onPageCaptureImport && (
        <>
          <button
            type="button"
            onClick={captureFromClipboard}
            disabled={pageCapturePending}
            title="Import the deal page you captured with the bookmarklet"
            className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05]"
          >
            {pageCapturePending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardPaste className="h-3.5 w-3.5" />
            )}
            {pageCapturePending ? "Importing…" : "Import Deal"}
          </button>
          <QuotePageCaptureDialog
            open={captureOpen}
            onOpenChange={setCaptureOpen}
            suppliers={active}
            pending={pageCapturePending}
            initialValue={clipboardText}
            onImport={(capture, key) => {
              onPageCaptureImport(capture, key);
              setCaptureOpen(false);
            }}
          />
        </>
      )}
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
