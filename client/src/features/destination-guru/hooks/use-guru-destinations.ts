import { useMemo } from "react";
import { useDestinationGuruList } from "@/features/destination-guru/api/use-destination-guru-queries";
import { SAMPLE_DATA } from "@/features/destination-guru/components/destination-guru";
import type { DestinationGuruRecord } from "@/features/destination-guru/api/destination-guru.api";
import type { GuruDestinationItem } from "@/features/destination-guru/types";
import { SAMPLE_COORDINATES } from "@/features/destination-guru/lib/sample-coordinates";

interface UseGuruDestinationsResult {
  items: GuruDestinationItem[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

// Merges DB-backed destinations with the built-in SAMPLE_DATA fixtures (kept
// around so the page still has content before any AI generation has run) and
// maps both into the globe/list-agnostic GuruDestinationItem shape. This
// preserves the merge behaviour the page used before the globe/list rework.
export function useGuruDestinations(): UseGuruDestinationsResult {
  const { data: dbDestinations = [], isLoading, isError, refetch } = useDestinationGuruList();

  const items = useMemo(() => {
    const merged: GuruDestinationItem[] = [];

    dbDestinations.forEach((d: DestinationGuruRecord) => {
      merged.push({
        key: d.id,
        id: d.id,
        destination: d.destination,
        country: d.country,
        data: d.data,
        lat: d.latitude,
        lng: d.longitude,
        fromDb: true,
      });
    });

    Object.keys(SAMPLE_DATA).forEach((key) => {
      if (dbDestinations.some((d) => d.destination.toLowerCase() === key.toLowerCase())) return;
      const coords = SAMPLE_COORDINATES[key];
      merged.push({
        key: `sample:${key}`,
        destination: SAMPLE_DATA[key].destination,
        country: SAMPLE_DATA[key].country,
        data: SAMPLE_DATA[key],
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        fromDb: false,
      });
    });

    return merged.sort((a, b) => a.destination.localeCompare(b.destination));
  }, [dbDestinations]);

  return { items, isLoading, isError, refetch };
}
