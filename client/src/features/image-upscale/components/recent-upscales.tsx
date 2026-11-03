import { AlertCircle, Columns2, Download, Loader2 } from "lucide-react";
import { isJobActive, type UpscaleJob } from "../types";

interface RecentUpscalesProps {
  jobs: UpscaleJob[];
  onCompare: (job: UpscaleJob) => void;
}

function statusLabel(job: UpscaleJob): string {
  if (job.status === "queued") return "Queued…";
  if (job.status === "processing") return "Formatting…";
  if (job.status === "failed") return job.error ?? "Failed";
  if (job.resultWidth && job.resultHeight) return `${job.resultWidth} × ${job.resultHeight}`;
  return "Done";
}

/** The user's latest formatted images, so a result is not lost when they navigate away mid-job. */
export function RecentUpscales({ jobs, onCompare }: RecentUpscalesProps) {
  if (jobs.length === 0) return null;
  return (
    <section className="space-y-3 rounded-2xl border border-black/10 bg-white/60 p-5" data-testid="section-recent-upscales">
      <h2 className="text-sm font-semibold text-black/80">Recent images</h2>
      <ul className="divide-y divide-black/5">
        {jobs.map((job) => {
          const done = job.status === "done" && !!job.resultUrl;
          return (
            <li key={job.id} className="flex items-center gap-3 py-2" data-testid={`row-recent-upscale-${job.id}`}>
              <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-900">
                {isJobActive(job) ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/70" />
                ) : job.status === "failed" ? (
                  <AlertCircle className="h-4 w-4 text-red-400" />
                ) : (
                  <img src={job.resultUrl ?? job.originalUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`truncate text-xs ${job.status === "failed" ? "text-red-600" : "text-black/60"}`}>
                  {statusLabel(job)}
                </p>
                <p className="text-[11px] text-black/40">{new Date(job.createdAt).toLocaleString()}</p>
              </div>
              {done && job.resultUrl && (
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onCompare(job)}
                    className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/70 transition hover:bg-black/5"
                  >
                    <Columns2 className="h-3.5 w-3.5" /> Compare
                  </button>
                  <a
                    href={job.resultUrl}
                    download
                    className="flex items-center gap-1.5 rounded-xl bg-black/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-black"
                  >
                    <Download className="h-3.5 w-3.5" /> Download
                  </a>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
