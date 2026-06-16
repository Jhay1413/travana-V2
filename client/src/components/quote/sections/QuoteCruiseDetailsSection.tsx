import { useMemo, useCallback } from "react";
import { useFormContext, useWatch, useFieldArray } from "react-hook-form";
import { Anchor, Ship, Plus, Trash2 } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCruiseLines, useShips, useCruiseItineraries } from "@/hooks/queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

export function QuoteCruiseDetailsSection() {
  const { control, setValue, register } = useFormContext<QuoteFormValues>();
  const { fields: itineraryFields, append: appendItineraryDay, remove: removeItineraryDay } = useFieldArray({
    control,
    name: "cruiseItinerary",
  });
  const cruiseLine = useWatch({ control, name: "cruiseLine" });
  const shipName = useWatch({ control, name: "shipName" });
  const { data: cruiseLinesData } = useCruiseLines();
  const selectedCruiseLineId = cruiseLinesData?.find((l) => l.name === cruiseLine)?.id;
  const { data: shipsData } = useShips(selectedCruiseLineId);
  const selectedShipId = shipsData?.find((s) => s.name === shipName)?.id;
  const { data: cruiseItineraries, isFetching: isFetchingCruiseDates } = useCruiseItineraries(selectedShipId);

  const cruiseLineOptions = useMemo(
    () => (cruiseLinesData || []).map((l) => ({ value: l.name ?? l.id, label: l.name ?? l.id })),
    [cruiseLinesData],
  );

  const shipOptions = useMemo(
    () => (shipsData || []).map((s) => ({ value: s.name ?? s.id, label: s.name ?? s.id })),
    [shipsData],
  );

  const handleAddDay = useCallback(() => {
    appendItineraryDay({ day: itineraryFields.length + 1, description: "", subDescription: "" });
  }, [appendItineraryDay, itineraryFields.length]);

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={Anchor} title="Cruise Details" />

      <FormField
        control={control}
        name="cruiseOnly"
        render={({ field }) => (
          <FormItem className="mb-3 flex items-center gap-3">
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="text-xs font-medium text-black/60 !mt-0">Cruise Only (no flights)</FormLabel>
          </FormItem>
        )}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <FormField
          control={control}
          name="cruiseTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Cruise Title</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="cruiseLine"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Cruise Line</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={cruiseLineOptions}
                  value={field.value ?? ""}
                  selectedLabel={field.value || undefined}
                  onValueChange={(name) => {
                    field.onChange(name);
                    setValue("shipName", "");
                    setValue("cruiseDate", "");
                  }}
                  placeholder="Select cruise line..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="shipName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Ship Name</FormLabel>
              <FormControl>
                <SearchableSelect
                  options={shipOptions}
                  value={field.value ?? ""}
                  selectedLabel={field.value || undefined}
                  onValueChange={(name) => {
                    field.onChange(name);
                    setValue("cruiseDate", "");
                  }}
                  placeholder={selectedCruiseLineId ? "Select ship..." : "Select cruise line first"}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="cruiseDate"
          render={({ field }) => {
            const cruiseDatePlaceholder = !selectedCruiseLineId
              ? "Select a cruise line first"
              : !selectedShipId
              ? "Select a ship first"
              : isFetchingCruiseDates
              ? "Loading..."
              : "No voyages available for this ship";
            return (
              <FormItem>
                <FormLabel className="text-xs font-medium text-black/60">Cruise Date</FormLabel>
                <FormControl>
                  {cruiseItineraries?.length || isFetchingCruiseDates ? (
                    // Catalog has voyages for this ship → pick a real sailing.
                    <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!cruiseItineraries?.length && !field.value}>
                      <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                        <SelectValue placeholder={cruiseDatePlaceholder} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Keep an imported value visible even if the itinerary list hasn't loaded it yet. */}
                        {field.value && !(cruiseItineraries || []).some((it) => it.date === field.value) && (
                          <SelectItem value={field.value}>{field.value}</SelectItem>
                        )}
                        {(cruiseItineraries || []).map((it) => (
                          <SelectItem key={it.id} value={it.date}>
                            {it.date}
                            {it.departure_port ? ` — ${it.departure_port}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    // No catalog voyages for this ship → free date entry.
                    <DatePicker value={field.value ?? ""} onChange={field.onChange} className="h-9" />
                  )}
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={control}
          name="cabinType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Cabin Type</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="cabinNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Cabin Number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="e.g. Deck 10, Cabin 10248" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="embarkation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Embarkation Port</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="debarkation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-medium text-black/60">Debarkation Port</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="cruiseExtras"
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className="text-xs font-medium text-black/60">Cruise Extras</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className="h-9 rounded-xl border-black/10 bg-white/70" placeholder="Any extras..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* ── Itinerary (day-by-day) ──────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <SectionHeader icon={Ship} title="Itinerary" />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 rounded-xl border-black/10 bg-white/70"
            onClick={handleAddDay}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Day
          </Button>
        </div>

        <div className="grid gap-2">
          {itineraryFields.map((row, i) => (
            <div key={row.id} className="flex items-start gap-2">
              <Input
                type="number"
                min={1}
                {...register(`cruiseItinerary.${i}.day` as const, { valueAsNumber: true })}
                className="h-9 w-20 rounded-xl border-black/10 bg-white/70"
                placeholder="Day"
              />
              <div className="flex flex-1 flex-col gap-2">
                <Input
                  {...register(`cruiseItinerary.${i}.description` as const)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  placeholder="Port / description"
                />
                <Input
                  {...register(`cruiseItinerary.${i}.subDescription` as const)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  placeholder="Sub-description (optional)"
                />
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 rounded-xl text-black/50 hover:text-red-600"
                onClick={() => removeItineraryDay(i)}
                aria-label="Remove day"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          {itineraryFields.length === 0 && (
            <p className="text-xs text-black/45">No itinerary days. Use "Add Day" to start.</p>
          )}
        </div>
      </div>
    </div>
  );
}
