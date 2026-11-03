import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useCreateUpscaleJob, useMyUpscaleJobs, useUpscaleJob } from "../api/use-upscale-jobs";
import { isJobActive, type UpscaleJob } from "../types";
import { RecentUpscales } from "./recent-upscales";
import { UpscaleCompare, type UpscaleCompareResult } from "./upscale-compare";
import { UpscaleDropzone } from "./upscale-dropzone";

function toCompareResult(job: UpscaleJob): UpscaleCompareResult | null {
  if (!job.resultUrl) return null;
  return {
    url: job.resultUrl,
    width: job.resultWidth,
    height: job.resultHeight,
    scale: job.scale === 2 || job.scale === 3 || job.scale === 4 ? job.scale : undefined,
    sourceWidth: job.sourceWidth,
    sourceHeight: job.sourceHeight,
  };
}

export function ImageUpscaleTool() {
  const { toast } = useToast();
  const createJob = useCreateUpscaleJob();
  const { data: recent } = useMyUpscaleJobs();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  // A finished job picked from "Recent upscales" (overrides the current one).
  const [viewJob, setViewJob] = useState<UpscaleJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastedFailure = useRef<string | null>(null);

  // The job is queued server-side; SSE pushes (app-wide) update this query and
  // it polls every 2.5s while the job is in flight as a fallback.
  const { data: job } = useUpscaleJob(jobId);

  // Own the object URL's lifetime: revoke on change and on unmount.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (job?.status === "failed" && toastedFailure.current !== job.id) {
      toastedFailure.current = job.id;
      toast({ title: "Formatting failed", description: job.error ?? "Formatting failed", variant: "destructive" });
    }
  }, [job, toast]);

  const reset = () => {
    createJob.reset();
    setFile(null);
    setJobId(null);
    setViewJob(null);
    setError(null);
  };

  const handlePick = (picked: File | null, rejection?: string) => {
    setJobId(null);
    setViewJob(null);
    if (!picked) {
      setError(rejection ?? null);
      if (rejection) toast({ title: "Can't use that file", description: rejection, variant: "destructive" });
      return;
    }
    setError(null);
    setFile(picked);
  };

  const handleUpscale = async () => {
    if (!file) return;
    setError(null);
    try {
      const created = await createJob.mutateAsync({ file });
      setJobId(created.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Formatting failed";
      setError(message);
      toast({ title: "Formatting failed", description: message, variant: "destructive" });
    }
  };

  const pending = createJob.isPending || (!!job && isJobActive(job));
  const shown = viewJob ?? (job?.status === "done" ? job : null);
  const shownResult = shown ? toCompareResult(shown) : null;
  // The picked file's local preview is the sharpest "original"; a job reopened
  // from Recent only has the stored source url.
  const shownOriginalUrl = shown && shown.id === jobId && previewUrl ? previewUrl : shown?.originalUrl;
  const shownName = shown && shown.id === jobId && file ? file.name : "image";

  return (
    <div className="space-y-6">
      {shown && shownResult && shownOriginalUrl ? (
        <UpscaleCompare result={shownResult} originalUrl={shownOriginalUrl} originalName={shownName} onReset={reset} />
      ) : (
        <UpscaleDropzone
          file={file}
          previewUrl={previewUrl}
          pending={pending}
          error={error ?? (job?.status === "failed" ? job.error : null)}
          onPick={handlePick}
          onUpscale={handleUpscale}
          onReset={reset}
        />
      )}
      <RecentUpscales jobs={recent ?? []} onCompare={setViewJob} />
    </div>
  );
}
