import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tourOperatorsApi } from "./tour-operators.api";
import type { CatalogueRow, CreateOperatorPayload, ImportRowInput, ManageResponse, PatchOperatorPayload } from "../types";

// Root key shared with the quote/booking dropdowns, so every write refreshes them too.
const ROOT = ["tourOperators"] as const;

export const tourOperatorsKeys = {
  root: ROOT,
  manage: (includeInactive: boolean) => [...ROOT, "manage", { includeInactive }] as const,
  catalogue: (q: string) => [...ROOT, "catalogue", q] as const,
};

/** The org's list. Plain passwords may be in here, so it is dropped from the cache soon after the page closes. */
export function useOperatorsManage() {
  return useQuery<ManageResponse>({
    queryKey: tourOperatorsKeys.manage(true),
    queryFn: () => tourOperatorsApi.listManage(true),
    gcTime: 60_000,
    retry: false,
  });
}

export function useCatalogueSearch(q: string, enabled: boolean) {
  return useQuery<CatalogueRow[]>({
    queryKey: tourOperatorsKeys.catalogue(q.trim()),
    queryFn: () => tourOperatorsApi.searchCatalogue(q.trim()),
    enabled: enabled && q.trim().length >= 2,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

function useRefresh() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ROOT });
}

export function useCreateOperator() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (payload: CreateOperatorPayload) => tourOperatorsApi.create(payload),
    onSuccess: refresh,
  });
}

export function useUpdateOperator() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (vars: { linkId: string; payload: PatchOperatorPayload }) => tourOperatorsApi.update(vars.linkId, vars.payload),
    onSuccess: refresh,
  });
}

export function useRemoveOperator() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (linkId: string) => tourOperatorsApi.remove(linkId),
    onSuccess: refresh,
  });
}

export function usePreviewImport() {
  return useMutation({ mutationFn: (rows: ImportRowInput[]) => tourOperatorsApi.previewImport(rows) });
}

export function useApplyImport() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (rows: ImportRowInput[]) => tourOperatorsApi.applyImport(rows),
    onSuccess: refresh,
  });
}
