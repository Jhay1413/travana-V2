import { useFormContext, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormLabelTooltip } from "@/components/shared/label-tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { CalendarDays } from "lucide-react";
import { FormSection } from "@/components/shared/form-shell";
import { formSectionDomId } from "@/features/quote/lib/quote-section-ids";
import { fmControlClass, fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import { TRANSFER_TYPES } from "@/features/quote/types/quote-form.types";
import { cn } from "@/lib/utils";
import type { SharedHolidayFormValues } from "@/features/quote/types";

const NUMBER_CLASS = cn(fmInputClass, "px-3");

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

  return (
    <FormSection id={formSectionDomId("travel")} title="Travel information" icon={<CalendarDays size={16} color="#D97706" aria-hidden="true" />} data-testid="drawer-section-travel">
      <div className="fm-grid fm-g3">
        <FormField
          control={control}
          name="travelDate"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Travel Date</FormLabel>
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
      </div>

      <div className="fm-grid fm-g4 mt-4">
        <FormField
          control={control}
          name="passengersAdults"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Adults</FormLabel>
              <FormControl>
                <Input type="number" {...field} className={NUMBER_CLASS} min={1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="passengersChildren"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Children</FormLabel>
              <FormControl>
                <Input type="number" {...field} className={NUMBER_CLASS} min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="passengersInfants"
          render={({ field }) => (
            <FormItem className="space-y-0">
              <FormLabel className={fmLabelClass}>Infants</FormLabel>
              <FormControl>
                <Input type="number" {...field} className={NUMBER_CLASS} min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {Array.from({ length: childCount }, (_, i) => (
          <FormField
            key={i}
            control={control}
            name={`childAges.${i}`}
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabel className={fmLabelClass}>Age {i + 1}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className={NUMBER_CLASS} min={0} max={17} />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>

      <div className="fm-grid fm-g3 mt-4">
        {showFlightExtras && (
          <>
          <FormField
            control={control}
            name="flightMeals"
            render={({ field }) => (
              <FormItem className="space-y-0">
                <FormLabelTooltip className={fmLabelClass} tip="Whether meals are included on the flights (Yes or No).">Flight Meals</FormLabelTooltip>
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
                <FormLabel className={fmLabelClass}>Pre-booked Seats</FormLabel>
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
                  <FormLabel className={fmLabelClass}>Pre-Cruise Stay (nights)</FormLabel>
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
                  <FormLabel className={fmLabelClass}>Post-Cruise Stay (nights)</FormLabel>
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
