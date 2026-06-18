import { useState } from "react";
import { useFormContext, useFieldArray, useWatch, type Control } from "react-hook-form";
import { Plane, Plus, X } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddAirportModal } from "@/features/lookups/components/lookups/add-airport-modal";
import { useAirports } from "@/hooks/queries";
import { getDepartureAirportOptions } from "@/lib/uk-airports";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";
import type { QuoteFormValues, FlightLegValue } from "@/features/quote/types";

/**
 * Airport picker that also lets the user create an airport inline when the one
 * they need isn't in the dropdown (mirrors the "Add Accommodation" flow).
 */
function AirportSelectField({
  value,
  onValueChange,
  options,
  defaultCountryId,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: { value: string; label: string }[];
  defaultCountryId?: string;
}) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [addedLabel, setAddedLabel] = useState<string | undefined>(undefined);

  return (
    <>
      <SearchableSelect
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

const emptyFlightLeg: FlightLegValue = {
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

interface ConnectingLegFieldsProps {
  control: Control<QuoteFormValues>;
  direction: "outbound" | "inbound";
  index: number;
  airportOptions: { value: string; label: string }[];
  onRemove: () => void;
}

function ConnectingLegFields({ control, direction, index, airportOptions, onRemove }: ConnectingLegFieldsProps) {
  const prefix =
    direction === "outbound"
      ? (`outboundConnectingLegs.${index}` as const)
      : (`inboundConnectingLegs.${index}` as const);

  return (
    <div className="relative mt-3 rounded-xl border border-black/10 bg-black/[0.02] p-3">
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
          name={`${prefix}.departAirportId` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
              <FormControl>
                <SearchableSelect options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport..." />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.arriveAirportId` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
              <FormControl>
                <SearchableSelect options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport..." />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.departDate` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.departTime` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.arriveDate` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.arriveTime` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`${prefix}.flightNumber` as any}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA123" />
              </FormControl>
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}

export function QuoteFlightsSection() {
  const { control } = useFormContext<QuoteFormValues>();
  const countryId = useWatch({ control, name: "country" });
  const { data: airportsData } = useAirports();
  const airportOptions = (airportsData || []).map(
    (a: { id: string; airport_name: string; airport_code?: string | null }) => ({
      value: a.id,
      label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
    }),
  );
  const departureAirportOptions = getDepartureAirportOptions(airportsData);

  const { fields: outboundLegs, append: appendOutbound, remove: removeOutbound } = useFieldArray({
    control,
    name: "outboundConnectingLegs",
  });
  const { fields: inboundLegs, append: appendInbound, remove: removeInbound } = useFieldArray({
    control,
    name: "inboundConnectingLegs",
  });

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={Plane} title="Flights" />

      <p className="mb-2 text-xs font-semibold text-black/50 uppercase tracking-wide">Outbound</p>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          control={control}
          name="outboundDepartAirportId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
              <FormControl>
                <SearchableSelect options={departureAirportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundArriveAirportId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
              <FormControl>
                <AirportSelectField options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} defaultCountryId={countryId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundDepartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundDepartTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundArriveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundArriveTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="outboundFlightNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA2490" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {outboundLegs.map((leg, idx) => (
        <ConnectingLegFields
          key={leg.id}
          control={control}
          direction="outbound"
          index={idx}
          airportOptions={airportOptions}
          onRemove={() => removeOutbound(idx)}
        />
      ))}
      {outboundLegs.length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 rounded-xl text-xs"
          onClick={() => appendOutbound({ ...emptyFlightLeg })}
        >
          <Plus className="mr-1 h-3 w-3" /> Add connecting leg
        </Button>
      )}

      <p className="mb-2 mt-4 text-xs font-semibold text-black/50 uppercase tracking-wide">Inbound</p>
      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          control={control}
          name="inboundDepartAirportId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Departing Airport</FormLabel>
              <FormControl>
                <AirportSelectField options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} defaultCountryId={countryId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundArriveAirportId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arriving Airport</FormLabel>
              <FormControl>
                <AirportSelectField options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} defaultCountryId={countryId} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundDepartDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundDepartTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Depart Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundArriveDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundArriveTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Arrive Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="inboundFlightNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. BA2491" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {inboundLegs.map((leg, idx) => (
        <ConnectingLegFields
          key={leg.id}
          control={control}
          direction="inbound"
          index={idx}
          airportOptions={airportOptions}
          onRemove={() => removeInbound(idx)}
        />
      ))}
      {inboundLegs.length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 h-7 rounded-xl text-xs"
          onClick={() => appendInbound({ ...emptyFlightLeg })}
        >
          <Plus className="mr-1 h-3 w-3" /> Add connecting leg
        </Button>
      )}
    </div>
  );
}
