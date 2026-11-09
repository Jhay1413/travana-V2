import { Chips, Field, Seg } from "@/components/shared/form-shell";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  CRUISE_FLEXIBILITY_OPTIONS,
  FLEXIBILITY_OPTIONS,
  HOT_TUB_FLEXIBILITY_OPTIONS,
  type HolidayKind,
} from "../lib/enquiry-form";
import { AirportPicker, FlexibilityChips, NightsChips, type ColumnProps } from "./enquiry-field-parts";
import { EnquiryAddModals } from "./enquiry-add-modals";
import { uniqueOptionsByLabel } from "../lib/unique-options";

const YES_NO = [
  { value: "No", label: "No" },
  { value: "Yes", label: "Yes" },
];

function TravelDate({ api, chip, error }: Pick<ColumnProps, "api" | "chip"> & { error?: string }) {
  const { form, edit } = api;
  return (
    <Field label="Travel date" htmlFor="enq-travelDate" chip={chip("travelDate")} error={error}>
      <DatePicker
        id="enq-travelDate"
        variant="fm"
        value={form.travelDate}
        onChange={(v) => edit("travelDate", { travelDate: v })}
        disablePast
        placeholder="Pick a date"
        data-testid="input-travel-date"
      />
    </Field>
  );
}

function PackageWhere({ api, errors, chip }: ColumnProps) {
  const { form, lookups, edit } = api;
  return (
    <>
      <Field label="Countries">
        <MultiSearchableSelect
          variant="fm"
          value={form.countries}
          onValueChange={api.pickCountries}
          options={lookups.countries.map((c) => ({ value: c.id, label: c.country_name }))}
          placeholder="Select..."
          searchPlaceholder="Search countries..."
          onSearchCapture={lookups.setCountrySearch}
          emptyMessage="No countries found."
          data-testid="select-enquiry-country"
          onAddNew={() => api.modals.open("country")}
          addNewLabel="Add Country"
        />
      </Field>
      <Field label="Destinations" chip={chip("destinations")} error={errors.destinations}>
        <MultiSearchableSelect
          variant="fm"
          value={form.destinations}
          onValueChange={api.pickDestinations}
          selectedLabels={lookups.labelOf}
          options={lookups.destinationOptions}
          onSearchCapture={lookups.setDestSearch}
          placeholder="Select..."
          searchPlaceholder="Search destinations..."
          emptyMessage="No destinations found."
          isLoading={lookups.isDestFetching}
          data-testid="select-enquiry-destination"
          onAddNew={() => api.modals.open("destination")}
          addNewLabel="Add Destination"
        />
      </Field>
      <Field label="Resorts" chip={chip("resorts")}>
        <MultiSearchableSelect
          variant="fm"
          value={form.resorts}
          onValueChange={api.pickResorts}
          selectedLabels={lookups.labelOf}
          options={lookups.resorts.map((r) => ({ value: r.id, label: r.name }))}
          onSearch={lookups.setResortSearch}
          placeholder="Search..."
          searchPlaceholder="Search resorts..."
          emptyMessage="No resorts found."
          isLoading={lookups.isResortFetching}
          data-testid="select-enquiry-resort"
          onAddNew={() => api.modals.open("resort")}
          addNewLabel="Add Resort"
        />
      </Field>
      <Field label="Accommodations">
        <MultiSearchableSelect
          variant="fm"
          value={form.accommodations}
          onValueChange={api.pickAccommodations}
          selectedLabels={lookups.labelOf}
          options={lookups.accommodations.map((a) => ({ value: a.id, label: a.name }))}
          onSearch={lookups.setAccomSearch}
          placeholder="Search..."
          searchPlaceholder="Search accommodations..."
          emptyMessage="No accommodations found."
          isLoading={lookups.isAccomFetching}
          data-testid="select-enquiry-accommodation"
          onAddNew={() => api.modals.open("accommodation")}
          addNewLabel="Add Accommodation"
        />
      </Field>
      <AirportPicker api={api} error={errors.airports} chip={chip("airports")} />
      <TravelDate api={api} chip={chip} error={errors.travelDate} />
      <Field label="Flexibility" chip={chip("flexibility")}>
        <FlexibilityChips options={FLEXIBILITY_OPTIONS} value={form.flexibility} onChange={(v) => edit("flexibility", { flexibility: v })} />
      </Field>
      <NightsChips value={form.flexibleNights} onChange={(v) => edit("nights", { flexibleNights: v })} chip={chip("nights")} />
    </>
  );
}

function HotTubWhere({ api, errors, chip }: ColumnProps) {
  const { form, lookups, edit, patch } = api;
  return (
    <>
      <Field label="Destinations" chip={chip("destinations")} error={errors.destinations}>
        <MultiSearchableSelect
          variant="fm"
          value={form.destinations}
          onValueChange={api.pickDestinations}
          selectedLabels={lookups.labelOf}
          options={lookups.allDestinationOptions}
          placeholder="Search destinations..."
          searchPlaceholder="Search destinations..."
          emptyMessage="No destinations found."
          data-testid="select-enquiry-destination"
        />
      </Field>
      <Field label="Accommodation type">
        <Chips
          value={form.accommodationType}
          onChange={(v) => patch({ accommodationType: v })}
          allowClear
          options={uniqueOptionsByLabel(
            lookups.accommodationTypes.map((t) => ({ value: t.id, label: t.type ?? "" })),
            [form.accommodationType],
          )}
          data-testid="select-accommodation-type"
          aria-label="Accommodation type"
        />
      </Field>
      <TravelDate api={api} chip={chip} error={errors.travelDate} />
      <Field label="Flexible on date">
        <Seg
          options={YES_NO}
          value={form.flexibleOnDate ? "Yes" : "No"}
          onChange={(v) => patch({ flexibleOnDate: v === "Yes" })}
          data-testid="select-flexible-on-date"
          aria-label="Flexible on date"
        />
      </Field>
      {form.flexibleOnDate && (
        <Field label="Flexibility options" chip={chip("flexibility")}>
          <FlexibilityChips options={HOT_TUB_FLEXIBILITY_OPTIONS} value={form.flexibility} onChange={(v) => edit("flexibility", { flexibility: v })} />
        </Field>
      )}
      <NightsChips value={form.flexibleNights} onChange={(v) => edit("nights", { flexibleNights: v })} chip={chip("nights")} />
      <Field label="Weekend lodge">
        <Seg
          options={YES_NO}
          value={form.weekendLodge ? "Yes" : "No"}
          onChange={(v) => patch({ weekendLodge: v === "Yes" })}
          data-testid="select-weekend-lodge"
          aria-label="Weekend lodge"
        />
      </Field>
    </>
  );
}

function CruiseWhere({ api, errors, chip }: ColumnProps) {
  const { form, lookups, edit } = api;
  return (
    <>
      <Field label="Cruise destination" chip={chip("destinations")} error={errors.destinations}>
        <SearchableSelect
          value={form.destinations[0] ?? ""}
          onValueChange={api.pickCruiseDestination}
          selectedLabel={lookups.labelOf[form.destinations[0] ?? ""]}
          options={lookups.allDestinationOptions}
          placeholder="Search destinations..."
          searchPlaceholder="Search destinations..."
          emptyMessage="No destinations found."
          className="fm-select"
          data-testid="select-cruise-destination"
        />
      </Field>
      <AirportPicker api={api} error={errors.airports} chip={chip("airports")} />
      <TravelDate api={api} chip={chip} error={errors.travelDate} />
      <Field label="Flexibility" chip={chip("flexibility")}>
        <FlexibilityChips options={CRUISE_FLEXIBILITY_OPTIONS} value={form.flexibility} onChange={(v) => edit("flexibility", { flexibility: v })} />
      </Field>
      <NightsChips value={form.flexibleNights} onChange={(v) => edit("nights", { flexibleNights: v })} chip={chip("nights")} />
    </>
  );
}

/** Left column, "Where": places, airports and dates for the chosen holiday type. */
export function EnquiryWhereColumn({ kind, ...props }: ColumnProps & { kind: HolidayKind }) {
  return (
    <div className="fm-col">
      <div className="fm-kicker">Where</div>
      {kind === "hottub" ? <HotTubWhere {...props} /> : kind === "cruise" ? <CruiseWhere {...props} /> : <PackageWhere {...props} />}
      {kind === "package" && <EnquiryAddModals api={props.api} />}
    </div>
  );
}
