// Pure pieces of the drawer's form state: destination/resort linkage, title
// following, holiday-type changes and source chips. No React.
import type { LookupCountry, LookupDestination, LookupResort } from "@/features/lookups";
import {
  autoTitle,
  flexibilityOptionsFor,
  holidayKind,
  type EnquiryForm,
  type FieldKey,
  type Sources,
} from "./enquiry-form";
import type { ChipKind } from "../source-chip";
import { destinationLabel } from "./resolve-intent";

const IS_EMPTY: Record<FieldKey, (f: EnquiryForm) => boolean> = {
  title: (f) => !f.title.trim(),
  holidayType: (f) => !f.holidayType,
  leadSource: () => false,
  destinations: (f) => f.destinations.length === 0,
  resorts: (f) => f.resorts.length === 0,
  airports: (f) => f.airports.length === 0,
  travelDate: (f) => !f.travelDate,
  flexibility: (f) => !f.flexibility,
  nights: () => false,
  travellers: () => false,
  budget: (f) => !f.budget.trim(),
  budgetType: () => false,
  boardBasis: (f) => f.boardBasis.length === 0,
  starRating: (f) => !f.starRating,
  notes: (f) => !f.notes.trim(),
};

const unique = (ids: (string | undefined)[]): string[] => Array.from(new Set(ids.filter((x): x is string => !!x)));

/** Chip to show for a field: null while empty (unless flagged), "checked" after an edit. */
export function chipForField(
  form: EnquiryForm,
  sources: Sources,
  touched: ReadonlySet<FieldKey>,
  key: FieldKey,
): ChipKind | null {
  const empty = IS_EMPTY[key](form);
  if (empty && sources[key] !== "check") return null;
  if (touched.has(key)) return empty ? null : "checked";
  return sources[key];
}

/** The auto title for a destination label, or no change when the title was edited by hand. */
function followTitle(titleIsAuto: boolean, label: string | undefined): Partial<EnquiryForm> {
  return titleIsAuto ? { title: autoTitle(label) } : {};
}

/** Form patch for a new destination selection; resorts of removed destinations drop out. */
export function destinationsPatch(
  form: EnquiryForm,
  next: string[],
  known: LookupDestination[],
  countries: LookupCountry[],
  titleIsAuto: boolean,
): Partial<EnquiryForm> {
  const labels = { ...form.labels };
  const countryOf = { ...form.countryOf };
  for (const id of next) {
    const d = known.find((x) => x.id === id);
    if (!d) continue;
    labels[id] = destinationLabel(d, countries);
    if (d.country_id) countryOf[id] = d.country_id;
  }
  const resorts = form.resorts.filter((r) => {
    const dest = form.destinationOf[r];
    return !dest || next.includes(dest);
  });
  return {
    destinations: next,
    resorts,
    labels,
    countryOf,
    countries: unique([...next, ...resorts].map((id) => countryOf[id])),
    ...followTitle(titleIsAuto, labels[next[0]]),
  };
}

/** Form patch for a new resort selection; a new resort also adds its destination and country. */
export function resortsPatch(
  form: EnquiryForm,
  next: string[],
  known: LookupResort[],
  countries: LookupCountry[],
  titleIsAuto: boolean,
): Partial<EnquiryForm> {
  const labels = { ...form.labels };
  const countryOf = { ...form.countryOf };
  const destinationOf = { ...form.destinationOf };
  const destinations = [...form.destinations];
  for (const id of next.filter((r) => !form.resorts.includes(r))) {
    const r = known.find((x) => x.id === id);
    if (!r) continue;
    labels[id] = r.name;
    if (r.country_id) countryOf[id] = r.country_id;
    if (r.destination_id) {
      destinationOf[id] = r.destination_id;
      if (!destinations.includes(r.destination_id)) {
        destinations.push(r.destination_id);
        const country = countries.find((c) => c.id === r.country_id)?.country_name;
        if (r.destination_name) labels[r.destination_id] = country ? `${r.destination_name}, ${country}` : r.destination_name;
        if (r.country_id) countryOf[r.destination_id] = r.country_id;
      }
    }
  }
  return {
    resorts: next,
    destinations,
    labels,
    countryOf,
    destinationOf,
    countries: unique([...destinations, ...next].map((id) => countryOf[id])),
    ...(destinations.length !== form.destinations.length ? followTitle(titleIsAuto, labels[destinations[0]]) : {}),
  };
}

/** Form patch for a holiday type change; drops a flexibility the new type does not offer. */
export function holidayTypePatch(form: EnquiryForm, id: string, name: string): Partial<EnquiryForm> {
  const offered = flexibilityOptionsFor(holidayKind(name));
  return {
    holidayType: id,
    holidayTypeName: name,
    ...(form.flexibility && !offered.includes(form.flexibility) ? { flexibility: "" } : {}),
  };
}
