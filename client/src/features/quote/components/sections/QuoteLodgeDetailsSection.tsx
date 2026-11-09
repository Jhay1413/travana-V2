import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { PawPrint } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useParks, useLodges } from "@/hooks/queries";
import { AddLodgeModal } from "@/features/lookups/components/lookups/add-lodge-modal";
import { fmControlClass, fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import type { QuoteFormValues } from "@/features/quote/types";

export function QuoteLodgeDetailsSection() {
  const { control, setValue } = useFormContext<QuoteFormValues>();
  const parkId = useWatch({ control, name: "parkId" });
  const { data: parksData } = useParks();
  const { data: lodgesData, isFetching: isLodgesFetching } = useLodges(parkId || undefined);
  const [lodgeSearch, setLodgeSearch] = useState("");
  const [showAddLodgeModal, setShowAddLodgeModal] = useState(false);
  // Label for a just-created lodge until the refetched list contains it.
  const [createdLodge, setCreatedLodge] = useState<{ id: string; label: string } | null>(null);

  const parkName = (parksData ?? []).find((p: { id: string; name: string | null }) => p.id === parkId)?.name ?? undefined;
  const lodgeTerm = lodgeSearch.trim().toLowerCase();
  const lodgeList: { lodge_name: string | null; lodge_code: string | null }[] = lodgesData ?? [];
  const noLodgeMatch = lodgeTerm
    ? !lodgeList.some((l) => (l.lodge_name || l.lodge_code || "").toLowerCase().includes(lodgeTerm))
    : lodgeList.length === 0;
  const canAddLodge = !!parkId && !isLodgesFetching && noLodgeMatch;

  return (
    <div>
      <div className="grid gap-x-4 gap-y-3.5 md:grid-cols-3">
        <FormField
          control={control}
          name="parkId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>Park</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={fmControlClass}
                  options={(parksData ?? []).map((p: { id: string; name: string | null }) => ({
                    value: p.id,
                    label: p.name || p.id,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  placeholder="Select park..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="lodgeId"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>Lodge</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={fmControlClass}
                  options={(lodgesData ?? []).map((l: { id: string; lodge_name: string | null; lodge_code: string | null }) => ({
                    value: l.id,
                    label: l.lodge_name || l.lodge_code || l.id,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setLodgeSearch("");
                  }}
                  onSearchCapture={setLodgeSearch}
                  selectedLabel={createdLodge && createdLodge.id === field.value ? createdLodge.label : undefined}
                  onAddNew={canAddLodge ? () => setShowAddLodgeModal(true) : undefined}
                  addNewLabel="Add Lodge"
                  placeholder={parkId ? "Select lodge..." : "Select a park first"}
                />
              </FormControl>
              {!parkId && lodgeSearch.trim() && (
                <p className="text-xs text-black/50">Select a park first to add a lodge</p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="nights"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>Nights</FormLabel>
              <FormControl>
                <Input type="number" {...field} className={fmInputClass} min={1} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="checkInDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>Check-in Date</FormLabel>
              <FormControl>
                <DatePicker variant="fm" value={field.value ?? ""} onChange={field.onChange} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="pets"
          render={({ field }) => (
            <FormItem>
              <FormLabel className={fmLabelClass}>
                <div className="flex items-center gap-1.5">
                  <PawPrint className="h-3.5 w-3.5" />
                  No. of Pets
                </div>
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  className={fmInputClass}
                  {...field}
                  value={field.value ?? 0}
                  onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {parkId && (
        <AddLodgeModal
          open={showAddLodgeModal}
          onOpenChange={setShowAddLodgeModal}
          parkId={parkId}
          parkName={parkName}
          initialName={lodgeSearch.trim()}
          onSuccess={(lodge) => {
            setCreatedLodge({ id: lodge.id, label: lodge.lodge_name || lodge.lodge_code || lodge.id });
            setValue("lodgeId", lodge.id, { shouldDirty: true });
            setLodgeSearch("");
          }}
        />
      )}
    </div>
  );
}
