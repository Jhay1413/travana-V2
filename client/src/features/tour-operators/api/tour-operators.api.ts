import axiosClient from "@/api/client/axios-client";
import { TOUR_OPERATOR_ENDPOINTS } from "@/api/endpoints";
import type {
  CatalogueRow,
  CreateOperatorPayload,
  ImportPreview,
  ImportResult,
  ImportRowInput,
  ManageResponse,
  OrgOperatorRow,
  PatchOperatorPayload,
} from "../types";

// The axios response interceptor unwraps the `{ success, data }` envelope,
// so `response.data` IS the payload here.
export const tourOperatorsApi = {
  listManage: async (includeInactive: boolean): Promise<ManageResponse> => {
    const { data } = await axiosClient.get<ManageResponse>(TOUR_OPERATOR_ENDPOINTS.manage, {
      params: includeInactive ? { includeInactive: "1" } : undefined,
    });
    return data;
  },
  searchCatalogue: async (q: string): Promise<CatalogueRow[]> => {
    const { data } = await axiosClient.get<{ rows: CatalogueRow[] }>(TOUR_OPERATOR_ENDPOINTS.catalogue, { params: { q } });
    return data.rows;
  },
  create: async (payload: CreateOperatorPayload): Promise<OrgOperatorRow> => {
    const { data } = await axiosClient.post<OrgOperatorRow>(TOUR_OPERATOR_ENDPOINTS.list, payload);
    return data;
  },
  update: async (linkId: string, payload: PatchOperatorPayload): Promise<OrgOperatorRow> => {
    const { data } = await axiosClient.patch<OrgOperatorRow>(TOUR_OPERATOR_ENDPOINTS.link(linkId), payload);
    return data;
  },
  remove: async (linkId: string): Promise<void> => {
    await axiosClient.delete(TOUR_OPERATOR_ENDPOINTS.link(linkId));
  },
  revealPassword: async (linkId: string): Promise<string | null> => {
    const { data } = await axiosClient.get<{ password: string | null }>(TOUR_OPERATOR_ENDPOINTS.password(linkId));
    return data.password;
  },
  previewImport: async (rows: ImportRowInput[]): Promise<ImportPreview> => {
    const { data } = await axiosClient.post<ImportPreview>(TOUR_OPERATOR_ENDPOINTS.importPreview, { rows });
    return data;
  },
  applyImport: async (rows: ImportRowInput[]): Promise<ImportResult> => {
    const { data } = await axiosClient.post<ImportResult>(TOUR_OPERATOR_ENDPOINTS.import, { rows });
    return data;
  },
  /** The CSV text of the list (passwords are blank for read-only roles, server side). */
  exportCsv: async (): Promise<string> => {
    const { data } = await axiosClient.get<Blob>(TOUR_OPERATOR_ENDPOINTS.export, { responseType: "blob" });
    return data.text();
  },
};
