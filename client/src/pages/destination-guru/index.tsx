import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Globe as GlobeIcon, List, Loader2, Plus, RotateCcw, Search, Sparkles } from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DestinationGuruCard } from "@/features/destination-guru/components/destination-guru";
import { useGuruDestinations } from "@/features/destination-guru/hooks/use-guru-destinations";
import { useGlobeViewPreference } from "@/features/destination-guru/hooks/use-globe-view-preference";
import { DestinationGuruSheet } from "@/features/destination-guru/components/destination-guru-sheet";
import { DestinationSearchOverlay } from "@/features/destination-guru/components/destination-search-overlay";
import { NewDestinationDialog } from "@/features/destination-guru/components/new-destination-dialog";
import { GlobeFallback } from "@/features/destination-guru/components/globe/globe-fallback";
import { GlobeErrorBoundary } from "@/features/destination-guru/components/globe/globe-error-boundary";
import { isWebGLAvailable } from "@/features/destination-guru/lib/webgl";
import type { DestinationGuruRecord } from "@/features/destination-guru/api/destination-guru.api";

// Own lazy chunk — the ONLY import of the 3D globe anywhere on this page.
// Must live in its own <Suspense> below (not rely on an app-level one),
// otherwise a top-level Suspense boundary would blank the whole app while
// three.js downloads.
const DestinationGlobe = lazy(() => import("@/features/destination-guru/components/globe/destination-globe"));

const ADMIN_ROLES = ["org_admin", "platform_admin"] as const;

interface FlyTo {
  lat: number;
  lng: number;
  nonce: number;
}

export default function DestinationGuruPage() {
  const { hasAnyRole } = useRoles();
  const { toast } = useToast();
  const isAdmin = hasAnyRole([...ADMIN_ROLES]);

  const { items, isLoading, isError, refetch } = useGuruDestinations();
  const [view, setView] = useGlobeViewPreference();
  const [query, setQuery] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [flyTo, setFlyTo] = useState<FlyTo | null>(null);
  const [newSearchOpen, setNewSearchOpen] = useState(false);
  const [pendingSelectId, setPendingSelectId] = useState<string | null>(null);

  const webglAvailable = useMemo(() => isWebGLAvailable(), []);
  const effectiveView = webglAvailable ? view : "list";

  const selectedItem = useMemo(() => items.find((item) => item.key === selectedKey) ?? null, [items, selectedKey]);

  const select = useCallback(
    (key: string) => {
      setSelectedKey(key);
      const found = items.find((item) => item.key === key);
      if (found && found.lat !== null && found.lng !== null) {
        setFlyTo({ lat: found.lat, lng: found.lng, nonce: Date.now() });
      }
    },
    [items],
  );

  // After generation, the mutation invalidates the list query but the new
  // row won't be in `items` until that refetch resolves — keep the id around
  // and resolve the selection once it shows up.
  useEffect(() => {
    if (!pendingSelectId) return;
    const found = items.find((item) => item.id === pendingSelectId);
    if (found) {
      select(found.key);
      setPendingSelectId(null);
    }
  }, [items, pendingSelectId, select]);

  // Remember the destination name behind the current selection so a stale
  // key (below) can try to follow it to a new key before giving up.
  const lastSelectedDestinationRef = useRef<string | null>(null);
  useEffect(() => {
    if (selectedItem) lastSelectedDestinationRef.current = selectedItem.destination;
  }, [selectedItem]);

  // If the selected item disappears from `items` — deleted elsewhere, or a
  // `sample:<name>` entry replaced by a freshly-generated DB row for the same
  // destination — `selectedItem` above silently becomes null and the sheet
  // closes on its own, but `selectedKey` itself is never cleared, so `paused`
  // stays true and the globe never resumes auto-rotating. Skip this while a
  // generation is still pending resolution above — a pending id not yet in
  // `items` isn't a stale *selected* key.
  useEffect(() => {
    if (selectedKey === null || pendingSelectId !== null) return;
    if (items.some((item) => item.key === selectedKey)) return;

    const previousDestination = lastSelectedDestinationRef.current;
    const replacement = previousDestination
      ? items.find((item) => item.destination.toLowerCase() === previousDestination.toLowerCase())
      : undefined;

    if (replacement) {
      setSelectedKey(replacement.key);
      if (replacement.lat !== null && replacement.lng !== null) {
        setFlyTo({ lat: replacement.lat, lng: replacement.lng, nonce: Date.now() });
      }
    } else {
      setSelectedKey(null);
    }
  }, [items, selectedKey, pendingSelectId]);

  const handleGenerated = (record: DestinationGuruRecord) => {
    setPendingSelectId(record.id);
  };

  const handleGlobeError = useCallback(
    (error: unknown) => {
      console.error("[destination-guru] globe failed, falling back to list", error);
      setView("list");
      toast({ title: "3D globe unavailable", description: "Switched to list view.", variant: "destructive" });
    },
    [setView, toast],
  );

  const handleDeleted = () => {
    setSelectedKey(null);
  };

  const handleCoordinatesSaved = (lat: number, lng: number) => {
    setFlyTo({ lat, lng, nonce: Date.now() });
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.destination.toLowerCase().includes(q) || item.country.toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="relative -m-4 md:-m-6 h-[calc(100vh-3.5rem)] overflow-hidden" data-testid="page-destination-guru">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-end gap-3 p-4">
        <div
          // Same border/opacity/shadow bump as the search overlay panel: the
          // globe can fill most/all of the viewport when zoomed in, so this
          // toggle needs to read against its light land/ocean surface too,
          // not just the dark stage margins.
          className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-black/15 bg-white/95 p-1 shadow-xl backdrop-blur-sm"
          data-testid="toggle-guru-view"
        >
          <Button
            size="sm"
            variant={effectiveView === "globe" ? "default" : "ghost"}
            className="h-8 rounded-xl px-3"
            disabled={!webglAvailable}
            onClick={() => setView("globe")}
            data-testid="button-guru-view-globe"
          >
            <GlobeIcon className="mr-1.5 h-3.5 w-3.5" />
            Globe
          </Button>
          <Button
            size="sm"
            variant={effectiveView === "list" ? "default" : "ghost"}
            className="h-8 rounded-xl px-3"
            onClick={() => setView("list")}
            data-testid="button-guru-view-list"
          >
            <List className="mr-1.5 h-3.5 w-3.5" />
            List
          </Button>
        </div>
        {isAdmin && (
          <Button
            size="sm"
            className="pointer-events-auto h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg whitespace-nowrap"
            onClick={() => setNewSearchOpen(true)}
            data-testid="button-new-search"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Search
          </Button>
        )}
      </div>

      {effectiveView === "globe" ? (
        <div className="relative h-full w-full">
          <Suspense fallback={<GlobeFallback variant="loading" className="h-full w-full" />}>
            <GlobeErrorBoundary onError={handleGlobeError}>
              <DestinationGlobe
                items={isLoading ? [] : items}
                selectedKey={selectedKey}
                flyTo={flyTo}
                paused={!!selectedKey}
                onPinClick={select}
                onBackgroundClick={() => setSelectedKey(null)}
                className="h-full w-full"
              />
            </GlobeErrorBoundary>
          </Suspense>

          <div className="pointer-events-none absolute inset-0 z-10 flex items-start p-4">
            <DestinationSearchOverlay
              items={items}
              query={query}
              onQueryChange={setQuery}
              selectedKey={selectedKey}
              onSelect={select}
              className="pointer-events-auto"
            />
          </div>

          {isLoading && (
            <div
              className="pointer-events-none absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 text-xs text-white"
              data-testid="text-guru-loading"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading destinations…
            </div>
          )}
        </div>
      ) : (
        <div className="h-full overflow-y-auto px-5 pb-8 pt-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <h1 className="text-xl font-bold" data-testid="text-guru-title">
                  Destination Guru
                </h1>
              </div>
              <p className="text-sm text-black/50 dark:text-white/50 mt-1">
                AI-powered destination intelligence for your travel agency.
              </p>
            </div>
            <div className="relative w-full md:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter destinations…"
                className="h-10 rounded-2xl border-black/10 bg-white/70 dark:bg-white/5 pl-10"
                data-testid="input-guru-filter"
              />
            </div>
          </div>

          {!webglAvailable && (
            <p className="mb-4 text-xs text-black/40 dark:text-white/40" data-testid="text-guru-webgl-unavailable">
              3D globe isn't available on this device — showing destinations as a list.
            </p>
          )}

          {isError ? (
            <div className="text-center py-16" data-testid="text-guru-error">
              <p className="text-sm text-black/50 dark:text-white/50 mb-4">
                Something went wrong loading destinations.
              </p>
              <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => refetch()}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="text-center py-16">
              <Loader2 className="h-8 w-8 text-amber-500 mx-auto mb-3 animate-spin" />
              <p className="text-sm text-black/40 dark:text-white/40">Loading destinations…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <Sparkles className="h-8 w-8 text-black/15 dark:text-white/15 mx-auto mb-3" />
              <p className="text-sm text-black/40 dark:text-white/40">No destinations match your filter</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="grid-guru-destinations">
              {filtered.map((item) => (
                <DestinationGuruCard
                  key={item.key}
                  destination={item.destination}
                  country={item.country}
                  guruData={item.data}
                  onClick={() => select(item.key)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <DestinationGuruSheet
        item={selectedItem}
        open={selectedKey !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedKey(null);
        }}
        onDeleted={handleDeleted}
        onCoordinatesSaved={handleCoordinatesSaved}
      />

      <NewDestinationDialog open={newSearchOpen} onOpenChange={setNewSearchOpen} onGenerated={handleGenerated} />
    </div>
  );
}
