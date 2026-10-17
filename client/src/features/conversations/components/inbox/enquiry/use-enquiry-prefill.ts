import { useMemo } from "react";
import {
  useAirportsByCountries,
  useAllDestinations,
  useBoardBasis,
  useCountries,
  usePackageTypes,
} from "@/hooks/queries";
import type { EnquiryIntent } from "../../../api/ai-enquiry.api";
import { leadSourceForChannel } from "./lib/enquiry-form";
import { resolveIntent, type ResolvedIntent } from "./lib/resolve-intent";
import { findUkCountry } from "./lib/uk-airports";

/** Loads the lookups the drawer needs and resolves the AI intent onto the form once they are in. */
export function useEnquiryPrefill(intent: EnquiryIntent | null, channel: string): {
  ready: boolean;
  /** A lookup failed to load; `retry` refetches them all. */
  isError: boolean;
  retry(): void;
  resolved: ResolvedIntent | null;
} {
  const packageTypesQ = usePackageTypes();
  const countriesQ = useCountries();
  const destinationsQ = useAllDestinations();
  const boardBasisQ = useBoardBasis();
  const { data: packageTypes } = packageTypesQ;
  const { data: countries } = countriesQ;
  const { data: destinations } = destinationsQ;
  const { data: boardBasis } = boardBasisQ;
  const ukCountry = useMemo(() => findUkCountry(countries), [countries]);
  const airportsQ = useAirportsByCountries(ukCountry ? [ukCountry.id] : []);
  const { data: airports, isLoading: airportsLoading } = airportsQ;

  // Without a UK row the airports query never runs; do not wait for it forever.
  const ready = !!packageTypes && !!countries && !!destinations && !!boardBasis && (!ukCountry || !airportsLoading);

  // Resolve once when everything has loaded; later refetches must not wipe edits.
  const resolved = useMemo(
    () =>
      ready
        ? resolveIntent(
            intent,
            {
              packageTypes: packageTypes ?? [],
              countries: countries ?? [],
              destinations: destinations ?? [],
              boardBasis: boardBasis ?? [],
              airports: airports ?? [],
            },
            { leadSource: leadSourceForChannel(channel) },
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready],
  );
  const isError = !ready && [packageTypesQ, countriesQ, destinationsQ, boardBasisQ, airportsQ].some((q) => q.isError);
  const retry = () => {
    for (const q of [packageTypesQ, countriesQ, destinationsQ, boardBasisQ, airportsQ]) if (q.isError) void q.refetch();
  };
  return { ready, isError, retry, resolved };
}
