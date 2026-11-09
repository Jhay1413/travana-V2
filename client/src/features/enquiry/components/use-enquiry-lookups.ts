import { useMemo, useState } from "react";
import {
  useAccommodationSearch,
  useAccommodationTypes,
  useAllDestinations,
  useBoardBasis,
  useCountries,
  useDestinations,
  usePackageTypes,
  useResortSearch,
} from "@/hooks/queries";
import {
  airportLabel,
  buildDepartureAirportOptions,
  useAirportsByCountries,
  useMostUsedDepartureAirportIds,
} from "@/features/airport";
import { orderBoardBasisRows } from "@/features/lookups";
import type { LookupCountry } from "@/features/lookups";
import { destinationLabel } from "../lib/enquiry-form-reducers";
import type { EnquiryForm } from "../lib/enquiry-form";

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

/**
 * The UK country row, found by name or ISO code rather than a hardcoded id (seed/prod data
 * does not use one spelling). Undefined when the lookup data is not seeded yet.
 */
function findUkCountry(countries: LookupCountry[] | undefined): LookupCountry | undefined {
  return (countries ?? []).find((c) => {
    const name = norm(c.country_name);
    const code = norm(c.country_code);
    return name === "united kingdom" || name === "uk" || code === "gb" || code === "uk";
  });
}

/** Lookup lists and search terms the enquiry form's pickers need, scoped by the current selection. */
export function useEnquiryLookups(form: EnquiryForm) {
  const [resortSearch, setResortSearch] = useState("");
  const [destSearch, setDestSearch] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [accomSearch, setAccomSearch] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [addedAirportLabels, setAddedAirportLabels] = useState<Record<string, string>>({});

  const primaryCountry = form.countries[0];
  const primaryDestination = form.destinations[0];
  const primaryResort = form.resorts[0];

  const { data: packageTypes = [] } = usePackageTypes();
  const { data: accommodationTypes = [] } = useAccommodationTypes();
  const { data: countries = [] } = useCountries();
  const { data: boardBasisRows = [] } = useBoardBasis();

  const { data: singleCountryDestinations, isFetching: isSingleCountryDestFetching } = useDestinations(
    form.countries.length === 1 ? primaryCountry : undefined,
  );
  const { data: allDestinations = [], isFetching: isAllDestFetching } = useAllDestinations();
  const scopedToCountry = form.countries.length === 1;
  const destinations = (scopedToCountry ? singleCountryDestinations : allDestinations) ?? [];
  const isDestFetching = scopedToCountry ? isSingleCountryDestFetching : isAllDestFetching;

  // While the user types a search, ignore the selected destination / country so any resort can be found.
  const { data: resorts = [], isFetching: isResortFetching } = useResortSearch(
    resortSearch,
    resortSearch ? undefined : primaryDestination || undefined,
    resortSearch || primaryDestination ? undefined : primaryCountry || undefined,
  );
  // Same scoping as the quote form's accommodation search: the most specific selection wins.
  const { data: accommodations = [], isFetching: isAccomFetching } = useAccommodationSearch(
    accomSearch,
    primaryResort || undefined,
    !primaryResort ? primaryDestination || undefined : undefined,
    !primaryResort && !primaryDestination ? primaryCountry || undefined : undefined,
  );

  // Departure airports are UK-only. If the UK row is missing the query stays disabled and the list is empty.
  const ukCountry = useMemo(() => findUkCountry(countries), [countries]);
  const { data: airports = [] } = useAirportsByCountries(ukCountry ? [ukCountry.id] : []);
  const { data: mostUsedAirportIds = [] } = useMostUsedDepartureAirportIds();
  const airportOptions = useMemo(() => buildDepartureAirportOptions(airports, mostUsedAirportIds), [airports, mostUsedAirportIds]);

  /** Display names for every picked id: the form's own cache plus the airports and anything just added. */
  const labelOf = useMemo(() => {
    const labels: Record<string, string> = {};
    for (const a of airports) labels[a.id] = airportLabel(a);
    return { ...labels, ...addedAirportLabels, ...form.labels };
  }, [airports, addedAirportLabels, form.labels]);

  const destinationOptions = useMemo(
    () => destinations.map((d) => ({ value: d.id, label: destinationLabel(d, countries) })),
    [destinations, countries],
  );
  const allDestinationOptions = useMemo(
    () => allDestinations.map((d) => ({ value: d.id, label: destinationLabel(d, countries) })),
    [allDestinations, countries],
  );
  const boardBasisOptions = useMemo(
    () => orderBoardBasisRows(boardBasisRows).map((b) => ({ value: b.id, label: (b.type || "").trim() })),
    [boardBasisRows],
  );

  return {
    packageTypes,
    accommodationTypes,
    countries,
    destinations,
    allDestinations,
    destinationOptions,
    allDestinationOptions,
    isDestFetching,
    resorts,
    isResortFetching,
    accommodations,
    isAccomFetching,
    boardBasisOptions,
    airportOptions,
    ukCountry,
    labelOf,
    search: {
      country: countrySearch,
      destination: destSearch,
      resort: resortSearch,
      accommodation: accomSearch,
      airport: airportSearch,
    },
    setCountrySearch,
    setDestSearch,
    setResortSearch,
    setAccomSearch,
    setAirportSearch,
    rememberAirportLabel: (id: string, label: string) => setAddedAirportLabels((prev) => ({ ...prev, [id]: label })),
  };
}

export type EnquiryLookups = ReturnType<typeof useEnquiryLookups>;
