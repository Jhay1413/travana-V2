import { useMemo, useState } from "react";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import {
  useAirportsByCountries,
  useAllDestinations,
  useCountries,
  useDestinationSearch,
  useResortSearch,
} from "@/hooks/queries";
import { FieldBox } from "./field-box";
import { airportLabel, destinationLabel } from "./lib/resolve-intent";
import { findUkCountry, withPinnedAirportsFirst } from "./lib/uk-airports";
import type { EnquiryFormApi } from "./use-enquiry-form";

interface LocationFieldProps {
  api: EnquiryFormApi;
  error?: string;
}

export function DestinationField({ api, error }: LocationFieldProps) {
  const { form, pickDestinations, chipFor } = api;
  const [search, setSearch] = useState("");
  const { data: all = [] } = useAllDestinations();
  const { data: found = [], isFetching } = useDestinationSearch(search);
  const { data: countries = [] } = useCountries();
  const shown = search ? found : all;
  const options = useMemo(
    () =>
      shown.map((d) => ({
        value: d.id,
        label: destinationLabel(d, countries),
      })),
    [shown, countries],
  );
  return (
    <FieldBox label="Destination" chip={chipFor("destinations")} error={error}>
      {(cls) => (
        <MultiSearchableSelect
          chipClassName="font-normal text-[12px]"
          value={form.destinations}
          onValueChange={(next) =>
            pickDestinations(next, [...found, ...all], countries)
          }
          options={options}
          selectedLabels={form.labels}
          onSearch={setSearch}
          isLoading={!!search && isFetching}
          placeholder="Where to?"
          searchPlaceholder="Search destinations..."
          maxChips={2}
          className={cls}
          data-testid="select-destination"
        />
      )}
    </FieldBox>
  );
}

export function ResortField({ api }: LocationFieldProps) {
  const { form, pickResorts, chipFor } = api;
  const [search, setSearch] = useState("");
  const { data: countries = [] } = useCountries();
  const firstDestination = form.destinations[0];
  const firstCountry = form.countries[0];
  const { data: resorts = [], isFetching } = useResortSearch(
    search,
    search ? undefined : firstDestination,
    search || firstDestination ? undefined : firstCountry,
  );
  const options = resorts.map((r) => ({ value: r.id, label: r.name }));
  return (
    <FieldBox label="Resort" chip={chipFor("resorts")}>
      {(cls) => (
        <MultiSearchableSelect
          chipClassName="font-normal text-[12px]"
          value={form.resorts}
          onValueChange={(next) => pickResorts(next, resorts, countries)}
          options={options}
          selectedLabels={form.labels}
          onSearch={setSearch}
          isLoading={isFetching}
          placeholder="Any resort"
          searchPlaceholder="Search resorts..."
          maxChips={2}
          className={cls}
          data-testid="select-resort"
        />
      )}
    </FieldBox>
  );
}

export function AirportField({ api, error }: LocationFieldProps) {
  const { form, edit, chipFor } = api;
  const { data: countries } = useCountries();
  const ukCountry = useMemo(() => findUkCountry(countries), [countries]);
  const { data: airports = [] } = useAirportsByCountries(
    ukCountry ? [ukCountry.id] : [],
  );
  const options = withPinnedAirportsFirst(airports).map((a) => ({
    value: a.id,
    label: airportLabel(a),
  }));
  const labels: Record<string, string> = { ...form.labels };
  for (const a of airports) labels[a.id] = airportLabel(a);
  return (
    <FieldBox label="Flying from" chip={chipFor("airports")} error={error}>
      {(cls) => (
        <MultiSearchableSelect
          chipClassName="font-normal text-[12px]"
          value={form.airports}
          onValueChange={(next) => edit("airports", { airports: next })}
          options={options}
          selectedLabels={labels}
          placeholder="Choose airport"
          searchPlaceholder="Search airports..."
          maxChips={2}
          className={cls}
          data-testid="select-airport"
        />
      )}
    </FieldBox>
  );
}
