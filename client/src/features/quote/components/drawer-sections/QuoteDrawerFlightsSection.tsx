import { useFormContext, useFieldArray, useWatch, type Control } from "react-hook-form";
import { Clock, Plane, PlaneLanding, PlaneTakeoff, Plus } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { FormSection } from "@/components/shared/form-shell";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { fmControlClass, fmInputClass, fmLabelClass, fmSubheadingClass, fmSmallButtonClass } from "@/features/quote/components/fm-classes";
import { useAirports, useMostUsedDepartureAirportIds } from "@/hooks/queries";
import { buildDepartureAirportOptions } from "@/features/airport/lib/departure-options";
import {
  AirportSelectField,
  ConnectingLegFields,
  emptyFlightLeg,
} from "@/features/quote/components/sections/quote-flight-leg-fields";
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
      <Clock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7686]" />
      <Input
        type="time"
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={cn(fmInputClass, "pl-9")}
      />
    </div>
  );
}

interface AirportOption {
  value: string;
  label: string;
  group?: string;
}

function FlightLegFields({
  direction,
  airportOptions,
  departureAirportOptions,
  countryId,
}: {
  direction: Direction;
  airportOptions: AirportOption[];
  departureAirportOptions: AirportOption[];
  countryId?: string;
}) {
  const { control } = useFormContext<SharedHolidayFormValues>();
  const Icon = direction === "outbound" ? PlaneTakeoff : PlaneLanding;
  const label = direction === "outbound" ? "Outbound" : "Inbound";
  const f = <K extends string>(key: K) => `${direction}${key}` as const;

  const { fields: legs, append, remove } = useFieldArray({
    control,
    name: direction === "outbound" ? "outboundConnectingLegs" : "inboundConnectingLegs",
  });

  return (
    <div className="fm-leg" data-testid={`drawer-flight-${direction}`}>
      <div className={fmSubheadingClass} style={{ color: direction === "outbound" ? "#1D4ED8" : "#6D28D9" }}>
        <Icon className="h-4 w-4" />
        {label.toUpperCase()}
      </div>
      <div className="fm-grid fm-g4 mt-3">
        <FormField
          control={control}
          name={f("DepartAirportId")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Departing</FormLabel>
              <FormControl>
                <AirportSelectField
                  className={fmControlClass}
                  options={departureAirportOptions}
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
          name={f("ArriveAirportId")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Arriving</FormLabel>
              <FormControl>
                <AirportSelectField
                  className={fmControlClass}
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
          name={f("FlightNumber")}
          render={({ field }) => (
            <FormItem className="fm-span2 space-y-0">
              <FormLabel className={fmLabelClass}>Flight number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="e.g. BA2490" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("DepartDate")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Departure date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("DepartTime")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Departure time</FormLabel>
              <FormControl>
                <TimeInput name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("ArriveDate")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Arrival date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={f("ArriveTime")}
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Arrival time</FormLabel>
              <FormControl>
                <TimeInput name={field.name} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div>
        {legs.map((leg, idx) => (
          <ConnectingLegFields
            key={leg.id}
            control={control as unknown as Control<QuoteFormValues>}
            direction={direction}
            index={idx}
            airportOptions={airportOptions}
            departureAirportOptions={departureAirportOptions}
            onRemove={() => remove(idx)}
          />
        ))}
        {legs.length < 2 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("mt-3", fmSmallButtonClass)}
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
  const { data: mostUsedIds } = useMostUsedDepartureAirportIds();
  const departureAirportOptions = buildDepartureAirportOptions(airportsData || [], mostUsedIds ?? []);
  const airportName = (id: string | undefined) => airports.find((a) => a.id === id)?.airport_name ?? "";

  const { setValue, getValues } = useFormContext<SharedHolidayFormValues>();
  // Inbound departs where outbound lands and vice versa; the inbound date is travel date + nights.
  const fillReturnFromOutbound = () => {
    const opts = { shouldDirty: true, shouldValidate: true };
    const out = getValues();
    if (out.outboundArriveAirportId) setValue("inboundDepartAirportId", out.outboundArriveAirportId, opts);
    if (out.outboundDepartAirportId) setValue("inboundArriveAirportId", out.outboundDepartAirportId, opts);
    const nights = Number(out.nights);
    const start = out.travelDate ? parseISO(out.travelDate) : null;
    if (start && isValid(start) && nights >= 1) setValue("inboundDepartDate", format(addDays(start, nights), "yyyy-MM-dd"), opts);
  };

  const title = buildFlightsTitle(
    { departDate, departAirportId, departTime, arriveDate, arriveAirportId, arriveTime },
    airportName,
  );

  return (
    <FormSection id={formSectionDomId("flights")} title={title} icon={<Plane size={16} color="#D97706" aria-hidden="true" />}
      right={
        <button type="button" className="fm-btn fm-btn--sm" onClick={fillReturnFromOutbound} data-testid="button-fill-return-flight">
          Fill return from outbound
        </button>
      }
      data-testid="drawer-section-flights"
    >
      <div>
        <FlightLegFields direction="outbound" airportOptions={airportOptions} departureAirportOptions={departureAirportOptions} countryId={countryId} />
        <FlightLegFields direction="inbound" airportOptions={airportOptions} departureAirportOptions={departureAirportOptions} countryId={countryId} />
      </div>
    </FormSection>
  );
}
