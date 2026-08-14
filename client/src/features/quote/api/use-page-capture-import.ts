import { useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

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
  };
}

export interface PageCaptureImportResult {
  quote: Record<string, unknown>;
  // Says what the server did — in particular when it created a new supplier from
  // the captured link, or learned that supplier's extraction spec, both of which
  // want reviewing in supplier settings.
  message: string;
}

export const pageCaptureImportApi = {
  import: async (input: PageCaptureImportInput): Promise<PageCaptureImportResult> => {
    const { data } = await axiosClient.post<
      { success?: boolean; message?: string; data?: Record<string, unknown> } | Record<string, unknown>
    >("/api/v2/scrapers/import-page", input);
    const envelope = data as { message?: string; data?: Record<string, unknown> };
    return {
      quote: (envelope?.data ?? data) as Record<string, unknown>,
      message: envelope?.message ?? "",
    };
  },
};

export function usePageCaptureImport() {
  return useMutation({
    mutationFn: (input: PageCaptureImportInput) => pageCaptureImportApi.import(input),
  });
}
