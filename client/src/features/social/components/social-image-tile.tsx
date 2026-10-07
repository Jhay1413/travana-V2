import { useEffect, useRef, useState, type ComponentType, type SyntheticEvent } from "react";
import { AlertCircle, CheckCircle2, Columns2, Sparkles, Undo2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UpscaleCompare } from "@/features/image-upscale";
import type { UpscaledInfo } from "./use-upscale-tiles";

/** Images at or above this width are treated as already 4K. */
export const FOUR_K_WIDTH = 3840;
const FALLBACK_IMAGE = "/images/default-hotel.jpg";

export function isAlready4K(sourceWidth: number | undefined, upscaled: UpscaledInfo | undefined): boolean {
  return !!upscaled || (sourceWidth !== undefined && sourceWidth >= FOUR_K_WIDTH);
}

interface SocialImageTileProps {
  /** Original image URL (what is shown when not upscaled). */
  src: string;
  alt: string;
  label: string;
  SourceIcon: ComponentType<{ className?: string }>;
  selected: boolean;
  /** When omitted the tile is not toggleable (e.g. pending local files). */
  onToggle?: () => void;
  toggleTestId?: string;
  sourceWidth?: number;
  sourceHeight?: number;
  upscaling?: boolean;
  upscaled?: UpscaledInfo;
  /** Message of the latest failed upscale; the tile then offers a retry. */
  upscaleError?: string;
  /** Show the upscale controls (needs a quote and an image file). */
  upscaleEnabled: boolean;
  onSourceSize: (width: number, height: number) => void;
  onUpscale: () => void;
  onRevert: () => void;
  /** Suffix for the upscale testids, e.g. `url-image-3` or `local-<id>`. */
  testId: string;
  className?: string;
}

const PILL =
  "flex h-6 items-center gap-1 rounded-full border border-white/25 bg-black/75 px-2 text-[10px] font-medium text-white shadow backdrop-blur-sm transition-colors hover:bg-black/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60";

/** Image tile with selection toggle, resolution label and the Upscale / Compare / Revert actions. */
export function SocialImageTile({
  src,
  alt,
  label,
  SourceIcon,
  selected,
  onToggle,
  toggleTestId,
  sourceWidth,
  sourceHeight,
  upscaling,
  upscaled,
  upscaleError,
  upscaleEnabled,
  onSourceSize,
  onUpscale,
  onRevert,
  testId,
  className = "",
}: SocialImageTileProps) {
  const [compareOpen, setCompareOpen] = useState(false);
  const [revertOpen, setRevertOpen] = useState(false);
  const already4K = isAlready4K(sourceWidth, upscaled);
  const showActions = selected && upscaleEnabled;
  const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

  const imgRef = useRef<HTMLImageElement>(null);
  const reportSize = (img: HTMLImageElement) => {
    // Only the original's size is wanted; skip the upscaled copy and the error fallback.
    if (upscaled || img.src.includes(FALLBACK_IMAGE)) return;
    if (img.naturalWidth > 0) onSourceSize(img.naturalWidth, img.naturalHeight);
  };
  const handleLoad = (e: SyntheticEvent<HTMLImageElement>) => reportSize(e.currentTarget);
  // A cached image can be complete before React attaches `onLoad`, and the
  // parent may drop a measured size when it rebuilds its list — re-report from
  // the already-loaded element whenever the size is missing.
  useEffect(() => {
    const img = imgRef.current;
    if (!sourceWidth && img?.complete) reportSize(img);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceWidth, src]);

  // Always keep the original size visible; after an upscale append the new size
  // ("1200 × 800 → 3840 × 2560") so the gain is obvious at a glance.
  const originalSize = sourceWidth && sourceHeight ? `${sourceWidth} × ${sourceHeight}` : null;
  const upscaledSize = upscaled?.width && upscaled?.height ? `${upscaled.width} × ${upscaled.height}` : null;
  const resolutionLabel = upscaled
    ? [originalSize, upscaledSize ?? "4K"].filter(Boolean).join(" → ")
    : originalSize;

  return (
    <div
      aria-busy={upscaling || undefined}
      className={`relative group rounded-lg overflow-hidden border-2 transition-all aspect-[4/3] bg-slate-100 dark:bg-slate-800 ${
        selected
          ? "border-green-500 shadow-md shadow-green-500/20 ring-1 ring-green-500/30"
          : "border-black/10 dark:border-white/10 opacity-50 hover:opacity-75"
      } ${className}`}
    >
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={upscaling}
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${alt}`}
          className="absolute inset-0 w-full h-full"
          data-testid={toggleTestId}
        />
      )}
      <img
        ref={imgRef}
        src={upscaled?.url ?? src}
        alt={alt}
        className="w-full h-full object-cover"
        draggable={false}
        onLoad={handleLoad}
        onError={(e) => {
          e.currentTarget.src = FALLBACK_IMAGE;
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {upscaled && (
        <span
          className="absolute top-1 left-1 flex items-center gap-0.5 rounded bg-emerald-600 px-1 text-[9px] font-bold leading-4 text-white shadow pointer-events-none"
          data-testid={`badge-upscaled-${testId}`}
        >
          4K ✓
        </span>
      )}
      {selected && (
        <div className="absolute top-1 right-1 pointer-events-none">
          <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-lg" />
        </div>
      )}

      {showActions && (
        <div className="absolute inset-x-1 bottom-6 flex items-center justify-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {upscaled ? (
            <>
              <button
                type="button"
                disabled={upscaling}
                onClick={(e) => {
                  stop(e);
                  setCompareOpen(true);
                }}
                className={PILL}
                data-testid={`button-compare-upscaled-${testId}`}
              >
                <Columns2 className="h-3 w-3" />
                Compare
              </button>
              <button
                type="button"
                disabled={upscaling}
                onClick={(e) => {
                  stop(e);
                  setRevertOpen(true);
                }}
                className={PILL}
                data-testid={`button-revert-upscaled-${testId}`}
              >
                <Undo2 className="h-3 w-3" />
                Revert
              </button>
            </>
          ) : already4K ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} onClick={stop}>
                  <button
                    type="button"
                    disabled
                    aria-label="Upscale to 4K"
                    className={`${PILL} pointer-events-none`}
                    data-testid={`button-upscale-${testId}`}
                  >
                    <Sparkles className="h-3 w-3" />
                    Upscale
                  </button>
                </span>
              </TooltipTrigger>
              <TooltipContent>Already 4K or larger</TooltipContent>
            </Tooltip>
          ) : upscaleError ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  disabled={upscaling}
                  onClick={(e) => {
                    stop(e);
                    onUpscale();
                  }}
                  aria-label="Upscale failed, retry"
                  className={`${PILL} !border-red-300/60 !bg-red-600/90 hover:!bg-red-600`}
                  data-testid={`button-upscale-retry-${testId}`}
                >
                  <AlertCircle className="h-3 w-3" />
                  Failed — retry
                </button>
              </TooltipTrigger>
              <TooltipContent>{upscaleError}</TooltipContent>
            </Tooltip>
          ) : (
            <button
              type="button"
              disabled={upscaling}
              onClick={(e) => {
                stop(e);
                onUpscale();
              }}
              aria-label="Upscale to 4K"
              className={PILL}
              data-testid={`button-upscale-${testId}`}
            >
              <Sparkles className="h-3 w-3" />
              Upscale
            </button>
          )}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-1.5 py-1 pointer-events-none">
        <div className="flex min-w-0 items-center gap-1">
          <SourceIcon className="w-2.5 h-2.5 text-white/80 shrink-0" />
          <span className="text-[9px] text-white/90 font-medium truncate">{label}</span>
        </div>
        {resolutionLabel && (
          <span
            className={`shrink-0 text-[9px] font-medium tabular-nums ${already4K ? "text-emerald-300" : "text-white/80"}`}
            data-testid={`text-resolution-${testId}`}
          >
            {resolutionLabel}
          </span>
        )}
      </div>

      {upscaling && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/55">
          <Spinner className="w-4 h-4 text-white" />
          <span className="text-[10px] font-medium text-white">Upscaling…</span>
        </div>
      )}

      {upscaled && (
        <>
          <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
            <DialogContent
              className="max-w-5xl max-h-[92vh] overflow-y-auto"
              onPointerDown={stop}
              data-testid={`dialog-compare-upscaled-${testId}`}
            >
              <DialogHeader>
                <DialogTitle>Original vs 4K</DialogTitle>
                <DialogDescription>Left is the upscaled copy, right is the original.</DialogDescription>
              </DialogHeader>
              <UpscaleCompare
                result={{
                  url: upscaled.url,
                  width: upscaled.width,
                  height: upscaled.height,
                  sourceWidth: sourceWidth ?? null,
                  sourceHeight: sourceHeight ?? null,
                }}
                originalUrl={upscaled.originalUrl || src}
                originalName={alt}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCompareOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog open={revertOpen} onOpenChange={setRevertOpen}>
            <AlertDialogContent onPointerDown={stop}>
              <AlertDialogHeader>
                <AlertDialogTitle>Revert to original?</AlertDialogTitle>
                <AlertDialogDescription>
                  {upscaled.onQuote
                    ? "This puts the original image back on the quote. The 4K copy is kept and you can upscale again later."
                    : "This goes back to the original file for this post. You can upscale it again later."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onRevert}>Revert</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
