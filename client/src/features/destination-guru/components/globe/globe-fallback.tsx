import { Globe as GlobeIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useGlobeTheme } from "../../hooks/use-globe-theme";

interface GlobeFallbackProps {
  variant: "loading" | "unavailable";
  className?: string;
}

// Shown as the Suspense fallback for the lazy globe chunk, and again while
// the ThreeGlobe instance itself is being built on the main thread.
export function GlobeFallback({ variant, className }: GlobeFallbackProps) {
  const theme = useGlobeTheme();

  return (
    <div
      className={cn("relative flex h-full w-full items-center justify-center rounded-2xl", className)}
      style={{ background: `linear-gradient(180deg, ${theme.stageFrom}, ${theme.stageTo})` }}
      data-testid="globe-fallback"
    >
      {variant === "loading" ? (
        <div className="flex flex-col items-center gap-2 text-white/70">
          <Spinner className="size-6" />
          <span className="text-xs font-medium">Loading globe…</span>
        </div>
      ) : (
        <div className="flex max-w-xs flex-col items-center gap-2 px-4 text-center text-white/70">
          <GlobeIcon className="size-6" />
          <span className="text-xs font-medium">3D globe isn't available on this device</span>
        </div>
      )}
    </div>
  );
}
