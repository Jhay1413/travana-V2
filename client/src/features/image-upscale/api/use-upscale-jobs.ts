import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { quoteKeys } from "@/features/quote/api/use-quote-queries";
import { imageUpscaleApi } from "./image-upscale.api";
import { isJobActive, type CreateUpscaleJobParams, type UpscaleJob } from "../types";

export const upscaleJobKeys = {
  all: ["imageUpscaleJobs"] as const,
  byQuote: (quoteId: string) => [...upscaleJobKeys.all, "quote", quoteId] as const,
  mine: () => [...upscaleJobKeys.all, "mine"] as const,
  detail: (id: string) => [...upscaleJobKeys.all, "detail", id] as const,
};

/** Polling fallback: SSE is the primary path, so poll only while a job is in flight. */
const ACTIVE_POLL_MS = 2500;
const RECENT_LIMIT = 10;
const TEMP_PREFIX = "temp-";

export const isTempJob = (job: Pick<UpscaleJob, "id">): boolean => job.id.startsWith(TEMP_PREFIX);

function byNewest(a: UpscaleJob, b: UpscaleJob): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function upsert(list: UpscaleJob[] | undefined, job: UpscaleJob): UpscaleJob[] {
  const rest = (list ?? []).filter(
    (j) => j.id !== job.id && !(isTempJob(j) && j.quoteId === job.quoteId && j.originalUrl === job.originalUrl),
  );
  return [job, ...rest].sort(byNewest);
}

/**
 * Writes one job into every cache that can show it. Lists are only patched
 * once loaded: creating one from a single pushed job would look complete while
 * missing the quote's other jobs (the optimistic placeholder path is separate).
 */
export function upsertUpscaleJob(qc: QueryClient, job: UpscaleJob): void {
  if (job.quoteId) {
    qc.setQueryData<UpscaleJob[]>(upscaleJobKeys.byQuote(job.quoteId), (list) => (list ? upsert(list, job) : list));
  }
  // Only patch the "mine" list once it is loaded (it is capped; do not invent it).
  qc.setQueryData<UpscaleJob[]>(upscaleJobKeys.mine(), (list) =>
    list ? upsert(list, job).slice(0, RECENT_LIMIT) : list,
  );
  qc.setQueryData<UpscaleJob>(upscaleJobKeys.detail(job.id), job);
}

export function useUpscaleJobs(quoteId: string | null | undefined, enabled = true) {
  return useQuery<UpscaleJob[]>({
    queryKey: upscaleJobKeys.byQuote(quoteId ?? ""),
    queryFn: () => imageUpscaleApi.listJobs(quoteId as string),
    enabled: !!quoteId && enabled,
    refetchInterval: (query) => (query.state.data?.some(isJobActive) ? ACTIVE_POLL_MS : false),
  });
}

export function useMyUpscaleJobs() {
  return useQuery<UpscaleJob[]>({
    queryKey: upscaleJobKeys.mine(),
    queryFn: () => imageUpscaleApi.listMine(),
    refetchInterval: (query) => (query.state.data?.some(isJobActive) ? ACTIVE_POLL_MS : false),
  });
}

export function useUpscaleJob(jobId: string | null | undefined) {
  return useQuery<UpscaleJob>({
    queryKey: upscaleJobKeys.detail(jobId ?? ""),
    queryFn: () => imageUpscaleApi.getJob(jobId as string),
    enabled: !!jobId,
    refetchInterval: (query) => (query.state.data && isJobActive(query.state.data) ? ACTIVE_POLL_MS : false),
  });
}

/**
 * Queues a job. For a quote image an optimistic `queued` placeholder is put in
 * the quote's list so the tile flips to "Upscaling…" instantly; the real job
 * (or the existing duplicate the server returns) replaces it.
 */
export function useCreateUpscaleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateUpscaleJobParams) => imageUpscaleApi.createJob(params),
    onMutate: async (params) => {
      if (!params.quoteId || !("imageUrl" in params)) return undefined;
      // An in-flight list fetch would overwrite the placeholder when it lands.
      await qc.cancelQueries({ queryKey: upscaleJobKeys.byQuote(params.quoteId) });
      const placeholder: UpscaleJob = {
        id: `${TEMP_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`,
        quoteId: params.quoteId,
        sourceKind: "quote_image",
        originalUrl: params.imageUrl,
        resultUrl: null,
        status: "queued",
        error: null,
        scale: null,
        sourceWidth: null,
        sourceHeight: null,
        resultWidth: null,
        resultHeight: null,
        replacedOnQuote: false,
        revertedAt: null,
        createdAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
      };
      qc.setQueryData<UpscaleJob[]>(upscaleJobKeys.byQuote(params.quoteId), (list) => upsert(list, placeholder));
      return { placeholder };
    },
    onSuccess: (job) => upsertUpscaleJob(qc, job),
    onSettled: (_job, _err, params) => {
      if (params.quoteId) qc.invalidateQueries({ queryKey: upscaleJobKeys.byQuote(params.quoteId) });
    },
    onError: (_err, _params, context) => {
      const placeholder = context?.placeholder;
      if (!placeholder?.quoteId) return;
      qc.setQueryData<UpscaleJob[]>(upscaleJobKeys.byQuote(placeholder.quoteId), (list) =>
        (list ?? []).filter((j) => j.id !== placeholder.id),
      );
    },
  });
}

export function useRevertUpscaleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (jobId: string) => imageUpscaleApi.revertJob(jobId),
    onSuccess: ({ job }) => {
      upsertUpscaleJob(qc, job);
      qc.invalidateQueries({ queryKey: quoteKeys.all });
    },
  });
}
