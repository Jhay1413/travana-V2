import axiosClient from "@/api/client/axios-client";
import type { SupplierScraperPicksResult } from "../types";

const BASE = "/api/v2/scrapers";

// The server wraps responses as { success, message, data }; unwrap
// defensively (same approach as supplier-scraper.api.ts).
function unwrap<T>(body: unknown): T {
  const b = body as { data?: T };
  return (b?.data ?? body) as T;
}

// The field-picker itself lives in the bookmarklet: an agent arms a field and
// clicks the element on the real supplier page, and the bookmarklet copies a
// JSON payload of what was picked. This module only carries that payload to
// the server, exactly like the existing capture-import paste flow — it never
// builds the picker UI.
//
// The payload's own shape is whatever the bookmarklet/server contract says
// (that contract is owned elsewhere); this only requires it to be a JSON
// object, so a copy-paste mistake is rejected with a message aimed at what
// the agent most likely did, rather than crashing deeper in the request.
export function parsePickerPayload(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "That doesn't look like a picker payload. Run the field picker in the bookmarklet, copy its result, then paste here.",
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("That picker payload isn't a JSON object — re-copy it from the bookmarklet.");
  }
  return parsed as Record<string, unknown>;
}

export const supplierScraperPicksApi = {
  submit: async (payload: Record<string, unknown>): Promise<SupplierScraperPicksResult> => {
    const { data } = await axiosClient.post(`${BASE}/picks`, payload);
    return unwrap<SupplierScraperPicksResult>(data);
  },
};
