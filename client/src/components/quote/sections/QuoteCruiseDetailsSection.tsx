import { useFormContext, useWatch } from "react-hook-form";
import { Anchor } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCruiseLines, useShips, useCruiseItineraries } from "@/hooks/queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

export function QuoteCruiseDetailsSection() {
  const { control, setValue } = useFormContext<QuoteFormValues>();
  const cruiseLine = useWatch({ control, name: "cruiseLine" });
  const shipName = useWatch({ control, name: "shipName" });
  const { data: cruiseLinesData } = useCruiseLines();
  const selectedCruiseLineId = cruiseLinesData?.find((l) => l.name === cruiseLine)?.id;
  const { data: shipsData } = useShips(selectedCruiseLineId);
  const selectedShipId = shipsData?.find((s) => s.name === shipName)?.id;
  const { data: cruiseItineraries, isFetching: isFetchingCruiseDates } = useCruiseItineraries(selectedShipId);

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
                  options={(cruiseLinesData || []).map((l) => ({ value: l.name ?? l.id, label: l.name ?? l.id }))}
                  value={field.value ?? ""}
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
                  options={(shipsData || []).map((s) => ({ value: s.name ?? s.id, label: s.name ?? s.id }))}
                  value={field.value ?? ""}
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
                  <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={!cruiseItineraries?.length}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70">
                      <SelectValue placeholder={cruiseDatePlaceholder} />
                    </SelectTrigger>
                    <SelectContent>
                      {(cruiseItineraries || []).map((it) => (
                        <SelectItem key={it.id} value={it.date}>
                          {it.date}
                          {it.departure_port ? ` — ${it.departure_port}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
    </div>
  );
}
