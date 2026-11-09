import { useFormContext, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormLabelTooltip } from "@/components/shared/label-tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarDays } from "lucide-react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { FormSection, Stepper } from "@/components/shared/form-shell";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { fmControlClass, fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import { TRANSFER_TYPES } from "@/features/quote/types/quote-form.types";
import { cn } from "@/lib/utils";
import type { SharedHolidayFormValues } from "@/features/quote/types";

const NUMBER_CLASS = cn(fmInputClass, "px-3");

const PARTY = [
  { name: "passengersAdults", label: "Adults", hint: "18+", min: 1, max: 12 },
  { name: "passengersChildren", label: "Children", hint: "2 to 17", min: 0, max: 8 },
  { name: "passengersInfants", label: "Infants", hint: "under 2", min: 0, max: 4 },
] as const;

/** "Returns 16 Nov 2026 after 7 nights", or "" until a travel date and nights are set. */
function returnsLine(travelDate: string | undefined, nights: unknown): string {
  const n = Number(nights);
  if (!travelDate || !(n >= 1)) return "";
  const start = parseISO(travelDate);
  if (!isValid(start)) return "";
  return `Returns ${format(addDays(start, n), "d MMM yyyy")} after ${n} ${n === 1 ? "night" : "nights"}`;
}

/**
 * "Travel Information" drawer section: date / nights / transfer on the first
 * row, passenger counts and child ages on the second, then the remaining
 * travel fields (meals, seats, cruise stays).
 */
export function QuoteDrawerTravelSection({
  showCruiseStay = false,
  showFlightExtras = true,
}: {
  showCruiseStay?: boolean;
  showFlightExtras?: boolean;
}) {
  const { control } = useFormContext<SharedHolidayFormValues>();
  const passengersChildren = useWatch({ control, name: "passengersChildren" });
  const childCount = Number(passengersChildren) || 0;
  const [travelDate, nightsValue] = useWatch({ control, name: ["travelDate", "nights"] });
  const returnLine = returnsLine(travelDate, nightsValue);

  return (
    <FormSection id={formSectionDomId("travel")} title="Travel information" icon={<CalendarDays size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-travel">
      <div className="fm-grid fm-g3">
        <FormField
          control={control}
          name="travelDate"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Travel date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="nights"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Nights</FormLabel>
              <FormControl>
                <Input type="number" {...field} className={NUMBER_CLASS} min={1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="transferType"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabelTooltip className={fmLabelClass} tip="How guests get between the airport and their accommodation: private or shared transfer, seaplane, speedboat, self-drive, or none.">Transfer</FormLabelTooltip>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={fmControlClass}>
                    <SelectValue placeholder="Select transfer..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {TRANSFER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {PARTY.map(({ name, label, hint, min, max }) => (
          <FormField
            key={name}
            control={control}
            name={name}
            render={({ field }) => {
              const current = Number(field.value) || 0;
              return (
                <FormItem className="space-y-0">
                  <span className={fmLabelClass}>
                    {label} <small className="font-normal text-[#6B7686]">{hint}</small>
                  </span>
                  {/* Never clamp a saved value that is already above the usual limit. */}
                  <Stepper variant="box" label={label} min={min} max={Math.max(max, current)} value={current} onChange={field.onChange} />
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        ))}
      </div>

      {childCount > 0 && (
        <div className="fm-ages mt-4">
          <div style={{ fontSize: 12, fontWeight: 500, color: "#6B7686", marginBottom: 6 }}>Child ages at travel</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Array.from({ length: childCount }, (_, i) => (
              <FormField
                key={i}
                control={control}
                name={`childAges.${i}`}
                render={({ field }) => (
                  <FormItem className="space-y-0">
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      Age {i + 1}
                      <Input
                        type="number"
                        {...field}
                        value={field.value ?? ""}
                        min={0}
                        max={17}
                        className="fm-input"
                        style={{ width: 78, height: 36, padding: "0 8px" }}
                      />
                    </label>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
      )}

      {returnLine && <p className="mt-3 text-[13px] text-[#6B7686]">{returnLine}</p>}

      <div className="fm-grid fm-g3 mt-4">
        {showFlightExtras && (
          <>
          <FormField
            control={control}
            name="flightMeals"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabelTooltip className={fmLabelClass} tip="Whether meals are included on the flights (Yes or No).">Flight meals</FormLabelTooltip>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className={fmControlClass}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="preBookedSeats"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabel className={fmLabelClass}>Pre-booked seats</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="e.g. 2A, 2B" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          </>
        )}
        {showCruiseStay && (
          <>
            <FormField
              control={control}
              name="preCruiseStay"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormLabel className={fmLabelClass}>Pre-cruise stay (nights)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className={fmInputClass} min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="postCruiseStay"
              render={({ field }) => (
                <FormItem className="space-y-0">
                  <FormLabel className={fmLabelClass}>Post-cruise stay (nights)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className={fmInputClass} min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
    </FormSection>
  );
}
