import { useEffect, useState, type ReactNode } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { FormButton } from "@/components/shared/form-shell";
import { useSupplierScrapers } from "@/features/supplier-scraper";
import { parseCapture, type CapturedPage } from "@/features/quote/api/use-page-capture-import";

// Sentinel for the default "work it out from the URL" choice.
const AUTO = "__auto__";

interface UseQuoteImportBarArgs {
  onPageCaptureImport: (capture: CapturedPage, supplierKey: string) => void;
  pending?: boolean;
}

interface QuoteImportBar {
  /** Navy "Import Deal" button for the form head. */
  button: ReactNode;
  /** Inline paste bar; null until a clipboard import could not be used directly. */
  bar: ReactNode;
}

/**
 * The quote form's "Import Deal" entry. The button reads the clipboard (put there by the
 * bookmarklet) and imports straight away. Reading needs permission and is not available in every
 * browser, and the clipboard may hold something that is not a capture, so any failure opens an
 * inline bar with a paste box (and a supplier override) instead of dead-ending.
 */
export function useQuoteImportBar({ onPageCaptureImport, pending }: UseQuoteImportBarArgs): QuoteImportBar {
  const [barOpen, setBarOpen] = useState(false);
  const [clipboardText, setClipboardText] = useState("");

  const captureFromClipboard = async () => {
    let raw = "";
    try {
      raw = await navigator.clipboard.readText();
    } catch {
      setClipboardText(""); // clipboard unreadable: offer the paste box empty
      setBarOpen(true);
      return;
    }
    try {
      onPageCaptureImport(parseCapture(raw), "");
    } catch {
      // Read fine, but it is not a capture: show what was actually on the clipboard.
      setClipboardText(raw);
      setBarOpen(true);
    }
  };

  const button = (
    <FormButton tone="navy" onClick={captureFromClipboard} disabled={pending} title="Import the deal page you captured with the bookmarklet" data-testid="button-import-deal">
      {pending ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : <ClipboardPaste size={17} aria-hidden="true" />}
      {pending ? "Importing…" : "Import Deal"}
    </FormButton>
  );

  const bar = barOpen ? (
    <QuoteImportBar
      initialValue={clipboardText}
      pending={pending}
      onCancel={() => setBarOpen(false)}
      onImport={(capture, key) => {
        onPageCaptureImport(capture, key);
        setBarOpen(false);
      }}
    />
  ) : null;

  return { button, bar };
}

interface QuoteImportBarProps {
  initialValue: string;
  pending?: boolean;
  onCancel: () => void;
  onImport: (capture: CapturedPage, supplierKey: string) => void;
}

function QuoteImportBar({ initialValue, pending, onCancel, onImport }: QuoteImportBarProps) {
  const { data: scrapers } = useSupplierScrapers();
  const suppliers = (scrapers ?? []).filter((s) => s.isActive);
  const [raw, setRaw] = useState(initialValue);
  const [supplierKey, setSupplierKey] = useState(AUTO);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRaw(initialValue);
    setError(null);
  }, [initialValue]);

  const submit = () => {
    setError(null);
    try {
      onImport(parseCapture(raw), supplierKey === AUTO ? "" : supplierKey);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read that capture.");
    }
  };

  return (
    <div className="fm-q__import" data-testid="quote-import-bar">
      <label className="fm-label" htmlFor="qf-import-paste">
        Paste the capture from the supplier page
      </label>
      <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6B7686" }}>
        Import Deal normally reads your clipboard directly. It could not this time, so click the Capture deal page bookmarklet on the deal, then paste below.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <textarea
          id="qf-import-paste"
          className="fm-input"
          style={{ flex: "1 1 360px", height: 84, padding: 10, fontFamily: "monospace", fontSize: 12 }}
          value={raw}
          disabled={pending}
          placeholder="Paste the capture here (Ctrl+V)…"
          onChange={(e) => setRaw(e.target.value)}
        />
        <select className="fm-input" style={{ flex: "0 1 240px" }} value={supplierKey} disabled={pending} onChange={(e) => setSupplierKey(e.target.value)} aria-label="Supplier">
          <option value={AUTO}>Detect supplier from the link</option>
          {suppliers.map((s) => (
            <option key={s.supplierKey} value={s.supplierKey}>
              Force: {s.supplierName}
            </option>
          ))}
        </select>
        <FormButton tone="primary" onClick={submit} disabled={pending || !raw.trim()}>
          {pending ? "Importing…" : "Import"}
        </FormButton>
        <FormButton onClick={onCancel}>Cancel</FormButton>
      </div>
      {error ? (
        <p className="fm-err" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
