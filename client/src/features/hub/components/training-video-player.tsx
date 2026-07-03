import { useCallback, useRef } from "react";

interface TrainingVideoPlayerProps {
  url: string;
  /** Saved played-percent (0-100) to resume from on mount. */
  initialProgressPct?: number;
  /** Fired at most every ~5s (or on a ~5% change), with the played percent (0-100). */
  onProgressPct?: (pct: number) => void;
  onEnded?: () => void;
}

const PROGRESS_INTERVAL_MS = 5000;
const MIN_PCT_DELTA = 5;

/**
 * Native HTML5 <video> player for lesson videos, framed the same way the
 * Phase-1 placeholder was (`aspect-video`). We use a plain <video> (not
 * react-player) because react-player v2 relies on ReactDOM.findDOMNode, which
 * was removed in React 19. Direct MP4/S3 URLs play natively with controls and
 * HTTP Range seeking. Progress is debounced so we don't spam the lesson-progress
 * API on every `timeupdate` tick.
 */
export function TrainingVideoPlayer({ url, initialProgressPct, onProgressPct, onEnded }: TrainingVideoPlayerProps) {
  const lastEmitRef = useRef<{ pct: number; at: number }>({ pct: -1, at: 0 });
  const hasSeededRef = useRef(false);

  // Resume from the saved position once metadata (and thus duration) is known.
  // Guarded to run a single time per mount; skipped for ~finished lessons so we
  // don't drop the learner at the very end.
  const handleLoadedMetadata = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (hasSeededRef.current) return;
      hasSeededRef.current = true;
      const el = e.currentTarget;
      const pct = initialProgressPct ?? 0;
      if (pct > 0 && pct < 98 && el.duration && !Number.isNaN(el.duration)) {
        el.currentTime = (pct / 100) * el.duration;
      }
    },
    [initialProgressPct],
  );

  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLVideoElement>) => {
      if (!onProgressPct) return;
      const el = e.currentTarget;
      if (!el.duration || Number.isNaN(el.duration)) return;
      const pct = Math.round((el.currentTime / el.duration) * 100);
      const now = Date.now();
      const { pct: lastPct, at: lastAt } = lastEmitRef.current;
      const enoughTimePassed = now - lastAt >= PROGRESS_INTERVAL_MS;
      const enoughPctChanged = Math.abs(pct - lastPct) >= MIN_PCT_DELTA;
      if (enoughTimePassed || enoughPctChanged) {
        lastEmitRef.current = { pct, at: now };
        onProgressPct(pct);
      }
    },
    [onProgressPct],
  );

  return (
    <div className="aspect-video overflow-hidden rounded-xl bg-slate-900" data-testid="training-video-player">
      {/* key={url} forces a reload when switching between lessons */}
      <video
        key={url}
        src={url}
        controls
        playsInline
        className="h-full w-full"
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onEnded={onEnded}
      />
    </div>
  );
}
