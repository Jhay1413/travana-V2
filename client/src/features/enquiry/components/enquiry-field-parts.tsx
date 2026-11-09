import { useState, type ReactNode } from "react";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { Chips, Field } from "@/components/shared/form-shell";
import { DEPARTURE_GROUP_LABELS } from "@shared/departure-airports";
import { AddAirportModal } from "@/features/lookups/components/lookups/add-airport-modal";
import { airportLabel } from "@/features/airport";
import { MAX_NIGHTS } from "../lib/enquiry-form";
import type { FieldKey, FormErrors } from "../lib/enquiry-form";
import type { EnquiryFormApi } from "./use-enquiry-form-state";

export interface ColumnProps {
  api: EnquiryFormApi;
  errors: FormErrors;
  /** Source chip for a field (inbox only); renders nothing elsewhere. */
  chip: (key: FieldKey) => ReactNode;
}

/** £-prefixed numeric input. */
export function MoneyInput({ id, value, onChange, placeholder = "0.00", "data-testid": testId }: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "data-testid"?: string;
}) {
  return (
    <div style={{ position: "relative" }}>
      <span aria-hidden="true" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontWeight: 600, color: "#6B7686" }}>
        £
      </span>
      <input
        className="fm-input"
        id={id}
        type="number"
        min={0}
        step={50}
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingLeft: 26 }}
        data-testid={testId}
      />
    </div>
  );
}

const COMMON_NIGHTS = [3, 4, 5, 7, 10, 14];

/** Night durations: common choices plus anything picked, and an "Other" box for the rest (1 to 21). */
export function NightsChips({ value, onChange, chip }: { value: string[]; onChange: (next: string[]) => void; chip?: ReactNode }) {
  const [other, setOther] = useState("");
  const picked = value.map(Number).filter((n) => !Number.isNaN(n));
  const choices = Array.from(new Set([...COMMON_NIGHTS, ...picked])).sort((a, b) => a - b);

  const addOther = () => {
    const n = Math.round(Number(other));
    setOther("");
    if (!n || n < 1 || n > MAX_NIGHTS || value.includes(String(n))) return;
    onChange([...value, String(n)]);
  };

  return (
    <Field label="Number of nights" hint="(pick any)" chip={chip}>
      <div className="fm-chips">
        <Chips
          multiple
          value={value}
          onChange={onChange}
          options={choices.map((n) => ({ value: String(n), label: String(n) }))}
          data-testid="select-nights"
          aria-label="Number of nights"
        />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#6B7686" }}>
          Other
          <input
            className="fm-input"
            type="number"
            min={1}
            max={MAX_NIGHTS}
            inputMode="numeric"
            value={other}
            aria-label="Other number of nights"
            onChange={(e) => setOther(e.target.value.replace(/[^0-9]/g, ""))}
            onBlur={addOther}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addOther();
              }
            }}
            style={{ width: 72, height: 34 }}
            data-testid="input-nights-other"
          />
        </label>
      </div>
    </Field>
  );
}

/** Flexibility choices as chips; clicking the chosen one again clears it. */
export function FlexibilityChips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <Chips
      value={value}
      onChange={onChange}
      allowClear
      options={options.map((o) => ({ value: o, label: o }))}
      data-testid="select-flexibility"
      aria-label="Flexibility"
    />
  );
}

/** Departure airports: popular and most-used airports as chips, the rest behind a search. */
export function AirportPicker({ api, error, chip }: { api: EnquiryFormApi; error?: string; chip?: ReactNode }) {
  const { form, lookups, setAirports } = api;
  const [showAdd, setShowAdd] = useState(false);
  const quickOptions = lookups.airportOptions.filter((o) => o.group !== DEPARTURE_GROUP_LABELS.all);
  const quickIds = new Set(quickOptions.map((o) => o.value));
  const restOptions = lookups.airportOptions.filter((o) => o.group === DEPARTURE_GROUP_LABELS.all);

  const quickPicked = form.airports.filter((id) => quickIds.has(id));
  const restPicked = form.airports.filter((id) => !quickIds.has(id));

  return (
    <Field label="Departure airports" chip={chip} error={error}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {quickOptions.length > 0 && (
          <Chips
            multiple
            small
            value={quickPicked}
            onChange={(next) => setAirports([...next, ...restPicked])}
            options={quickOptions.map((o) => ({ value: o.value, label: o.label }))}
            data-testid="chips-departure-airport"
            aria-label="Popular departure airports"
          />
        )}
        <MultiSearchableSelect
          variant="fm"
          value={restPicked}
          onValueChange={(next) => setAirports([...quickPicked, ...next])}
          selectedLabels={lookups.labelOf}
          options={restOptions}
          placeholder={quickOptions.length > 0 ? "Other airports..." : "Select airports..."}
          searchPlaceholder="Search airports..."
          emptyMessage="No airports found."
          onSearchCapture={lookups.setAirportSearch}
          onAddNew={lookups.search.airport ? () => setShowAdd(true) : undefined}
          addNewLabel="Add Airport"
          data-testid="input-departure-airport"
        />
      </div>
      <AddAirportModal
        open={showAdd}
        onOpenChange={setShowAdd}
        initialName={lookups.search.airport}
        initialCountryId={lookups.ukCountry?.id}
        onSuccess={(airport) => {
          lookups.rememberAirportLabel(airport.id, airportLabel(airport));
          setAirports([...form.airports, airport.id]);
          lookups.setAirportSearch("");
        }}
      />
    </Field>
  );
}
