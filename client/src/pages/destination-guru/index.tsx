import { useState } from "react";
import { ChevronLeft, Sparkles, Search, Plus, Loader2 } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DestinationGuru, DestinationGuruCard, SAMPLE_DATA } from "@/features/destination-guru/components/destination-guru";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDestinationGuruList } from "@/features/destination-guru/api/use-destination-guru-queries";
import { useGenerateDestinationGuru } from "@/features/destination-guru/api/use-destination-guru-mutations";
import { useToast } from "@/hooks/use-toast";
import type { DestinationGuruRecord } from "@/features/destination-guru/api/destination-guru.api";
import type { DestinationGuruData } from "@/features/destination-guru/components/destination-guru";

export default function DestinationGuruPage() {
  const { role } = useRole();
  const { toast } = useToast();
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<DestinationGuruData | null>(null);
  const [filter, setFilter] = useState("");
  const [showNewSearch, setShowNewSearch] = useState(false);
  const [newDestination, setNewDestination] = useState("");

  const { data: dbDestinations = [], isLoading } = useDestinationGuruList();
  const generateMutation = useGenerateDestinationGuru();

  const allDestinations: Array<{ destination: string; country: string; fromDb: boolean; data?: DestinationGuruData }> = [];

  dbDestinations.forEach((d: DestinationGuruRecord) => {
    allDestinations.push({
      destination: d.destination,
      country: d.country,
      fromDb: true,
      data: d.data as DestinationGuruData,
    });
  });

  Object.keys(SAMPLE_DATA).forEach((key) => {
    if (!allDestinations.some((d) => d.destination.toLowerCase() === key.toLowerCase())) {
      allDestinations.push({
        destination: SAMPLE_DATA[key].destination,
        country: SAMPLE_DATA[key].country,
        fromDb: false,
        data: SAMPLE_DATA[key],
      });
    }
  });

  const filtered = allDestinations.filter(
    (d) =>
      d.destination.toLowerCase().includes(filter.toLowerCase()) ||
      d.country.toLowerCase().includes(filter.toLowerCase())
  );

  const handleNewSearch = async () => {
    if (!newDestination.trim()) return;
    try {
      const result = await generateMutation.mutateAsync(newDestination.trim());
      setShowNewSearch(false);
      setNewDestination("");
      setSelectedDestination(result.destination);
      setSelectedData(result.data as DestinationGuruData);
      toast({ title: `Destination intel generated for ${result.destination}` });
    } catch (error: any) {
      toast({ title: "Failed to generate", description: error?.message || "Please try again", variant: "destructive" });
    }
  };

  if (selectedDestination) {
    return (
      <div className="px-5 pb-8 pt-5" data-testid="page-destination-guru-detail">
        <Button
          size="sm"
          variant="outline"
          className="h-9 rounded-2xl border-black/10 bg-white/70 mb-4"
          onClick={() => { setSelectedDestination(null); setSelectedData(null); }}
          data-testid="button-guru-back"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          All Destinations
        </Button>
        <DestinationGuru destination={selectedDestination} externalData={selectedData || undefined} />
      </div>
    );
  }

  return (
    <>
      <div className="px-5 pb-8 pt-5" data-testid="page-destination-guru">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h1 className="text-xl font-bold" data-testid="text-guru-title">Destination Guru</h1>
            </div>
            <p className="text-sm text-black/50 dark:text-white/50 mt-1">
              AI-powered destination intelligence for your travel agency.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-full md:w-[280px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter destinations…"
                className="h-10 rounded-2xl border-black/10 bg-white/70 dark:bg-white/5 pl-10"
                data-testid="input-guru-filter"
              />
            </div>
            <Button
              size="sm"
              className="h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm whitespace-nowrap"
              onClick={() => setShowNewSearch(true)}
              data-testid="button-new-search"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Search
            </Button>
          </div>
        </div>

        {isLoading ? (
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
            {filtered.map((d) => (
              <DestinationGuruCard
                key={d.destination}
                destination={d.destination}
                country={d.country}
                guruData={d.data}
                onClick={() => {
                  setSelectedDestination(d.destination);
                  setSelectedData(d.data || null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewSearch} onOpenChange={setShowNewSearch}>
        <DialogContent className="sm:max-w-md rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl dark:bg-black/90 dark:border-white/10">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              New Destination Search
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-black/60 dark:text-white/60">
              Enter a destination name and we'll generate AI-powered travel intelligence for your team.
            </p>
            <Input
              value={newDestination}
              onChange={(e) => setNewDestination(e.target.value)}
              placeholder="e.g. Santorini, Bali, Cancun…"
              className="h-11 rounded-2xl border-black/10 bg-white/70 dark:bg-white/5"
              data-testid="input-new-destination"
              onKeyDown={(e) => e.key === "Enter" && !generateMutation.isPending && handleNewSearch()}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-2xl border-black/10"
                onClick={() => { setShowNewSearch(false); setNewDestination(""); }}
                disabled={generateMutation.isPending}
                data-testid="button-cancel-search"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-9 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-white hover:from-amber-600 hover:to-orange-600"
                onClick={handleNewSearch}
                disabled={!newDestination.trim() || generateMutation.isPending}
                data-testid="button-generate-guru"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Intel
                  </>
                )}
              </Button>
            </div>
            {generateMutation.isPending && (
              <p className="text-xs text-center text-black/40 dark:text-white/40 animate-pulse">
                AI is researching this destination. This may take 10-20 seconds…
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
