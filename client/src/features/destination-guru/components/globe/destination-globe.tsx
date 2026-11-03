import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { cn } from "@/lib/utils";
import { isWebGLAvailable } from "../../lib/webgl";
import { useGlobeTheme } from "../../hooks/use-globe-theme";
import { usePrefersReducedMotion } from "../../hooks/use-prefers-reduced-motion";
import type { GuruDestinationItem } from "../../types";
import { GlobeFallback } from "./globe-fallback";
import { GlobeErrorBoundary } from "./globe-error-boundary";
import { GlobeHoverCard } from "./globe-hover-card";
import { GlobeScene } from "./globe-scene";

const DEFAULT_CAMERA_DISTANCE = 300;

export interface DestinationGlobeProps {
  items: GuruDestinationItem[]; // items with null lat/lng are simply not pinned
  selectedKey: string | null;
  flyTo: { lat: number; lng: number; nonce: number } | null; // new nonce = new flight
  paused?: boolean; // true while the detail drawer is open → no auto-rotate
  onPinClick: (key: string) => void; // "open details"
  onBackgroundClick?: () => void;
  className?: string;
}

// Self-contained, lazy-loadable interactive 3D globe. `export default` is
// added solely because React.lazy() requires a default export — the named
// export above is the one this feature otherwise uses everywhere else.
export function DestinationGlobe({
  items,
  selectedKey,
  flyTo,
  paused = false,
  onPinClick,
  onBackgroundClick,
  className,
}: DestinationGlobeProps) {
  const theme = useGlobeTheme();
  const reducedMotion = usePrefersReducedMotion();

  const [webglAvailable] = useState(() => isWebGLAvailable());
  const [hasFatalError, setHasFatalError] = useState(false);
  const [isGlobeReady, setIsGlobeReady] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);

  const hoverCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  // R3F removes interactivity on unmount WITHOUT dispatching a synthetic
  // pointerout, so a hovered pin that unmounts (e.g. filtered out of
  // `items`) would otherwise leave `hoveredKey` stuck forever — which in
  // turn keeps auto-rotate permanently disabled (globe-scene.tsx gates
  // auto-rotate on `!hoveredKey`). Clear it whenever it no longer
  // corresponds to a real item.
  useEffect(() => {
    if (hoveredKey === null) return;
    const stillExists = items.some((item) => item.key === hoveredKey);
    if (!stillExists) setHoveredKey(null);
  }, [items, hoveredKey]);

  // Same class of bug when the detail drawer opens over the canvas: the
  // sheet covers the globe without the pointer actually leaving it, so no
  // native pointerout fires either. Proactively clear the hover instead of
  // relying on one.
  useEffect(() => {
    if (paused) setHoveredKey(null);
  }, [paused]);

  // Single source of truth for the body cursor, keyed off hoveredKey
  // rather than scattered pointerover/out handlers — guarantees the
  // cursor resets whenever hoveredKey becomes null by ANY path (including
  // the two effects above, where no real pointer event occurs).
  useEffect(() => {
    document.body.style.cursor = hoveredKey ? "pointer" : "auto";
  }, [hoveredKey]);

  useEffect(() => {
    return () => {
      document.body.style.cursor = "auto";
    };
  }, []);

  const hoveredItem = useMemo(
    () => items.find((item) => item.key === hoveredKey) ?? null,
    [items, hoveredKey],
  );

  const handleFatalError = (error: unknown) => {
    console.error("[destination-globe] fatal WebGL error, falling back", error);
    setHasFatalError(true);
  };

  const stageStyle = { background: `linear-gradient(180deg, ${theme.stageFrom}, ${theme.stageTo})` };
  const showUnavailable = !webglAvailable || hasFatalError;

  return (
    <div
      className={cn("relative h-full w-full overflow-hidden rounded-2xl", className)}
      style={stageStyle}
      data-testid="globe-canvas"
    >
      {showUnavailable ? (
        <GlobeFallback variant="unavailable" className="h-full w-full" />
      ) : (
        <>
          {!isGlobeReady && (
            <div className="absolute inset-0 z-20">
              <GlobeFallback variant="loading" className="h-full w-full" />
            </div>
          )}
          <GlobeErrorBoundary onError={handleFatalError}>
            <Canvas
              dpr={[1, 1.75]}
              gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
              camera={{ position: [0, 0, DEFAULT_CAMERA_DISTANCE], fov: 50, near: 0.1, far: 2000 }}
              // Nothing needs to render while the drawer covers the canvas
              // (paused). globe-scene.tsx pumps frames via invalidate()
              // while a fly-to is in progress, so a flight started in the
              // same tick as `paused` flipping true still completes.
              frameloop={paused ? "demand" : "always"}
            >
              <GlobeScene
                items={items}
                selectedKey={selectedKey}
                flyTo={flyTo}
                paused={paused}
                onPinClick={onPinClick}
                onBackgroundClick={onBackgroundClick}
                hoveredKey={hoveredKey}
                onHoverChange={setHoveredKey}
                hoverCardRef={hoverCardRef}
                theme={theme}
                reducedMotion={reducedMotion}
                onReady={() => setIsGlobeReady(true)}
              />
            </Canvas>
          </GlobeErrorBoundary>
          <GlobeHoverCard ref={hoverCardRef} item={hoveredItem} isTouch={isTouch} onViewDetails={onPinClick} />
        </>
      )}
    </div>
  );
}

export default DestinationGlobe;
