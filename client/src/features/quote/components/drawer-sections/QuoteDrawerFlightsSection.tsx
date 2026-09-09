import { useFormContext, useFieldArray, useWatch, type Control } from "react-hook-form";
import { Clock, PlaneLanding, PlaneTakeoff, Plus } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
  drawerLabelClass,
  drawerSubheadingClass,
} from "@/components/shared/form-drawer";
import { useAirports } from "@/hooks/queries";
import {
  AirportSelectField,
  ConnectingLegFields,
  emptyFlightLeg,
} from "@/features/quote/components/sections/QuoteFlightsSection";
import { cn } from "@/lib/utils";
import type { QuoteFormValues, SharedHolidayFormValues } from "@/features/quote/types";

type Direction = "outbound" | "inbound";

type AirportRow = { id: string; airport_name: string; airport_code?: string | null };

function shortDate(value: string | undefined): string {
  if (!value) return "";
  const d = parseISO(value);
  return isValid(d) ? format(d, "dd/MM/yy") : value;
}

/** Bar title like "Flights - 09/11/26 : Newcastle 07:15 : 09/11/26 : Dubai 22:24". */
function buildFlightsTitle(
  values: { departDate?: string; departAirportId?: string; departTime?: string; arriveDate?: string; arriveAirportId?: string; arriveTime?: string },
  airportName: (id: string | undefined) => string,
): string {
  const parts = [
    [shortDate(values.departDate), `${airportName(values.departAirportId)} ${values.departTime ?? ""}`.trim()].filter(Boolean).join(" : "),
    [shortDate(values.arriveDate), `${airportName(values.arriveAirportId)} ${values.arriveTime ?? ""}`.trim()].filter(Boolean).join(" : "),
  ].filter(Boolean);
  return parts.length ? `Flights - ${parts.join(" : ")}` : "Flights";
}

function TimeInput({ value, onChange, name, onBlur }: { value: string; onChange: (v: string) => void; name: string; onBlur: () => void }) {
  return (
    <div className="relative">
      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/45" />
      <Input
        type="time"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(drawerInputClass, "pl-9")}
      />
    </div>
  );
}

function FlightLegFields({ direction, airportOptions, countryId }: { direction: Direction; airportOptions: { value: string; label: string }[]; countryId?: string }) {
  const { control } = useFormContext<SharedHolidayFormValues>();
  const Icon = direction === "outbound" ? PlaneTakeoff : PlaneLanding;
  const label = direction === "outbound" ? "Outbound" : "Inbound";
  const f = <K extends string>(key: K) => `${direction}${key}` as const;

  const { fields: legs, append, remove } = useFieldArray({
    control,
    name: direction === "outbound" ? "outboundConnectingLegs" : "inboundConnectingLegs",
  });

  return (
    <div data-testid={`drawer-flight-${direction}`}>
      <div className={drawerSubheadingClass}>
        <Icon className="h-4 w-4 text-black/60" />
        {label}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-x-6 gap-y-4 pl-3">
        <FormField
          control={control}
          name={f("DepartAirportId")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Departing</FormLabel>
              <FormControl>
                <AirportSelectField
                  className={drawerControlClass}
                  options={airportOptions}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  defaultCountryId={countryId}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("DepartDate")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Departure Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} className={drawerControlClass} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("DepartTime")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Departure Time</FormLabel>
              <FormControl>
                <TimeInput name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("ArriveAirportId")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Arriving</FormLabel>
              <FormControl>
                <AirportSelectField
                  className={drawerControlClass}
                  options={airportOptions}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  defaultCountryId={countryId}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("ArriveDate")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Arrival Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} className={drawerControlClass} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("ArriveTime")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Arrival Time</FormLabel>
              <FormControl>
                <TimeInput name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("FlightNumber")}
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Flight Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={drawerInputClass} placeholder="e.g. BA2490" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="pl-3">
        {legs.map((leg, idx) => (
          <ConnectingLegFields
            key={leg.id}
            control={control as unknown as Control<QuoteFormValues>}
            direction={direction}
            index={idx}
            airportOptions={airportOptions}
            onRemove={() => remove(idx)}
          />
        ))}
        {legs.length < 2 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-8 rounded-md border-black/10 bg-[#f4f5f7] text-xs font-normal text-black/70 shadow-none hover:bg-[#eef0f3]"
            onClick={() => append({ ...emptyFlightLeg })}
          >
            <Plus className="mr-1 h-3 w-3" /> Add connecting leg
          </Button>
        )}
      </div>
    </div>
  );
}

/** "Flights" drawer section — outbound and inbound legs with a live summary in the bar. */
export function QuoteDrawerFlightsSection() {
  const { control } = useFormContext<SharedHolidayFormValues>();
  const countryId = useWatch({ control, name: "country" });
  const [departDate, departAirportId, departTime, arriveDate, arriveAirportId, arriveTime] = useWatch({
    control,
    name: [
      "outboundDepartDate",
      "outboundDepartAirportId",
      "outboundDepartTime",
      "outboundArriveDate",
      "outboundArriveAirportId",
      "outboundArriveTime",
    ],
  });
  const { data: airportsData } = useAirports();
  const airports: AirportRow[] = airportsData || [];
  const airportOptions = airports.map((a) => ({
    value: a.id,
    label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
  }));
  const airportName = (id: string | undefined) => airports.find((a) => a.id === id)?.airport_name ?? "";

  const title = buildFlightsTitle(
    { departDate, departAirportId, departTime, arriveDate, arriveAirportId, arriveTime },
    airportName,
  );

  return (
    <FormDrawerSection title={title} data-testid="drawer-section-flights">
      <div className="space-y-6">
        <FlightLegFields direction="outbound" airportOptions={airportOptions} countryId={countryId} />
        <FlightLegFields direction="inbound" airportOptions={airportOptions} countryId={countryId} />
      </div>
    </FormDrawerSection>
  );
}
