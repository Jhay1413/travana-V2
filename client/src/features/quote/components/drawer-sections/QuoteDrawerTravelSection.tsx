import { useFormContext, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
  drawerLabelClass,
} from "@/components/shared/form-drawer";
import { TRANSFER_TYPES } from "@/features/quote/types/quote-form.types";
import { cn } from "@/lib/utils";
import type { SharedHolidayFormValues } from "@/features/quote/types";

const NUMBER_CLASS = cn(drawerInputClass, "w-[70px] px-2 text-center");

/**
 * "Travel Information" drawer section: date / nights / transfer on the first
 * row, passenger counts and child ages on the second, then the remaining
 * travel fields (meals, seats, cruise stays).
 */
export function QuoteDrawerTravelSection({ showCruiseStay = false }: { showCruiseStay?: boolean }) {
  const { control } = useFormContext<SharedHolidayFormValues>();
  const passengersChildren = useWatch({ control, name: "passengersChildren" });
  const childCount = Number(passengersChildren) || 0;

  return (
    <FormDrawerSection title="Travel Information" data-testid="drawer-section-travel">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <FormField
          control={control}
          name="travelDate"
          render={({ field }) => (
            <FormItem className="w-[170px] space-y-1.5">
              <FormLabel className={drawerLabelClass}>Travel Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} className={drawerControlClass} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="nights"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Nights</FormLabel>
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
            <FormItem className="w-[190px] space-y-1.5">
              <FormLabel className={drawerLabelClass}>Transfer</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={drawerControlClass}>
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

      <div className="mt-4 flex flex-wrap items-start gap-x-6 gap-y-4">
        <FormField
          control={control}
          name="passengersAdults"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Adults</FormLabel>
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
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Children</FormLabel>
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
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Infants</FormLabel>
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
              <FormItem className="space-y-1.5">
                <FormLabel className={drawerLabelClass}>Age {i + 1}</FormLabel>
                <FormControl>
                  <Input type="number" {...field} className={NUMBER_CLASS} min={0} max={17} />
                </FormControl>
              </FormItem>
            )}
          />
        ))}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-x-6 gap-y-4">
        <FormField
          control={control}
          name="flightMeals"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Flight Meals</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className={drawerControlClass}>
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
            <FormItem className="space-y-1.5">
              <FormLabel className={drawerLabelClass}>Pre-booked Seats</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={drawerInputClass} placeholder="e.g. 2A, 2B" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {showCruiseStay && (
          <>
            <FormField
              control={control}
              name="preCruiseStay"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={drawerLabelClass}>Pre-Cruise Stay (nights)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className={drawerInputClass} min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name="postCruiseStay"
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel className={drawerLabelClass}>Post-Cruise Stay (nights)</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} className={drawerInputClass} min={0} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}
      </div>
    </FormDrawerSection>
  );
}
