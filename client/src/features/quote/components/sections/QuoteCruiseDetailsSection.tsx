import { useMemo, useCallback } from "react";
import { useFormContext, useWatch, useFieldArray } from "react-hook-form";
import { Ship, Plus, Trash2 } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCruiseLines, useShips, useCruiseItineraries } from "@/hooks/queries";
import { fmControlClass, fmInputClass, fmLabelClass, fmSmallButtonClass, fmSubheadingClass } from "@/features/quote/components/fm-classes";
import type { QuoteFormValues } from "@/features/quote/types";

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

  const cruiseDateOptions = useMemo(
    () =>
      (cruiseItineraries || []).map((it) => ({
        value: it.date,
        label: `${it.date}${it.departure_port ? ` — ${it.departure_port}` : ""}`,
      })),
    [cruiseItineraries],
  );

  const handleAddDay = useCallback(() => {
    appendItineraryDay({ day: itineraryFields.length + 1, description: "", subDescription: "" });
  }, [appendItineraryDay, itineraryFields.length]);

  return (
    <div>
      <FormField
        control={control}
        name="cruiseOnly"
        render={({ field }) => (
          <FormItem className="mb-3 flex items-center gap-3">
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="text-xs font-medium text-[#6B7686] !mt-0">Cruise only (no flights)</FormLabel>
          </FormItem>
        )}
      />

      <div className="fm-grid fm-g2">
        <FormField
          control={control}
          name="cruiseTitle"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>Cruise title</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} />
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
              <FormLabel className={fmLabelClass}>Cruise line</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={fmControlClass}
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
              <FormLabel className={fmLabelClass}>Ship name</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={fmControlClass}
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
                <FormLabel className={fmLabelClass}>Cruise date</FormLabel>
                <FormControl>
                  {cruiseItineraries?.length || isFetchingCruiseDates ? (
                    // Catalog has voyages for this ship → pick a real sailing.
                    <SearchableSelect
                  className={fmControlClass}
                      options={cruiseDateOptions}
                      value={field.value ?? ""}
                      selectedLabel={field.value || undefined}
                      onValueChange={field.onChange}
                      placeholder={cruiseDatePlaceholder}
                      searchPlaceholder="Search dates or port…"
                      emptyMessage="No matching voyages."
                      isLoading={isFetchingCruiseDates}
                    />
                  ) : (
                    // No catalog voyages for this ship → free date entry.
                    <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} disablePast />
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
              <FormLabel className={fmLabelClass}>Cabin type</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} />
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
              <FormLabel className={fmLabelClass}>Cabin number</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="e.g. Deck 10, Cabin 10248" />
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
              <FormLabel className={fmLabelClass}>Embarkation port</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} />
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
              <FormLabel className={fmLabelClass}>Debarkation port</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} />
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
              <FormLabel className={fmLabelClass}>Cruise extras</FormLabel>
              <FormControl>
                <Input {...field} value={field.value ?? ""} className={fmInputClass} placeholder="Any extras..." />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* ── Itinerary (day-by-day) ──────────────────────────────────────────── */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <p className={fmSubheadingClass}>
            <Ship className="h-4 w-4" />
            Itinerary
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={fmSmallButtonClass}
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
                className={`${fmInputClass} w-20`}
                placeholder="Day"
              />
              <div className="flex flex-1 flex-col gap-2">
                <Input
                  {...register(`cruiseItinerary.${i}.description` as const)}
                  className={fmInputClass}
                  placeholder="Port / description"
                />
                <Input
                  {...register(`cruiseItinerary.${i}.subDescription` as const)}
                  className={fmInputClass}
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
