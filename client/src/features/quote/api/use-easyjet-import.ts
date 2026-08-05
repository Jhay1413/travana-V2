import { useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

export interface EasyJetImportInput {
  url: string;
  // Supplier chosen in the import dropdown (supplier_key). Optional — the server
  // falls back to matching the URL when omitted.
  supplierKey?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

// The server returns the same ScraperJson shape the file-based JSON import
// consumes (see server/v2/modules/easyjet/easyjet.types.ts), so the result is
// fed straight into handleJsonData from @/lib/json-import-handler.
//
// Posts to the config-driven scraper endpoint: the server resolves which
// supplier (easyJet, TUI, …) the URL belongs to from this org's stored configs
// and uses that supplier's DB credentials — no env credentials involved.
export const easyjetImportApi = {
  scrape: async (input: EasyJetImportInput): Promise<Record<string, unknown>> => {
    const { data } = await axiosClient.post<
      { success?: boolean; data?: Record<string, unknown> } | Record<string, unknown>
    >("/api/v2/scrapers/scrape", input, {
      // A cold browser session + heavy portal login (Jet2) runs ~80s, and the
      // server may retry once through a fresh cloud session when a bot-challenge
      // detaches the first one — so allow for two attempts (server deadline 175s).
      timeout: 185_000,
    });
    const payload = (data as { data?: Record<string, unknown> })?.data ?? data;
    return payload as Record<string, unknown>;
  },
};

export function useEasyJetImport() {
  return useMutation({
    mutationFn: (input: EasyJetImportInput) => easyjetImportApi.scrape(input),
  });
}
