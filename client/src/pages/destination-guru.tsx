import { useState } from "react";
import { ChevronLeft, Sparkles, Search } from "lucide-react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DestinationGuru, DestinationGuruCard, SAMPLE_DATA } from "@/components/destination-guru";

const ALL_DESTINATIONS = Object.keys(SAMPLE_DATA).map((key) => ({
  destination: SAMPLE_DATA[key].destination,
  country: SAMPLE_DATA[key].country,
}));

export default function DestinationGuruPage() {
  const { role } = useRole();
  const [selectedDestination, setSelectedDestination] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const filtered = ALL_DESTINATIONS.filter(
    (d) =>
      d.destination.toLowerCase().includes(filter.toLowerCase()) ||
      d.country.toLowerCase().includes(filter.toLowerCase())
  );

  if (selectedDestination) {
    return (
      <CommandCenterShell role={role} title="Destination Guru" theme="light" onRoleChange={() => {}} filterSlot={<></>}>
        <div className="px-5 pb-8 pt-5" data-testid="page-destination-guru-detail">
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-2xl border-black/10 bg-white/70 mb-4"
            onClick={() => setSelectedDestination(null)}
            data-testid="button-guru-back"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            All Destinations
          </Button>
          <DestinationGuru destination={selectedDestination} />
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title="Destination Guru" theme="light" onRoleChange={() => {}} filterSlot={<></>}>
      <div className="px-5 pb-8 pt-5" data-testid="page-destination-guru">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h1 className="text-xl font-bold" data-testid="text-guru-title">Destination Guru</h1>
            </div>
            <p className="text-sm text-black/50 dark:text-white/50 mt-1">
              AI-powered destination intelligence for your travel agency. Automatically generated when quotes are created.
            </p>
          </div>
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
        </div>

        {filtered.length === 0 ? (
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
                onClick={() => setSelectedDestination(d.destination)}
              />
            ))}
          </div>
        )}

        <div className="mt-8 rounded-2xl border border-dashed border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] p-6 text-center" data-testid="guru-coming-soon">
          <Sparkles className="h-5 w-5 text-amber-500 mx-auto mb-2" />
          <h3 className="font-semibold text-sm mb-1">More Destinations Coming</h3>
          <p className="text-xs text-black/45 dark:text-white/45 max-w-md mx-auto">
            Destination intelligence is automatically generated when you create a new quote. As your team builds quotes for more destinations, this library will grow with AI-curated travel knowledge.
          </p>
        </div>
      </div>
    </CommandCenterShell>
  );
}
