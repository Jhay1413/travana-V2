import { useEffect, useRef, type ComponentType, type SyntheticEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { POST_IMAGE_SIZE } from "@/features/image-upscale";

const FALLBACK_IMAGE = "/images/default-hotel.jpg";

interface SocialImageTileProps {
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
  onSourceSize: (width: number, height: number) => void;
  /** Formats the server leaves alone (e.g. animated gifs) never get the "Will be formatted" tag. */
  upscaleSkipped?: boolean;
  /** Suffix for the tile's testids, e.g. `url-image-3` or `local-<id>`. */
  testId: string;
  className?: string;
}

/** Image tile with a selection toggle, resolution label and the "Will be formatted" tag. */
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
  onSourceSize,
  upscaleSkipped,
  testId,
  className = "",
}: SocialImageTileProps) {
  const isPostSize = sourceWidth === POST_IMAGE_SIZE && sourceHeight === POST_IMAGE_SIZE;
  const willUpscale = selected && !upscaleSkipped && sourceWidth !== undefined && !isPostSize;

  const imgRef = useRef<HTMLImageElement>(null);
  const reportSize = (img: HTMLImageElement) => {
    // Skip the error fallback: its size is not the image's.
    if (img.src.includes(FALLBACK_IMAGE)) return;
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

  const resolutionLabel = isPostSize
    ? `${POST_IMAGE_SIZE}×${POST_IMAGE_SIZE}`
    : sourceWidth && sourceHeight
    ? `${sourceWidth} × ${sourceHeight}`
    : null;

  return (
    <div
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
          aria-pressed={selected}
          aria-label={`${selected ? "Deselect" : "Select"} ${alt}`}
          className="absolute inset-0 w-full h-full"
          data-testid={toggleTestId}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        draggable={false}
        onLoad={handleLoad}
        onError={(e) => {
          e.currentTarget.src = FALLBACK_IMAGE;
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none" />

      {willUpscale && (
        <span
          className="absolute top-1 left-1 rounded-full bg-amber-500 px-1.5 text-[9px] font-bold leading-4 text-white shadow pointer-events-none"
          data-testid={`badge-will-upscale-${testId}`}
        >
          Will be formatted {POST_IMAGE_SIZE}×{POST_IMAGE_SIZE}
        </span>
      )}
      {selected && (
        <div className="absolute top-1 right-1 pointer-events-none">
          <CheckCircle2 className="w-5 h-5 text-green-400 drop-shadow-lg" />
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between gap-1 px-1.5 py-1 pointer-events-none">
        <div className="flex min-w-0 items-center gap-1">
          <SourceIcon className="w-2.5 h-2.5 text-white/80 shrink-0" />
          <span className="text-[9px] text-white/90 font-medium truncate">{label}</span>
        </div>
        {resolutionLabel && (
          <span
            className={`shrink-0 text-[9px] font-medium tabular-nums ${isPostSize ? "text-emerald-300" : "text-white/80"}`}
            data-testid={`text-resolution-${testId}`}
          >
            {resolutionLabel}
          </span>
        )}
      </div>
    </div>
  );
}
