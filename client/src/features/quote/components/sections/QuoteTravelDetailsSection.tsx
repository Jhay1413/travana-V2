import { useFormContext, useWatch } from "react-hook-form";
import { Users } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";
import type { QuoteFormValues } from "@/features/quote/types";

export function QuoteTravelDetailsSection() {
  const { control } = useFormContext<QuoteFormValues>();
  const passengersChildren = useWatch({ control, name: "passengersChildren" });

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={Users} title="Travel Details" />
      <div className="grid gap-3 md:grid-cols-3">
        <FormField
          control={control}
          name="travelDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Travel Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="nights"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Nights</FormLabel>
              <FormControl>
                <Input type="number" {...field} className="h-9 rounded-xl border-black/10 bg-white/70" min={1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="transferType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Transfer Type</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                    <SelectValue placeholder="Select transfer..." />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {["Private Transfer", "Shared Transfer", "Seaplane", "Speedboat", "Self-drive", "None"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="passengersAdults"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Adults</FormLabel>
              <FormControl>
                <Input type="number" {...field} className="h-9 rounded-xl border-black/10 bg-white/70" min={1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="passengersChildren"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Children</FormLabel>
              <FormControl>
                <Input type="number" {...field} className="h-9 rounded-xl border-black/10 bg-white/70" min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="passengersInfants"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Infants</FormLabel>
              <FormControl>
                <Input type="number" {...field} className="h-9 rounded-xl border-black/10 bg-white/70" min={0} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="flightMeals"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Flight Meals</FormLabel>
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
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
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Pre-booked Seats</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. 2A, 2B" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {Number(passengersChildren) > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-black/60">Child Ages</p>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: Number(passengersChildren) }, (_, i) => (
              <FormField
                key={i}
                control={control}
                name={`childAges.${i}`}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                        placeholder={`Child ${i + 1}`}
                        min={0}
                        max={17}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
