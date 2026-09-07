import { useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import type { SupplierScraperPicksResult } from "@/features/supplier-scraper";

// One entry from the bookmarklet's FIELD PICKER mode (mirrors the server's
// picker-spec.ts PickedField / scraper.validator.ts's pickedFieldSchema
// field-for-field). Not deeply validated here — see parseCapture below — the
// server's Zod schema is the single source of truth for shape and rejects a
// malformed entry with a 400.
export interface PickedField {
  field: string;
  value: string;
  textIndex: number;
  lineIndex: number;
  linesBefore: string[];
  linesAfter: string[];
  occurrenceIndex: number;
  occurrenceCount: number;
  tag: string;
  ancestorTags: string[];
  siblingIndex: number;
}

export type PickerPackageType = "cruise" | "package-holiday" | "lodge";

// A deal page captured by the "Capture deal page" bookmarklet, running in the
// agent's OWN already-logged-in browser. Because the capture comes from a real
// session, the server needs no credentials, no proxy and no headless browser —
// it just runs the supplier's extraction spec over the text.
export interface CapturedPage {
  url: string;
  title?: string;
  text: string;
  images?: string[];
  // Index-aligned with `images`: the class names / data-tids around each one, so
  // a spec can keep the property gallery and drop the room-card carousels that
  // share the same image host.
  imageContexts?: string[];
  // The page's h1/h2 text in document order. The deal's headline lives here —
  // in body text it's an unanchorable line, but a spec rule can address this
  // list positionally.
  headings?: string[];
  flightsText?: string;
  // The operator's embedded booking record, when the page carries one. This is
  // the best source by far — flights, images and prices already structured —
  // so it must survive parseCapture's whitelist below.
  apiJson?: unknown;
  // The full DOM text INCLUDING collapsed/hidden nodes and open shadow roots —
  // unlike `text` (document.body.innerText), which excludes anything not
  // rendered. A Royal Caribbean checkout captured without opening the "View
  // Ports" drawer had its whole day-by-day itinerary missing from `text`, even
  // though the content was in the DOM the whole time (an image inside the
  // drawer WAS captured, and "Itinerary" was in `headings`). Optional — absent
  // from captures made with a pre-deepText bookmarklet, in which case an
  // import behaves exactly as it does today.
  deepText?: string;
  // Present when this capture came from the bookmarklet's FIELD PICKER mode
  // rather than "Instant capture" — an agent armed fields and clicked them on
  // the page instead of relying on the AI-generated spec. Carrying these
  // through is the actual fix for the bug this file's own test warns about:
  // parseCapture used to rebuild the payload from a whitelist that OMITTED
  // pickerVersion/packageType/picked, so pasting a picker payload into this
  // normal capture dialog (QuotePageCaptureDialog, "Capture from supplier
  // page") silently stripped the picks, imported an ordinary deal, and showed
  // a success toast — with `origin: 'picked'` never once appearing on a
  // stored rule across all 13 stored specs, despite the picker having been
  // used. See use-page-capture-import.test.ts.
  pickerVersion?: number;
  packageType?: PickerPackageType;
  picked?: PickedField[];
}

export interface PageCaptureImportInput extends CapturedPage {
  // Supplier chosen in the dropdown. Optional — the server falls back to
  // matching the captured URL against this org's configured suppliers.
  supplierKey?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

// Rejects anything that isn't a plausible bookmarklet capture, with a message
// aimed at what the user most likely did (copied the page itself, not the JSON).
export function parseCapture(raw: string): CapturedPage {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "That doesn't look like a capture. Click the “Capture deal page” bookmarklet on the supplier's deal page, then paste here.",
    );
  }
  const c = parsed as Partial<CapturedPage>;
  if (!c || typeof c.url !== "string" || typeof c.text !== "string") {
    throw new Error("That capture is missing its url/text — re-run the bookmarklet on the deal page.");
  }
  return {
    url: c.url,
    title: typeof c.title === "string" ? c.title : "",
    text: c.text,
    images: Array.isArray(c.images) ? c.images.filter((s): s is string => typeof s === "string") : undefined,
    imageContexts: Array.isArray(c.imageContexts)
      ? c.imageContexts.filter((s): s is string => typeof s === "string")
      : undefined,
    // Absent from captures made with a pre-v7 bookmarklet — optional, so an old
    // one still imports, just without a title.
    headings: Array.isArray(c.headings) ? c.headings.filter((s): s is string => typeof s === "string") : undefined,
    flightsText: typeof c.flightsText === "string" && c.flightsText ? c.flightsText : undefined,
    apiJson: c.apiJson ?? undefined,
    // Absent from captures made with a pre-deepText bookmarklet — optional, so
    // an old capture still imports exactly as it does today, just without the
    // extra hidden-content source.
    deepText: typeof c.deepText === "string" && c.deepText ? c.deepText : undefined,
    pickerVersion: typeof c.pickerVersion === "number" ? c.pickerVersion : undefined,
    packageType:
      c.packageType === "cruise" || c.packageType === "package-holiday" || c.packageType === "lodge"
        ? c.packageType
        : undefined,
    // THIS is the field the whitelist used to omit — the whole reason a
    // picker payload pasted into this dialog was silently discarded. Only
    // checked for "is it an array" here: the server's Zod validator
    // (importPageValidator, reusing pickedFieldSchema) is the single source
    // of truth for each entry's shape and rejects a malformed one with a 400
    // rather than this layer guessing at it.
    picked: Array.isArray(c.picked) ? (c.picked as PickedField[]) : undefined,
  };
}

// Post-extraction validation (EXTRACTION_AUDIT.md §4 Phase 1). The server
// NEVER blocks an import on this — the deal always lands in the form — but it
// tells the client which fields it isn't confident in, so a wrong money value
// isn't silently trusted. `field`, when present, names a key on `quote`
// (`sales_price`, `currency`, `travel_date`, …) or a dotted/indexed path like
// `flights[0].departing_airport_name`.
export type ImportIssueLevel = "error" | "warn";

export interface ImportValidationIssue {
  code: string;
  level: ImportIssueLevel;
  field?: string;
  message: string;
}

export interface ImportValidation {
  level: "ok" | "warn" | "error";
  issues: ImportValidationIssue[];
}

function isImportValidation(value: unknown): value is ImportValidation {
  if (!value || typeof value !== "object") return false;
  const v = value as { level?: unknown; issues?: unknown };
  return (
    (v.level === "ok" || v.level === "warn" || v.level === "error") &&
    Array.isArray(v.issues)
  );
}

function isPicksResult(value: unknown): value is SupplierScraperPicksResult {
  if (!value || typeof value !== "object") return false;
  const v = value as { applied?: unknown; problems?: unknown; preserved?: unknown };
  return Array.isArray(v.applied) && Array.isArray(v.problems) && Array.isArray(v.preserved);
}

export interface PageCaptureImportResult {
  quote: Record<string, unknown>;
  // Says what the server did — in particular when it created a new supplier from
  // the captured link, or learned that supplier's extraction spec, both of which
  // want reviewing in supplier settings.
  message: string;
  // Absent from a server response predating this field — an older/degraded
  // response behaves exactly as before, with no validation panel shown.
  validation?: ImportValidation;
  // Present only when this import carried field-picker picks (`input.picked`
  // was non-empty) — see scraper.service.ts's importFromPage/applyPickedFields.
  // Same shape POST /scrapers/picks returns, so SupplierScraperPicksResultView
  // (features/supplier-scraper) can render either path.
  picks?: SupplierScraperPicksResult;
}

export const pageCaptureImportApi = {
  import: async (input: PageCaptureImportInput): Promise<PageCaptureImportResult> => {
    const { data } = await axiosClient.post<
      { success?: boolean; message?: string; data?: Record<string, unknown> } | Record<string, unknown>
    >("/api/v2/scrapers/import-page", input);
    const envelope = data as { message?: string; data?: Record<string, unknown> };
    // The controller spreads `validation` (and, when picks were sent,
    // `picks`) alongside the quote's own fields inside `data` rather than
    // nesting it, so both have to be split back out here before the rest is
    // handed to the quote importer as if it were the raw scraped JSON.
    const payload = { ...((envelope?.data ?? data) as Record<string, unknown>) };
    const validation = payload.validation;
    delete payload.validation;
    const picks = payload.picks;
    delete payload.picks;

    // Silent-discard guard (the whole reason this file's fields exist): if
    // THIS request carried picks but the response comes back with no `picks`
    // key at all, something between here and the server stripped them again —
    // exactly the class of bug that made pasting a picker payload into this
    // dialog a no-op with a success toast and zero rules ever written. Treat
    // that as a hard error rather than importing quietly, so a future
    // whitelist/validator regression is visible instead of silent.
    const hadPicks = Array.isArray(input.picked) && input.picked.length > 0;
    if (hadPicks && !isPicksResult(picks)) {
      throw new Error(
        "This paste included field picks, but the server's response didn't confirm applying them — the picks " +
          "may have been silently dropped. The deal was NOT loaded into the form; please report this instead of retrying.",
      );
    }

    return {
      quote: payload,
      message: envelope?.message ?? "",
      validation: isImportValidation(validation) ? validation : undefined,
      picks: isPicksResult(picks) ? picks : undefined,
    };
  },
};

export function usePageCaptureImport() {
  return useMutation({
    mutationFn: (input: PageCaptureImportInput) => pageCaptureImportApi.import(input),
  });
}
