import { useState } from "react";
import type { Control } from "react-hook-form";
import { X } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddAirportModal } from "@/features/lookups/components/lookups/add-airport-modal";
import { fmInputClass, fmControlClass } from "@/features/quote/components/fm-classes";
import type { QuoteFormValues, FlightLegValue } from "@/features/quote/types";

/**
 * Airport picker that also lets the user create an airport inline when the one
 * they need isn't in the dropdown (mirrors the "Add Accommodation" flow).
 */
export function AirportSelectField({
  value,
  onValueChange,
  options,
  defaultCountryId,
  className,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string; group?: string }[];
  defaultCountryId?: string;
  className?: string;
}) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addedLabel, setAddedLabel] = useState<string | undefined>(undefined);

  return (
    <>
      <SearchableSelect
        className={className}
        options={options}
        value={value}
        selectedLabel={addedLabel}
        onValueChange={(v) => {
          onValueChange(v);
          setAddedLabel(undefined);
        }}
        onSearchCapture={setSearch}
        onAddNew={search ? () => setShowAdd(true) : undefined}
        addNewLabel="Add Airport"
        placeholder="Select airport..."
      />
      <AddAirportModal
        open={showAdd}
        onOpenChange={setShowAdd}
        initialName={search}
        initialCountryId={defaultCountryId || ""}
        onSuccess={(airport) => {
          onValueChange(airport.id);
          setAddedLabel(
            `${airport.airport_name}${airport.airport_code ? ` (${airport.airport_code})` : ""}`,
          );
          setSearch("");
        }}
      />
    </>
  );
}

export const emptyFlightLeg: FlightLegValue = {
  departAirportId: "",
  departAirport: "",
  arriveAirportId: "",
  arriveAirport: "",
  departDate: "",
  departTime: "",
  arriveDate: "",
  arriveTime: "",
  flightNumber: "",
};

type LegFieldPath = `${"outboundConnectingLegs" | "inboundConnectingLegs"}.${number}.${keyof FlightLegValue}`;

interface ConnectingLegFieldsProps {
  control: Control<QuoteFormValues>;
  direction: "outbound" | "inbound";
  index: number;
  airportOptions: { value: string; label: string }[];
  /** Ordered (Popular / Most used / All) options for the Departing field; falls back to airportOptions. */
  departureAirportOptions?: { value: string; label: string; group?: string }[];
  onRemove: () => void;
}

export function ConnectingLegFields({ control, direction, index, airportOptions, departureAirportOptions, onRemove }: ConnectingLegFieldsProps) {
  const prefix =
    direction === "outbound"
      ? (`outboundConnectingLegs.${index}` as const)
      : (`inboundConnectingLegs.${index}` as const);

  const legField = (key: keyof FlightLegValue) => `${prefix}.${key}` as LegFieldPath;

  return (
    <div className="relative mt-3 rounded-[12px] border border-[#E3E8EF] bg-white p-3">
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-2 top-2 rounded-full p-0.5 text-black/40 hover:bg-black/10 hover:text-black/70"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="mb-2 text-xs font-semibold text-black/50">Connecting Leg {index + 1}</p>
      <div className="grid gap-2 md:grid-cols-2">
        <FormField
          control={control}
          name={legField("departAirportId")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Departing Airport</FormLabel>
              <FormControl>
                <SearchableSelect className={fmControlClass} options={departureAirportOptions ?? airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport..." />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("arriveAirportId")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Arriving Airport</FormLabel>
              <FormControl>
                <SearchableSelect className={fmControlClass} options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport..." />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("departDate")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Depart Date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("departTime")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Depart Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className={fmInputClass} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("arriveDate")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Arrive Date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("arriveTime")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Arrive Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className={fmInputClass} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={legField("flightNumber")}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="mb-1.5 block text-xs font-medium text-[#6B7686]">Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="e.g. BA123" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
