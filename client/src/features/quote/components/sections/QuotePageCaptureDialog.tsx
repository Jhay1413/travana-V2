import { useEffect, useState } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { parseCapture, type CapturedPage } from "@/features/quote/api/use-page-capture-import";

interface SupplierOption {
  supplierKey: string;
  supplierName: string;
}

interface QuotePageCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: SupplierOption[];
  pending?: boolean;
  // Whatever was on the clipboard when the direct read failed, so the user can
  // see what the button actually found instead of an empty box.
  initialValue?: string;
  onImport: (capture: CapturedPage, supplierKey: string) => void;
}

// Sentinel for the default "work it out from the URL" choice; Radix Select can't
// hold an empty string as a value.
const AUTO = "__auto__";

// Paste target for the "Capture deal page" bookmarklet. The agent stays logged
// into the supplier in their own browser; nothing here touches credentials.
export function QuotePageCaptureDialog({
  open,
  onOpenChange,
  suppliers,
  pending,
  initialValue,
  onImport,
}: QuotePageCaptureDialogProps) {
  const [raw, setRaw] = useState(initialValue ?? "");
  const [supplierKey, setSupplierKey] = useState(AUTO);
  const [error, setError] = useState<string | null>(null);

  // The dialog stays mounted between opens, so seed it each time it opens —
  // useState alone would only ever take the first value.
  useEffect(() => {
    if (open) {
      setRaw(initialValue ?? "");
      setError(null);
    }
  }, [open, initialValue]);

  const submit = () => {
    setError(null);
    try {
      onImport(parseCapture(raw), supplierKey === AUTO ? "" : supplierKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that capture.");
    }
  };

  const canImport = !pending && !!raw.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setRaw("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Capture from supplier page</DialogTitle>
          <DialogDescription>
            <strong>Capture</strong> normally reads your clipboard directly. It couldn't this time — the browser
            blocked it, or the clipboard didn't hold a capture. Click the <strong>Capture deal page</strong>
            bookmarklet on the deal, then paste below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Select value={supplierKey} onValueChange={setSupplierKey} disabled={pending}>
            <SelectTrigger className="h-9 rounded-xl text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUTO}>Detect supplier from the link</SelectItem>
              {suppliers.map((s) => (
                <SelectItem key={s.supplierKey} value={s.supplierKey}>
                  Force: {s.supplierName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder="Paste the capture here (Ctrl+V)…"
            disabled={pending}
            className="h-40 rounded-xl font-mono text-xs"
          />

          {error && <p className="text-xs font-medium text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={submit}
            disabled={!canImport}
            className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/[0.05] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardPaste className="h-3.5 w-3.5" />}
            {pending ? "Importing…" : "Import"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
