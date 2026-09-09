import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { MapPin } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  useCountries,
  useDestinationSearch,
  useResortSearch,
  useAccommodationSearch,
  useDestinationsByIds,
  useResortsByIds,
  useAccommodationsByIds,
  useBoardBasis,
  useRoomTypes,
} from "@/hooks/queries";
import { AddAccommodationModal } from "@/features/lookups/components/lookups/add-accommodation-modal";
import { AddDestinationModal } from "@/features/lookups/components/lookups/add-destination-modal";
import { AddResortModal } from "@/features/lookups/components/lookups/add-resort-modal";
import { AddBoardBasisModal } from "@/features/lookups/components/lookups/add-board-basis-modal";
import { AddRoomTypeModal } from "@/features/lookups/components/lookups/add-room-type-modal";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";
import {
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
  drawerLabelClass,
} from "@/components/shared/form-drawer";
import type { QuoteFormValues, FormLayout } from "@/features/quote/types";

export function QuoteDestinationAccomSection({ layout = "card" }: { layout?: FormLayout } = {}) {
  const { control, setValue } = useFormContext<QuoteFormValues>();
  const country = useWatch({ control, name: "country" });
  const destination = useWatch({ control, name: "destination" });
  const resort = useWatch({ control, name: "resort" });
  const accommodationId = useWatch({ control, name: "accommodationId" });

  const [destSearch, setDestSearch] = useState("");
  const [destLabel, setDestLabel] = useState("");
  const [resortSearch, setResortSearch] = useState("");
  const [resortLabel, setResortLabel] = useState("");
  const [accomSearch, setAccomSearch] = useState("");
  const [accomLabel, setAccomLabel] = useState("");
  const [boardBasisSearch, setBoardBasisSearch] = useState("");
  const [roomTypeSearch, setRoomTypeSearch] = useState("");
  const [showAddAccomModal, setShowAddAccomModal] = useState(false);
  const [showAddDestModal, setShowAddDestModal] = useState(false);
  const [showAddResortModal, setShowAddResortModal] = useState(false);
  const [showAddBoardBasisModal, setShowAddBoardBasisModal] = useState(false);
  const [showAddRoomTypeModal, setShowAddRoomTypeModal] = useState(false);

  const { data: countriesData } = useCountries();
  const { data: destinationsData, isFetching: isDestFetching } = useDestinationSearch(destSearch, country || undefined);
  const { data: resortsData, isFetching: isResortFetching } = useResortSearch(
    resortSearch,
    destination || undefined,
    !destination ? country || undefined : undefined,
  );
  const { data: accommodationsData, isFetching: isAccomFetching } = useAccommodationSearch(
    accomSearch,
    resort || undefined,
    !resort ? destination || undefined : undefined,
    !resort && !destination ? country || undefined : undefined,
  );
  // These selects are search-backed and return a page at a time, so a value set
  // by an import (or chosen before a filter changed) is usually NOT in the
  // current results — and a select renders nothing for an option it lacks.
  // Fetch the selected rows by id and merge them in, so the value always shows.
  const { data: selectedDestinations } = useDestinationsByIds([destination]);
  const { data: selectedResorts } = useResortsByIds([resort]);
  const { data: selectedAccommodations } = useAccommodationsByIds([accommodationId]);

  const withSelected = <T extends { id: string; name: string }>(
    list: T[] | undefined,
    selected: T[] | undefined,
  ): { value: string; label: string }[] => {
    const seen = new Set((list ?? []).map((i) => i.id));
    const merged = [...(list ?? []), ...(selected ?? []).filter((i) => !seen.has(i.id))];
    return merged.map((i) => ({ value: i.id, label: i.name }));
  };

  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();

  const isDrawer = layout === "drawer";
  const labelCls = isDrawer ? drawerLabelClass : "text-xs font-medium text-black/60";
  const inputCls = isDrawer ? drawerInputClass : "h-9 rounded-xl border-black/10 bg-white/70";
  const controlCls = isDrawer ? drawerControlClass : undefined;
  const itemCls = isDrawer ? "space-y-1.5" : undefined;

  // Drawer bar reads "Hotel - <accommodation>, <destination>" from the current
  // selection; the by-id lookups cover values loaded with the record.
  const accomName = selectedAccommodations?.[0]?.name || accomLabel;
  const destName = selectedDestinations?.[0]?.name || destLabel;
  const hotelTitle = `Hotel${accomName ? ` - ${accomName}` : ""}${destName ? `, ${destName}` : ""}`;

  const body = (
      <div className={isDrawer ? "grid grid-cols-3 gap-x-6 gap-y-4" : "grid gap-3 md:grid-cols-2"}>
        <FormField
          control={control}
          name="country"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Country</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={(countriesData || []).map((c: { id: string; country_name: string }) => ({
                    value: c.id,
                    label: c.country_name,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("destination", "");
                    setValue("resort", "");
                    setValue("accommodationId", "");
                    setDestLabel("");
                    setResortLabel("");
                    setAccomLabel("");
                  }}
                  placeholder="Select country..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="destination"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Destination</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={withSelected(destinationsData, selectedDestinations)}
                  value={field.value ?? ""}
                  onValueChange={(value) => {
                    const label = (destinationsData || []).find((d) => d.id === value)?.name || "";
                    setDestLabel(label);
                    field.onChange(value);
                    setValue("resort", "");
                    setValue("accommodationId", "");
                    setResortLabel("");
                    setAccomLabel("");
                  }}
                  selectedLabel={destLabel}
                  onSearch={setDestSearch}
                  isLoading={isDestFetching}
                  placeholder="Search destinations..."
                  onAddNew={
                    destSearch && !isDestFetching && (!destinationsData || destinationsData.length === 0)
                      ? () => setShowAddDestModal(true)
                      : undefined
                  }
                  addNewLabel="Add Destination"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="resort"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Resort</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={withSelected(resortsData, selectedResorts)}
                  value={field.value ?? ""}
                  selectedLabel={resortLabel}
                  onSearch={setResortSearch}
                  isLoading={isResortFetching}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setValue("accommodationId", "");
                    setAccomLabel("");
                    const selectedResort = (resortsData || []).find((r) => r.id === value);
                    if (selectedResort?.destination_id) {
                      setValue("destination", selectedResort.destination_id);
                      setDestLabel(selectedResort.destination_name || "");
                    }
                    if (selectedResort?.country_id) {
                      setValue("country", selectedResort.country_id);
                    }
                    setResortLabel(selectedResort?.name || "");
                  }}
                  placeholder="Search resort..."
                  onAddNew={
                    resortSearch && !isResortFetching && (!resortsData || resortsData.length === 0)
                      ? () => setShowAddResortModal(true)
                      : undefined
                  }
                  addNewLabel="Add Resort"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="accommodationId"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Accommodation</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={withSelected(accommodationsData, selectedAccommodations)}
                  value={field.value ?? ""}
                  selectedLabel={accomLabel}
                  onSearch={setAccomSearch}
                  isLoading={isAccomFetching}
                  emptyMessage={
                    !accomSearch && !resort && !destination && !country
                      ? "Type to search accommodations..."
                      : "No accommodations found."
                  }
                  onAddNew={
                    accomSearch && !isAccomFetching && (!accommodationsData || accommodationsData.length === 0)
                      ? () => setShowAddAccomModal(true)
                      : undefined
                  }
                  addNewLabel="Add Accommodation"
                  onValueChange={(value) => {
                    field.onChange(value);
                    const selected = (accommodationsData || []).find((a) => a.id === value);
                    if (selected) {
                      setAccomLabel(selected.name);
                      if (selected.resorts_id) {
                        setValue("resort", selected.resorts_id);
                        setResortLabel(selected.resort_name || "");
                      }
                      if (selected.destination_id) {
                        setValue("destination", selected.destination_id);
                        setDestLabel(selected.destination_name || "");
                      }
                      if (selected.country_id) {
                        setValue("country", selected.country_id);
                      }
                    }
                  }}
                  placeholder="Search accommodation..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <AddAccommodationModal
          open={showAddAccomModal}
          onOpenChange={setShowAddAccomModal}
          initialName={accomSearch}
          initialCountryId={country || ""}
          initialDestinationId={destination || ""}
          initialDestinationName={destLabel}
          initialResortId={resort || ""}
          initialResortName={resortLabel}
          onSuccess={(acc) => {
            setValue("accommodationId", acc.id);
            setAccomLabel(acc.name);
            if (acc.resorts_id) {
              setValue("resort", acc.resorts_id);
              setResortLabel(acc.resort_name || "");
            }
            if (acc.destination_id) {
              setValue("destination", acc.destination_id);
              setDestLabel(acc.destination_name || "");
            }
            if (acc.country_id) {
              setValue("country", acc.country_id);
            }
            setAccomSearch("");
          }}
        />

        <AddDestinationModal
          open={showAddDestModal}
          onOpenChange={setShowAddDestModal}
          initialName={destSearch}
          initialCountryId={country || ""}
          onSuccess={(dest) => {
            setValue("destination", dest.id);
            setDestLabel(dest.name);
            if (dest.country_id) {
              setValue("country", dest.country_id);
            }
            setValue("resort", "");
            setValue("accommodationId", "");
            setResortLabel("");
            setAccomLabel("");
            setDestSearch("");
          }}
        />

        <AddResortModal
          open={showAddResortModal}
          onOpenChange={setShowAddResortModal}
          initialName={resortSearch}
          initialCountryId={country || ""}
          initialDestinationId={destination || ""}
          initialDestinationName={destLabel}
          onSuccess={(res) => {
            setValue("resort", res.id);
            setResortLabel(res.name);
            if (res.destination_id) {
              setValue("destination", res.destination_id);
              setDestLabel(res.destination_name || "");
            }
            if (res.country_id) {
              setValue("country", res.country_id);
            }
            setValue("accommodationId", "");
            setAccomLabel("");
            setResortSearch("");
          }}
        />

        <AddBoardBasisModal
          open={showAddBoardBasisModal}
          onOpenChange={setShowAddBoardBasisModal}
          initialName={boardBasisSearch}
          onSuccess={(bb) => {
            setValue("boardBasisId", bb.id);
            setBoardBasisSearch("");
          }}
        />

        <AddRoomTypeModal
          open={showAddRoomTypeModal}
          onOpenChange={setShowAddRoomTypeModal}
          initialName={roomTypeSearch}
          onSuccess={(rt) => {
            setValue("roomType", rt.id);
            setRoomTypeSearch("");
          }}
        />

        <FormField
          control={control}
          name="boardBasisId"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>{isDrawer ? "Board Type" : "Board Basis"}</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={(boardBasisData || []).map((b: { id: string; type: string }) => ({
                    value: b.id,
                    label: b.type,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  onSearchCapture={setBoardBasisSearch}
                  onAddNew={() => setShowAddBoardBasisModal(true)}
                  addNewLabel="Add Board Basis"
                  placeholder="Select board basis..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="roomType"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Room Type</FormLabel>
              <FormControl>
                <SearchableSelect
                  className={controlCls}
                  options={(roomTypeData || []).map((r: { id: string; name: string | null }) => ({
                    value: r.id,
                    label: r.name || r.id,
                  }))}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  onSearchCapture={setRoomTypeSearch}
                  onAddNew={() => setShowAddRoomTypeModal(true)}
                  addNewLabel="Add Room Type"
                  placeholder="Select room type..."
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="checkInDate"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Check-in Date</FormLabel>
              <FormControl>
                <DatePicker value={field.value ?? ""} onChange={field.onChange} className={controlCls} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="checkInTime"
          render={({ field }) => (
            <FormItem className={itemCls}>
              <FormLabel className={labelCls}>Check-in Time</FormLabel>
              <FormControl>
                <Input type="time" {...field} value={field.value ?? ""} className={inputCls} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
  );

  if (isDrawer) {
    return (
      <FormDrawerSection title={hotelTitle} data-testid="drawer-section-hotel">
        {body}
      </FormDrawerSection>
    );
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={MapPin} title="Destination & Accommodation" />
      {body}
    </div>
  );
}
