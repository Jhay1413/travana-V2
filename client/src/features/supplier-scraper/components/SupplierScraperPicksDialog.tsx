import { useState } from "react";
import { Loader2, Wand2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { parsePickerPayload } from "../api/supplier-scraper-picks.api";
import { useSupplierScraperPicks } from "../api/use-supplier-scraper-picks";
import { SupplierScraperPicksResultView } from "./SupplierScraperPicksResultView";
import type { SupplierScraperPicksResult } from "../types";

interface SupplierScraperPicksDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// The picker itself runs in the bookmarklet — an agent arms a field, clicks
// it on the real supplier page, and copies the result. This dialog only
// carries that payload to the server and shows what happened, mirroring the
// existing capture-import paste flow (QuotePageCaptureDialog).
export function SupplierScraperPicksDialog({ open, onOpenChange }: SupplierScraperPicksDialogProps) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SupplierScraperPicksResult | null>(null);
  const picksMutation = useSupplierScraperPicks();

  const reset = () => {
    setRaw("");
    setError(null);
    setResult(null);
  };

  const submit = () => {
    setError(null);
    let payload: Record<string, unknown>;
    try {
      payload = parsePickerPayload(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that payload.");
      return;
    }
    picksMutation.mutate(payload, {
      onSuccess: (data) => setResult(data),
      onError: (e) => setError(e instanceof Error ? e.message : "Could not apply those picks."),
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Apply field picks</DialogTitle>
          <DialogDescription>
            Run the field picker in the "Capture deal page" bookmarklet on the supplier's deal page, arm and click
            each field, then paste the result here. Every applied rule is one the picker verified against the value
            you clicked — it never guesses.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <>
            <div className="space-y-3">
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder="Paste the field-picker result here (Ctrl+V)…"
                disabled={picksMutation.isPending}
                className="h-48 rounded-xl font-mono text-xs"
              />
              {error && <p className="text-xs font-medium text-red-600">{error}</p>}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={submit}
                disabled={picksMutation.isPending || !raw.trim()}
                className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {picksMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Wand2 className="h-3.5 w-3.5" />
                )}
                {picksMutation.isPending ? "Applying…" : "Apply picks"}
              </button>
            </DialogFooter>
          </>
        ) : (
          <>
            <SupplierScraperPicksResultView result={result} />
            <DialogFooter>
              <button
                type="button"
                onClick={reset}
                className="rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05]"
              >
                Apply more picks
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
              >
                Done
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
