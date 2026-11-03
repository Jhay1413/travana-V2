import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { quoteKeys } from "@/features/quote/api/use-quote-queries";
import { REALTIME_STREAM_OPEN, subscribeRealtime } from "@/lib/realtime-bus";
import { upscaleJobKeys, upsertUpscaleJob } from "./use-upscale-jobs";
import type { UpscaleJob } from "../types";

interface UpscaleJobEvent {
  type: "upscale.job.updated";
  job: UpscaleJob;
}

function isJobEvent(value: unknown): value is UpscaleJobEvent {
  if (typeof value !== "object" || value === null || !("job" in value)) return false;
  const job = (value as { job: unknown }).job;
  return typeof job === "object" && job !== null && typeof (job as { id?: unknown }).id === "string";
}

/**
 * Applies `upscale.job.updated` pushes from the app's shared SSE stream to the
 * job caches. Mount once, app-wide (AppLayout). It does NOT open its own
 * EventSource — it listens on lib/realtime-bus, which the conversations
 * realtime hook feeds. A (re)connect refetches every job list, since events
 * raised while the stream was down are never replayed.
 */
export function useUpscaleRealtime(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const offJob = subscribeRealtime("upscale.job.updated", (payload) => {
      if (!isJobEvent(payload)) return;
      const { job } = payload;
      upsertUpscaleJob(qc, job);
      // A finished replace (or a revert) changes the images stored on the quote.
      const finishedOnQuote = job.status === "done" && job.replacedOnQuote;
      if (finishedOnQuote || job.revertedAt) qc.invalidateQueries({ queryKey: quoteKeys.all });
    });
    const offOpen = subscribeRealtime(REALTIME_STREAM_OPEN, () => {
      qc.invalidateQueries({ queryKey: upscaleJobKeys.all });
    });
    return () => {
      offJob();
      offOpen();
    };
  }, [qc]);
}
