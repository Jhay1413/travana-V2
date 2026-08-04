import axiosClient from "@/api/client/axios-client";
import type { SupplierScraper, UpsertSupplierScraperInput } from "../types";

const BASE = "/api/v2/scrapers";

// The server wraps responses as { success, message, data }. Depending on the
// axios interceptor setup that envelope may or may not already be unwrapped, so
// unwrap defensively (same approach as json-mapper.api.ts).
function unwrap<T>(body: unknown): T {
  const b = body as { data?: T };
  return (b?.data ?? body) as T;
}

export const supplierScraperApi = {
  list: async (): Promise<SupplierScraper[]> => {
    const { data } = await axiosClient.get(BASE);
    return unwrap<SupplierScraper[]>(data);
  },
  create: async (input: UpsertSupplierScraperInput): Promise<SupplierScraper> => {
    const { data } = await axiosClient.post(BASE, input);
    return unwrap<SupplierScraper>(data);
  },
  update: async (id: string, input: UpsertSupplierScraperInput): Promise<SupplierScraper> => {
    const { data } = await axiosClient.patch(`${BASE}/${id}`, input);
    return unwrap<SupplierScraper>(data);
  },
  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`${BASE}/${id}`);
  },
};
