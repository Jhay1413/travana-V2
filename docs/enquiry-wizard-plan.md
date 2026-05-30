# Enquiry Wizard — Implementation Plan (#12)

This plan covers the four sub-items the user requested on the enquiry wizard:

- **A** Multi-select country / destination / resort
- **B** Resort search works without picking country/destination first; selecting a resort auto-populates destination + country (mirror the Quote/Booking form)
- **C** Departure airports filtered by the selected countries
- **D** Board basis: scrollable + searchable filter (client-side only)

The wizard file:
- [client/src/components/enquiry-wizard.tsx](../client/src/components/enquiry-wizard.tsx)

Reference (pattern to mirror for B):
- [client/src/components/quote/sections/QuoteDestinationAccomSection.tsx:24-180](../client/src/components/quote/sections/QuoteDestinationAccomSection.tsx)
- Uses `useResortSearch(search, destinationId, countryId)` with country as a fallback when no destination is set
- On resort select, calls `setValue("destination", …)` and `setValue("country", …)` from `selectedResort.destination_id` / `country_id`

## Good news — the schema already supports it

The enquiry already persists multi-select arrays via dedicated join tables:

- [`enquiry_destination`](../shared/schema.ts) (`enquiry_id`, `destination_id`)
- [`enquiry_resorts`](../shared/schema.ts) (`enquiry_id`, `resorts_id`)
- [`enquiry_board_basis`](../shared/schema.ts) (`enquiry_id`, `board_basis_id`)
- [`enquiry_departure_airport`](../shared/schema.ts) (`enquiry_id`, `airport_id`)

The wizard's `handleSubmit` already sends arrays today:
- `destinations: form.destination ? [form.destination] : undefined` ([enquiry-wizard.tsx:310](../client/src/components/enquiry-wizard.tsx#L310))
- Same shape for `resorts`, `boardBases`, `departureAirports`

The backend service already iterates these arrays and writes them ([enquiry.service.ts:75-95](../server/v2/modules/enquiry/enquiry.service.ts#L75)).

**So multi-select is a frontend-only change.** Form state moves from `string` → `string[]`; submit payload stops wrapping with `[singleValue]` and just passes the array.

---

## Item A — Multi-select country / destination / resort

### What changes
1. `EnquiryForm` interface ([enquiry-wizard.tsx:58-91](../client/src/components/enquiry-wizard.tsx#L58)):
   - `country: string` → `countries: string[]`
   - `destination: string` → `destinations: string[]`
   - `resort: string` → `resorts: string[]`
   - Drop `destinationLabel` (we'll keep labels in a separate `Record<id,label>` cache used only for chips)
2. `defaultForm` updated to empty arrays.
3. `formFromEnquiry` (existing helper near line 95–190) updated to map the loaded enquiry's joins into arrays.
4. `handleSubmit` updates ([enquiry-wizard.tsx:281, 296, 310-313](../client/src/components/enquiry-wizard.tsx)):
   - `destinations: form.destinations.length ? form.destinations : undefined`
   - Same for `resorts`, `boardBases`, `departureAirports`
5. Replace the three `SearchableSelect`s in the Country / Destination / Resort row ([lines 507-549](../client/src/components/enquiry-wizard.tsx#L507)) with multi-select equivalents.

### New component: `MultiSearchableSelect`
The project currently has no multi-select primitive (verified — only `SearchableSelect`, which is single-select).

Add: [client/src/components/ui/multi-searchable-select.tsx](../client/src/components/ui/multi-searchable-select.tsx)

Implementation sketch:
- Same shell as `SearchableSelect` (cmdk + popover).
- Value: `string[]`. `onValueChange(string[])`.
- Each row toggles inclusion. Checked rows show a check icon.
- Trigger renders a row of small chips (`Badge`) with an `X` to remove individual selections, plus a count if there are more than 3.
- Re-uses the existing `onSearch`, `isLoading`, `onAddNew`, `selectedLabels` (a `Record<value,label>` so chips can render labels for async-fetched options).

Estimated size: ~120 lines. Single self-contained file. Reusable beyond the enquiry wizard.

### UI changes in the wizard
- Country picker: replace `SearchableSelect` with `MultiSearchableSelect`. When countries change, prune `destinations` / `resorts` that no longer match.
- Destination picker: same. Options come from `useAllDestinations` if `countries.length > 1`, else `useDestinations(countries[0])`. Prune `resorts` on change.
- Resort picker: same (see Item B for its data source).

### Pruning logic (keep state consistent)
When the user removes a country, drop destinations/resorts that belong to removed countries. Same for destinations → resorts. We need to know the `country_id` / `destination_id` of every selected destination/resort, which means caching the metadata. Easy because we already get it back when the user picks.

---

## Item B — Resort search without country/destination + auto-populate

This is the same pattern the Quote/Booking form uses today.

### Hook to use
Replace [`useResorts(form.destination)`](../client/src/components/enquiry-wizard.tsx#L218) with:
```ts
useResortSearch(resortSearch, primaryDestination, !primaryDestination ? primaryCountry : undefined)
```
where `primaryDestination = form.destinations[0]` and `primaryCountry = form.countries[0]` (single-pivot mirrors the quote form). When the user has multiple destinations/countries, fall back to the first; the search input still narrows correctly.

If we want to be fancier, we can pass all selected countries (`useResortSearch` would need a `countryIds?: string[]` overload). Recommended for first cut: keep single-pivot, ship faster. Note as follow-up.

### Auto-populate on resort select
When a resort is added, lookup `selectedResort.destination_id` and `selectedResort.country_id` from the search results. If the destination/country isn't already in `form.destinations` / `form.countries`, push it in.

Pseudocode:
```ts
onAdd: (resortId) => {
  const r = resortsData.find(x => x.id === resortId);
  setForm(prev => {
    const next = { ...prev, resorts: [...prev.resorts, resortId] };
    if (r?.destination_id && !prev.destinations.includes(r.destination_id)) {
      next.destinations = [...prev.destinations, r.destination_id];
    }
    if (r?.country_id && !prev.countries.includes(r.country_id)) {
      next.countries = [...prev.countries, r.country_id];
    }
    return next;
  });
}
```

The `LookupResort` type already returns `destination_id`, `destination_name`, `country_id` — verified from the Quote form's usage ([QuoteDestinationAccomSection.tsx:154-160](../client/src/components/quote/sections/QuoteDestinationAccomSection.tsx#L154)).

---

## Item C — Departure airports filtered by selected countries

### Current state
- UI uses a plain `Select` of UK-only airports from a hardcoded list in [client/src/lib/uk-airports.ts:13-30](../client/src/lib/uk-airports.ts#L13).
- Backend `/api/v2/lookup/airports` (via [airport.repository.ts:7](../server/v2/modules/airport/airport.repository.ts#L7)) returns ALL airports, no country filter.
- The `airport` table **does** have a `country_id` FK ([schema.ts:421](../shared/schema.ts#L421)), so filtering server-side is straightforward.

### Backend changes
[server/v2/modules/airport/airport.repository.ts](../server/v2/modules/airport/airport.repository.ts):
```ts
async findAll(opts?: { countryIds?: string[] }) {
  const where = opts?.countryIds?.length
    ? inArray(airport.country_id, opts.countryIds)
    : undefined;
  let q = db.select().from(airport);
  if (where) q = q.where(where);
  return q.orderBy(airport.airport_name);
}
```

[server/v2/modules/airport/airport.service.ts](../server/v2/modules/airport/airport.service.ts) — pass through.

[server/v2/modules/airport/airport.controller.ts](../server/v2/modules/airport/airport.controller.ts) — parse `?countryIds=a,b,c` into array.

### Frontend changes
- New API method: `lookupApi.getAirports(countryIds?: string[])`.
- New hook: `useAirportsByCountries(countryIds: string[])`.
- In the wizard, replace `useAirports()` with the new hook, passing `form.countries`.
- Replace the single `Select` with `MultiSearchableSelect` so the user can pick several (form state `departureAirport: string` → `departureAirports: string[]`).
- When `form.countries` is empty, fall back to showing the existing UK list (UX: don't show "Select country first" empty state — the user expects UK by default).
- Drop or deprecate `getDepartureAirportOptions` from `lib/uk-airports.ts` when countries are picked (still used as the default-UK fallback).

---

## Item D — Board basis: searchable + scrollable, client-side

### Current state
- Plain `Select` of all board-basis options ([enquiry-wizard.tsx:1019-1029](../client/src/components/enquiry-wizard.tsx#L1019)).
- Lookup count is small (estimated 15–30), so client-side filter is enough.

### Change
- Replace with `MultiSearchableSelect` (uses cmdk, gets scroll + search free).
- State: `boardBasis: string` → `boardBases: string[]`.
- Submit: already an array on the wire.

No backend change.

---

## Touched files (full list)

### Backend
- [server/v2/modules/airport/airport.repository.ts](../server/v2/modules/airport/airport.repository.ts) — accept `countryIds`
- [server/v2/modules/airport/airport.service.ts](../server/v2/modules/airport/airport.service.ts) — pass `countryIds` through
- [server/v2/modules/airport/airport.controller.ts](../server/v2/modules/airport/airport.controller.ts) — parse `?countryIds=`

### Frontend
- **NEW** [client/src/components/ui/multi-searchable-select.tsx](../client/src/components/ui/multi-searchable-select.tsx)
- [client/src/api/endpoints/lookup.api.ts](../client/src/api/endpoints/lookup.api.ts) — add `countryIds` arg to `getAirports`
- [client/src/hooks/queries/use-lookup-queries.ts](../client/src/hooks/queries/use-lookup-queries.ts) — add `useAirportsByCountries`
- [client/src/components/enquiry-wizard.tsx](../client/src/components/enquiry-wizard.tsx) — main rewrite of Country / Destination / Resort / Departure Airport / Board Basis fields; form-state migration to arrays

### Untouched (already correct)
- Enquiry schema — has all the join tables we need
- Enquiry service / repository — already handles array writes
- Submit shape — already sends arrays

---

## Suggested execution order

1. **Backend airport filter** (small, low risk; can ship independently of the UI)
2. **`MultiSearchableSelect` component** (foundational, used by all other UI changes)
3. **Wizard form-state migration** to arrays (mechanical refactor; pause to verify save/load round-trip with existing enquiries)
4. **Country / Destination / Resort multi-select** (Items A + B together — they share the resort auto-populate behavior)
5. **Departure airport** (Item C) — depends on backend + MultiSearchableSelect
6. **Board basis** (Item D) — trivial, last

---

## Open questions / decisions to confirm before coding

1. **Resort search pivot**: when multiple countries/destinations are selected, pass only the first to `useResortSearch`, or extend the hook to accept arrays? *Recommendation: ship with first-pivot, mark hook extension as follow-up.*
2. **Auto-populate on resort select**: should it ADD the destination/country to the existing selection (recommended), or REPLACE? Quote/Booking form replaces (because it's single-select). Multi-select implies "add".
3. **Departure airport default**: when no country is selected, show the existing UK-only list, or empty? *Recommendation: UK list (preserves current behavior for the common case).*
4. **Editing an existing enquiry**: `formFromEnquiry` needs to flatten the loaded enquiry's join arrays back into the form arrays. Need to confirm the API response shape includes them. If not, that's an additional repo change.

---

## Estimated effort

- New `MultiSearchableSelect` component: **~1 hr** (single file, follows the existing `SearchableSelect` pattern)
- Backend airport filter: **~20 min** (3 small edits)
- Enquiry wizard rewrite: **~2 hr** (form state + 4 fields + pruning logic + edit-mode round-trip)
- Manual testing: **~30 min**

**Total: ~4 hours focused work.**

---

## Out of scope (explicit)

- Adding `multiple` mode to the existing single-select `SearchableSelect` (separate component avoids regression risk in the many other places it's used).
- Filtering destinations/resorts by *all* selected countries on the backend (single-pivot first; can be added later if users complain).
- Changing the enquiry list/detail UI to show multiple chips instead of single labels — the user only asked about the wizard form.
