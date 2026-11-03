import { cn } from "@/lib/utils";
import { barPercent, elapsedPercent, paceStatus } from "../../lib/status";
import { STATUS_DOT } from "./status-pill";

interface ProgressBarProps {
  profit: number;
  target: number;
  /** Share of the year gone (0 to 1); draws the marker and decides the colour. */
  elapsed: number;
  className?: string;
  thin?: boolean;
}

/** Progress to target, coloured by pace, with a dark marker at how much of the year has gone. */
export function ProgressBar({ profit, target, elapsed, className, thin }: ProgressBarProps) {
  const status = paceStatus(profit, target, elapsed);
  const pct = barPercent(profit, target);
  return (
    <div
      className={cn("relative rounded-full bg-social-border", thin ? "h-1.5" : "h-2", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(pct)}% of target`}
    >
      <div className={cn("h-full rounded-full", STATUS_DOT[status])} style={{ width: `${pct}%` }} />
      <span
        title="Share of the year gone"
        className={cn("absolute w-0.5 bg-foreground", thin ? "-top-0.5 h-2.5" : "-top-[3px] h-3.5")}
        style={{ left: `${elapsedPercent(elapsed)}%` }}
      />
    </div>
  );
}
