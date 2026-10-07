import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  isJobActive,
  useCreateUpscaleJob,
  useRevertUpscaleJob,
  useUpscaleJobs,
  type UpscaleJob,
} from "@/features/image-upscale";
import { useToast } from "@/hooks/use-toast";

export interface UpscaledInfo {
  url: string;
  /** Null when the server could not read the result's size (Compare then hides it). */
  width: number | null;
  height: number | null;
  /** True when the upscaled copy replaced the image on the quote itself. */
  onQuote?: boolean;
  jobId: string;
  /** The image before upscaling — the quote's url is the result once replaced, so the tile cannot know this itself. */
  originalUrl: string;
}

/** Tile fields that come from the server's jobs, never from local state. */
export interface DerivedUpscaleState {
  upscaled?: UpscaledInfo;
  upscaling?: boolean;
  /** Message of the latest failed job (shown on the tile; clicking Upscale retries). */
  upscaleError?: string;
}

interface TileSize {
  /** Natural size of the original image, captured when the tile image loads. */
  sourceWidth?: number;
  sourceHeight?: number;
}

/** Images this wide are already 4K and are skipped by Upscale all. */
const ALREADY_4K_WIDTH = 3840;
const isSmallerThan4K = (tile: TileSize) => !tile.sourceWidth || tile.sourceWidth < ALREADY_4K_WIDTH;

interface UrlTile extends TileSize {
  url: string;
  selected: boolean;
}

interface LocalTile extends TileSize {
  localId: string;
  file: File;
  /** Job created for this pending file (lost with the File if the dialog closes). */
  jobId?: string;
}

export type UpscaleTarget = { kind: "url"; url: string } | { kind: "local"; localId: string };

export function isUpscalableFile(file: File): boolean {
  return file.type.startsWith("image/");
}

const newestFirst = (a: UpscaleJob, b: UpscaleJob) => b.createdAt.localeCompare(a.createdAt);

function toUpscaled(job: UpscaleJob, onQuote: boolean): UpscaledInfo | undefined {
  if (!job.resultUrl) return undefined;
  return {
    url: job.resultUrl,
    width: job.resultWidth,
    height: job.resultHeight,
    onQuote,
    jobId: job.id,
    originalUrl: job.originalUrl,
  };
}

/**
 * Tile state for one quote image, derived from the job list. A job matches a
 * tile by its original url OR its result url: once an upscale replaced the
 * image on the quote, the quote's url IS the result url.
 */
export function deriveUrlTileState(url: string, jobs: UpscaleJob[], ignoredJobIds: ReadonlySet<string>): DerivedUpscaleState {
  const matches = jobs.filter((j) => j.originalUrl === url || j.resultUrl === url).sort(newestFirst);

  if (matches.some((j) => isJobActive(j) && j.originalUrl === url)) return { upscaling: true };

  // A job that failed AFTER the quote was swapped still has its result on the quote, so it stays revertable.
  const hasResult = (j: UpscaleJob) => j.status === "done" || (j.status === "failed" && j.replacedOnQuote);
  const done = matches.find((j) => hasResult(j) && !j.revertedAt && !ignoredJobIds.has(j.id));
  const upscaled = done ? toUpscaled(done, done.replacedOnQuote) : undefined;
  if (upscaled) return { upscaled };

  const latest = matches.find((j) => j.originalUrl === url);
  if (latest?.status === "failed") return { upscaleError: latest.error ?? "Upscaling failed" };
  return {};
}

function deriveLocalTileState(jobId: string | undefined, jobs: UpscaleJob[], ignoredJobIds: ReadonlySet<string>): DerivedUpscaleState {
  const job = jobId ? jobs.find((j) => j.id === jobId) : undefined;
  if (!job) return {};
  if (isJobActive(job)) return { upscaling: true };
  if (job.status === "failed") return { upscaleError: job.error ?? "Upscaling failed" };
  if (job.status === "done" && !job.revertedAt && !ignoredJobIds.has(job.id)) {
    const upscaled = toUpscaled(job, false);
    if (upscaled) return { upscaled };
  }
  return {};
}

interface BatchState {
  total: number;
  jobIds: string[];
  failedToStart: number;
  /** False while the create requests are still going out. */
  started: boolean;
}

interface UseUpscaleTilesArgs<U extends UrlTile, L extends LocalTile> {
  quoteId?: string | null;
  /** Load/poll the quote's jobs only while the dialog is open. */
  open: boolean;
  urlImages: U[];
  setUrlImages: Dispatch<SetStateAction<U[]>>;
  pendingFiles: L[];
  setPendingFiles: Dispatch<SetStateAction<L[]>>;
}

/** Upscale-to-4K state for the quote-image and pending-file tiles, derived from server-side jobs. */
export function useUpscaleTiles<U extends UrlTile, L extends LocalTile>({
  quoteId,
  open,
  urlImages,
  setUrlImages,
  pendingFiles,
  setPendingFiles,
}: UseUpscaleTilesArgs<U, L>) {
  const { toast } = useToast();
  const createJob = useCreateUpscaleJob();
  const revertJob = useRevertUpscaleJob();
  const { data: jobsData } = useUpscaleJobs(quoteId, open);
  const jobs = useMemo(() => jobsData ?? [], [jobsData]);

  // Local-only UI state layered on the jobs: pending uploads still being sent,
  // reverts in flight, and upscales the user reverted without a quote to revert on.
  const [submittingLocalIds, setSubmittingLocalIds] = useState<ReadonlySet<string>>(new Set());
  const [revertingJobIds, setRevertingJobIds] = useState<ReadonlySet<string>>(new Set());
  const [dismissedJobIds, setDismissedJobIds] = useState<ReadonlySet<string>>(new Set());
  const [batch, setBatch] = useState<BatchState | null>(null);

  const urlTiles = useMemo(
    () =>
      urlImages.map((img) => {
        const state = deriveUrlTileState(img.url, jobs, dismissedJobIds);
        const reverting = !!state.upscaled && revertingJobIds.has(state.upscaled.jobId);
        const job = state.upscaled ? jobs.find((j) => j.id === state.upscaled?.jobId) : undefined;
        return {
          ...img,
          ...state,
          upscaling: state.upscaling || reverting || undefined,
          sourceWidth: job?.sourceWidth ?? img.sourceWidth,
          sourceHeight: job?.sourceHeight ?? img.sourceHeight,
        };
      }),
    [urlImages, jobs, dismissedJobIds, revertingJobIds],
  );

  const localTiles = useMemo(
    () =>
      pendingFiles.map((img) => {
        const state = deriveLocalTileState(img.jobId, jobs, dismissedJobIds);
        const job = img.jobId ? jobs.find((j) => j.id === img.jobId) : undefined;
        return {
          ...img,
          ...state,
          upscaling: state.upscaling || submittingLocalIds.has(img.localId) || undefined,
          sourceWidth: job?.sourceWidth ?? img.sourceWidth,
          sourceHeight: job?.sourceHeight ?? img.sourceHeight,
        };
      }),
    [pendingFiles, jobs, dismissedJobIds, submittingLocalIds],
  );

  // A reverted job puts the original url back on the quote. The dialog's image
  // list was loaded earlier (or reverted from another tab), so point any tile
  // still holding that result url back at the original.
  useEffect(() => {
    const reverted = jobs.filter((j) => j.revertedAt && j.resultUrl);
    if (reverted.length === 0) return;
    setUrlImages((prev) => {
      let changed = false;
      const next = prev.map((img) => {
        const job = reverted.find((j) => j.resultUrl === img.url);
        const stillUpscaled = jobs.some((j) => j.status === "done" && !j.revertedAt && j.resultUrl === img.url);
        if (!job || stillUpscaled) return img;
        changed = true;
        return { ...img, url: job.originalUrl };
      });
      return changed ? next : prev;
    });
  }, [jobs, setUrlImages]);

  /** Queue one job; resolves to the job id, or an error message. */
  const startJob = async (target: UpscaleTarget): Promise<{ jobId: string } | { error: string; status?: number }> => {
    if (!quoteId) return { error: "No quote selected" };
    try {
      if (target.kind === "url") {
        const job = await createJob.mutateAsync({ quoteId, imageUrl: target.url });
        return { jobId: job.id };
      }
      const file = pendingFiles.find((p) => p.localId === target.localId)?.file;
      if (!file) return { error: "Image is no longer available" };
      setSubmittingLocalIds((prev) => new Set(prev).add(target.localId));
      try {
        const job = await createJob.mutateAsync({ quoteId, file });
        setPendingFiles((prev) => prev.map((p) => (p.localId === target.localId ? { ...p, jobId: job.id } : p)));
        return { jobId: job.id };
      } finally {
        setSubmittingLocalIds((prev) => {
          const next = new Set(prev);
          next.delete(target.localId);
          return next;
        });
      }
    } catch (err) {
      const status = (err as { status?: unknown }).status;
      return {
        error: err instanceof Error ? err.message : "Upscaling failed",
        status: typeof status === "number" ? status : undefined,
      };
    }
  };

  const upscaleOne = async (target: UpscaleTarget) => {
    const result = await startJob(target);
    if ("error" in result) toast({ title: "Upscale failed", description: result.error, variant: "destructive" });
  };

  /** Quote images were replaced on the quote, so reverting goes through the server; otherwise it is local-only. */
  const revertUrl = async (url: string) => {
    const upscaled = urlTiles.find((img) => img.url === url)?.upscaled;
    if (!upscaled) return;
    if (!upscaled.onQuote) {
      setDismissedJobIds((prev) => new Set(prev).add(upscaled.jobId));
      return;
    }
    setRevertingJobIds((prev) => new Set(prev).add(upscaled.jobId));
    try {
      const { reverted } = await revertJob.mutateAsync(upscaled.jobId);
      if (!reverted) toast({ title: "Nothing to revert on the quote" });
    } catch (err) {
      toast({
        title: "Revert failed",
        description: err instanceof Error ? err.message : "Could not revert the image",
        variant: "destructive",
      });
    } finally {
      setRevertingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(upscaled.jobId);
        return next;
      });
    }
  };
  const revertLocal = (localId: string) => {
    const jobId = pendingFiles.find((p) => p.localId === localId)?.jobId;
    if (jobId) setDismissedJobIds((prev) => new Set(prev).add(jobId));
  };

  const setSourceSize = (target: UpscaleTarget, sourceWidth: number, sourceHeight: number) => {
    const patch = <T extends TileSize>(tile: T): T =>
      tile.sourceWidth === sourceWidth && tile.sourceHeight === sourceHeight ? tile : { ...tile, sourceWidth, sourceHeight };
    if (target.kind === "url") {
      setUrlImages((prev) => prev.map((img) => (img.url === target.url ? patch(img) : img)));
    } else {
      setPendingFiles((prev) => prev.map((img) => (img.localId === target.localId ? patch(img) : img)));
    }
  };

  const eligible = (tile: TileSize & DerivedUpscaleState) => !tile.upscaled && !tile.upscaling && isSmallerThan4K(tile);
  const upscalableTargets: UpscaleTarget[] = [
    ...urlTiles.filter((img) => img.selected && eligible(img)).map((img): UpscaleTarget => ({ kind: "url", url: img.url })),
    ...localTiles
      .filter((img) => isUpscalableFile(img.file) && eligible(img))
      .map((img): UpscaleTarget => ({ kind: "local", localId: img.localId })),
  ];

  /** Queue a job for every eligible tile; the server's worker pool sets the pace. */
  const upscaleAll = async () => {
    const targets = [...upscalableTargets];
    if (targets.length === 0 || batch) return;
    setBatch({ total: targets.length, jobIds: [], failedToStart: 0, started: false });
    // One at a time so the org cap is hit predictably: stop at the first 429.
    const ids: string[] = [];
    const errors: string[] = [];
    let limitReached = false;
    for (const target of targets) {
      const result = await startJob(target);
      if ("jobId" in result) {
        ids.push(result.jobId);
        continue;
      }
      if (result.status === 429) {
        limitReached = true;
        break;
      }
      errors.push(result.error);
    }
    const jobIds = Array.from(new Set(ids));
    setBatch({ total: jobIds.length + errors.length, jobIds, failedToStart: errors.length, started: true });
    if (limitReached) {
      toast({ title: "Limit reached — the rest will be available when current upscales finish" });
    } else if (errors.length > 0) {
      toast({ title: "Some upscales could not be started", description: errors[0], variant: "destructive" });
    }
  };

  // Progress comes from the jobs this session created, not from a client loop.
  // A job missing from the cache counts as finished-unknown, never as queued forever.
  const batchDone = batch
    ? batch.failedToStart + batch.jobIds.filter((id) => {
        const job = jobs.find((j) => j.id === id);
        return !job || !isJobActive(job);
      }).length
    : 0;
  const batchProgress = batch ? { done: batchDone, total: batch.total } : null;
  const batchComplete = !!batch && batch.started && batchDone >= batch.total;

  useEffect(() => {
    if (!batch || !batchComplete) return;
    const finished = batch.jobIds.map((id) => jobs.find((j) => j.id === id));
    const succeeded = finished.filter((j) => j?.status === "done").length;
    const failed = finished.filter((j) => j?.status === "failed");
    if (succeeded + failed.length > 0) {
      toast({
        title:
          failed.length === 0
            ? `Upscaled ${succeeded} image${succeeded === 1 ? "" : "s"} to 4K`
            : `Upscaled ${succeeded}, ${failed.length} failed`,
        description: failed[0]?.error ?? undefined,
        variant: failed.length > 0 && succeeded === 0 ? "destructive" : undefined,
      });
    }
    setBatch(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once when the batch completes
  }, [batchComplete]);

  return {
    urlTiles,
    localTiles,
    upscaleOne,
    upscaleAll,
    revertUrl,
    revertLocal,
    setSourceSize,
    batchProgress,
    upscalableCount: upscalableTargets.length,
  };
}
