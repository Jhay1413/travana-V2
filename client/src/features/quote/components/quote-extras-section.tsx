import { useState, useEffect } from "react";
import { useFieldArray, useFormContext, type Control } from "react-hook-form";
import type { ExtrasFormValues } from "@/types/booking";
import {
  ArrowLeftRight,
  Car,
  Ticket,
  Coffee,
  ParkingSquare,
  Hotel,
  X,
  Plus,
  PackagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { AddBoardBasisModal } from "@/features/lookups/components/lookups/add-board-basis-modal";
import { AddRoomTypeModal } from "@/features/lookups/components/lookups/add-room-type-modal";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  useAirports,
  useTourOperators,
  useBoardBasis,
  useAccommodationSearch,
  useRoomTypes,
} from "@/hooks/queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExtraType = "transfer" | "carHire" | "attractionTicket" | "loungePass" | "airportParking" | "extraAccommodation";

const EXTRA_OPTIONS: { type: ExtraType; label: string; icon: React.ElementType; color: string }[] = [
  { type: "transfer", label: "Transfer", icon: ArrowLeftRight, color: "text-sky-600" },
  { type: "carHire", label: "Car Hire", icon: Car, color: "text-amber-600" },
  { type: "attractionTicket", label: "Attraction Ticket", icon: Ticket, color: "text-purple-600" },
  { type: "loungePass", label: "Lounge Pass", icon: Coffee, color: "text-rose-600" },
  { type: "airportParking", label: "Airport Parking", icon: ParkingSquare, color: "text-emerald-600" },
  { type: "extraAccommodation", label: "Extra Accommodation", icon: Hotel, color: "text-blue-600" },
];

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, className = "" }: { icon: React.ElementType; title: string; className?: string }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${className}`}>
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

// ─── Extra Card Wrapper ───────────────────────────────────────────────────────

function ExtraCard({ icon: Icon, title, iconColor, onRemove, children }: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/8 dark:border-white/8 bg-black/[0.02] dark:bg-white/[0.02] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-xs font-semibold ${iconColor}`}>
          <Icon className="h-3.5 w-3.5" />
          {title}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0 text-black/40 hover:text-red-500">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}

// ─── Shared Field Row Helpers ─────────────────────────────────────────────────

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{children}</div>;
}

function IncludedToggle({ control, name, onInclude }: { control: Control<ExtrasFormValues>; name: any; onInclude?: () => void }) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-2 pt-1">
          <FormControl>
            <Switch
              checked={field.value}
              onCheckedChange={(checked) => {
                field.onChange(checked);
                if (checked) onInclude?.();
              }}
            />
          </FormControl>
          <FormLabel className="text-xs font-medium text-black/60 cursor-pointer">Included in package</FormLabel>
        </FormItem>
      )}
    />
  );
}

function CostCommissionFields({ control, costName, commissionName }: { control: Control<ExtrasFormValues>; costName: any; commissionName: any }) {
  return (
    <>
      <FormField control={control} name={costName} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium text-black/60">Cost (£)</FormLabel>
          <FormControl><Input type="number" min={0} step={0.01} className="rounded-xl text-sm" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={control} name={commissionName} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium text-black/60">Commission (£)</FormLabel>
          <FormControl><Input type="number" min={0} step={0.01} className="rounded-xl text-sm" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </>
  );
}

function BookingRefTourOpFields({ control, prefix, tourOperatorOptions }: { control: Control<ExtrasFormValues>; prefix: string; tourOperatorOptions: { value: string; label: string }[] }) {
  return (
    <>
      <FormField control={control} name={`${prefix}.bookingRef` as any} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium text-black/60">Booking Ref</FormLabel>
          <FormControl><Input className="rounded-xl text-sm" placeholder="Optional" {...field} /></FormControl>
        </FormItem>
      )} />
      <FormField control={control} name={`${prefix}.tourOperatorId` as any} render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-medium text-black/60">Tour Operator</FormLabel>
          <FormControl>
            <SearchableSelect
              options={tourOperatorOptions}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              placeholder="Select operator"
            />
          </FormControl>
        </FormItem>
      )} />
    </>
  );
}

// ─── Transfer Extra ───────────────────────────────────────────────────────────

function TransferExtra({ control, index, tourOperatorOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  tourOperatorOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `transfers.${index}`;
  return (
    <ExtraCard icon={ArrowLeftRight} title={`Transfer ${index + 1}`} iconColor="text-sky-600" onRemove={onRemove}>
      <FieldGrid>
        <FormField control={control} name={`${p}.pickUpLocation` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Location</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Manchester Airport" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffLocation` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Location</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Hotel Melia" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.pickUpDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.pickUpTime` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Time</FormLabel>
            <FormControl><Input type="time" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffTime` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Time</FormLabel>
            <FormControl><Input type="time" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
        <FormField control={control} name={`${p}.note` as any} render={({ field }) => (
          <FormItem className="sm:col-span-2 md:col-span-3">
            <FormLabel className="text-xs font-medium text-black/60">Note</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="Optional note" {...field} /></FormControl>
          </FormItem>
        )} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Car Hire Extra ───────────────────────────────────────────────────────────

function CarHireExtra({ control, index, tourOperatorOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  tourOperatorOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `carHires.${index}`;
  return (
    <ExtraCard icon={Car} title={`Car Hire ${index + 1}`} iconColor="text-amber-600" onRemove={onRemove}>
      <FieldGrid>
        <FormField control={control} name={`${p}.pickUpLocation` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Location</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Airport terminal" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffLocation` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Location</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Same location" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.pickUpDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.pickUpTime` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Pick-up Time</FormLabel>
            <FormControl><Input type="time" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dropOffTime` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Drop-off Time</FormLabel>
            <FormControl><Input type="time" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.noOfDays` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">No. of Days</FormLabel>
            <FormControl><Input type="number" min={1} className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.driverAge` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Driver Age</FormLabel>
            <FormControl><Input type="number" min={17} className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Attraction Ticket Extra ──────────────────────────────────────────────────

function AttractionTicketExtra({ control, index, tourOperatorOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  tourOperatorOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `attractionTickets.${index}`;
  return (
    <ExtraCard icon={Ticket} title={`Attraction Ticket ${index + 1}`} iconColor="text-purple-600" onRemove={onRemove}>
      <FieldGrid>
        <FormField control={control} name={`${p}.ticketType` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Ticket Type</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Theme park, Museum" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dateOfVisit` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Date of Visit</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.numberOfTickets` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">No. of Tickets</FormLabel>
            <FormControl><Input type="number" min={1} className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Lounge Pass Extra ────────────────────────────────────────────────────────

function LoungePassExtra({ control, index, tourOperatorOptions, airportOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  tourOperatorOptions: { value: string; label: string }[];
  airportOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `loungePasses.${index}`;
  return (
    <ExtraCard icon={Coffee} title={`Lounge Pass ${index + 1}`} iconColor="text-rose-600" onRemove={onRemove}>
      <FieldGrid>
        <FormField control={control} name={`${p}.airportId` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Airport</FormLabel>
            <FormControl>
              <SearchableSelect options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport" />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.terminal` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Terminal</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. T1, T2" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.dateOfUsage` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Date of Usage</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
        <FormField control={control} name={`${p}.note` as any} render={({ field }) => (
          <FormItem className="sm:col-span-2 md:col-span-3">
            <FormLabel className="text-xs font-medium text-black/60">Note</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="Optional note" {...field} /></FormControl>
          </FormItem>
        )} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Airport Parking Extra ────────────────────────────────────────────────────

function AirportParkingExtra({ control, index, tourOperatorOptions, airportOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  tourOperatorOptions: { value: string; label: string }[];
  airportOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `airportParkings.${index}`;
  return (
    <ExtraCard icon={ParkingSquare} title={`Airport Parking ${index + 1}`} iconColor="text-emerald-600" onRemove={onRemove}>
      <FieldGrid>
        <FormField control={control} name={`${p}.airportId` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Airport</FormLabel>
            <FormControl>
              <SearchableSelect options={airportOptions} value={field.value ?? ""} onValueChange={field.onChange} placeholder="Select airport" />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.parkingType` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Parking Type</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="rounded-xl text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="short-stay">Short Stay</SelectItem>
                  <SelectItem value="long-stay">Long Stay</SelectItem>
                  <SelectItem value="meet-and-greet">Meet & Greet</SelectItem>
                  <SelectItem value="valet">Valet</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.parkingDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Parking Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.duration` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Duration</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. 14 days" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.carMake` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Car Make</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Ford" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.carModel` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Car Model</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Focus" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.colour` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Colour</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. Silver" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.carRegNumber` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Reg Number</FormLabel>
            <FormControl><Input className="rounded-xl text-sm" placeholder="e.g. AB12 CDE" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Extra Accommodation ──────────────────────────────────────────────────────

function ExtraAccommodationExtra({ control, index, initialLabel, tourOperatorOptions, boardBasisOptions, roomTypeOptions, mainTourOperatorId, setValue, onRemove }: {
  control: Control<ExtrasFormValues>;
  index: number;
  initialLabel?: string;
  tourOperatorOptions: { value: string; label: string }[];
  boardBasisOptions: { value: string; label: string }[];
  roomTypeOptions: { value: string; label: string }[];
  mainTourOperatorId: string;
  setValue: (name: any, value: any) => void;
  onRemove: () => void;
}) {
  const p = `extraAccommodations.${index}`;
  const [accomSearch, setAccomSearch] = useState("");
  const [accomLabel, setAccomLabel] = useState(initialLabel ?? "");
  useEffect(() => { if (initialLabel && !accomLabel) setAccomLabel(initialLabel); }, [initialLabel]);
  const { data: accommodationsData, isFetching: isAccomFetching } = useAccommodationSearch(accomSearch);
  const accommodationOptions = (accommodationsData || []).map((a: any) => ({ value: a.id, label: a.name || a.id }));
  const [showAddBoardBasis, setShowAddBoardBasis] = useState(false);
  const [showAddRoomType, setShowAddRoomType] = useState(false);
  const [boardBasisSearch, setBoardBasisSearch] = useState("");
  const [roomTypeSearch, setRoomTypeSearch] = useState("");

  return (
    <ExtraCard icon={Hotel} title={`Extra Accommodation ${index + 1}`} iconColor="text-blue-600" onRemove={onRemove}>
      <p className="text-[10px] text-black/40 dark:text-white/40 -mt-1">Will be added with <span className="font-semibold">is_primary = false</span></p>
      <AddBoardBasisModal
        open={showAddBoardBasis}
        onOpenChange={setShowAddBoardBasis}
        initialName={boardBasisSearch}
        onSuccess={(bb) => { setValue(`${p}.boardBasisId`, bb.id); setBoardBasisSearch(""); }}
      />
      <AddRoomTypeModal
        open={showAddRoomType}
        onOpenChange={setShowAddRoomType}
        initialName={roomTypeSearch}
        onSuccess={(rt) => { setValue(`${p}.roomType`, rt.id); setRoomTypeSearch(""); }}
      />
      <FieldGrid>
        <FormField control={control} name={`${p}.accommodationId` as any} render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel className="text-xs font-medium text-black/60">Accommodation</FormLabel>
            <FormControl>
              <SearchableSelect
                options={accommodationOptions}
                value={field.value ?? ""}
                onValueChange={(val) => {
                  field.onChange(val);
                  const selected = accommodationsData?.find((a: any) => a.id === val);
                  if (selected) setAccomLabel(selected.name || selected.id);
                }}
                onSearch={setAccomSearch}
                isLoading={isAccomFetching}
                selectedLabel={accomLabel}
                emptyMessage={!accomSearch ? "Type to search accommodations..." : "No accommodations found."}
                placeholder="Search accommodation"
              />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.boardBasisId` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Board Basis</FormLabel>
            <FormControl>
              <SearchableSelect
                options={boardBasisOptions}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                onSearchCapture={setBoardBasisSearch}
                onAddNew={() => setShowAddBoardBasis(true)}
                addNewLabel="Add Board Basis"
                placeholder="Select board basis..."
              />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.roomType` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Room Type</FormLabel>
            <FormControl>
              <SearchableSelect
                options={roomTypeOptions}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                onSearchCapture={setRoomTypeSearch}
                onAddNew={() => setShowAddRoomType(true)}
                addNewLabel="Add Room Type"
                placeholder="Select room type..."
              />
            </FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.checkInDate` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Check-in Date</FormLabel>
            <FormControl><Input type="date" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.checkInTime` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Check-in Time</FormLabel>
            <FormControl><Input type="time" className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name={`${p}.noOfNights` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">No. of Nights</FormLabel>
            <FormControl><Input type="number" min={0} className="rounded-xl text-sm" {...field} /></FormControl>
          </FormItem>
        )} />
        <BookingRefTourOpFields control={control} prefix={p} tourOperatorOptions={tourOperatorOptions} />
        <CostCommissionFields control={control} costName={`${p}.cost`} commissionName={`${p}.commission`} />
      </FieldGrid>
      <IncludedToggle control={control} name={`${p}.isIncludedInPackage`} onInclude={() => {
        setValue(`${p}.tourOperatorId`, mainTourOperatorId);
        setValue(`${p}.cost`, 0);
        setValue(`${p}.commission`, 0);
      }} />
    </ExtraCard>
  );
}

// ─── Main Extras Section ──────────────────────────────────────────────────────

export function QuoteExtrasSection({ control, initialAccomLabels = [], mainTourOperatorId = "" }: { control: Control<ExtrasFormValues>; initialAccomLabels?: string[]; mainTourOperatorId?: string }) {
  const { setValue } = useFormContext();
  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypesData } = useRoomTypes();

  const airportOptions = (airportsData || []).map((a: any) => ({ value: a.id, label: a.airport_name || a.id }));
  const tourOperatorOptions = (tourOperatorsData || []).map((op: any) => ({ value: op.id, label: op.name || op.id }));
  const boardBasisOptions = (boardBasisData || []).map((b: any) => ({ value: b.id, label: b.type || b.id }));
  const roomTypeOptions = (roomTypesData || []).map((r: any) => ({ value: r.id, label: r.name || r.type || r.id }));

  const { fields: transfers, append: addTransfer, remove: removeTransfer } = useFieldArray({ control, name: "transfers" });
  const { fields: carHires, append: addCarHire, remove: removeCarHire } = useFieldArray({ control, name: "carHires" });
  const { fields: attractionTickets, append: addAttractionTicket, remove: removeAttractionTicket } = useFieldArray({ control, name: "attractionTickets" });
  const { fields: loungePasses, append: addLoungePass, remove: removeLoungePass } = useFieldArray({ control, name: "loungePasses" });
  const { fields: airportParkings, append: addAirportParking, remove: removeAirportParking } = useFieldArray({ control, name: "airportParkings" });
  const { fields: extraAccommodations, append: addExtraAccommodation, remove: removeExtraAccommodation } = useFieldArray({ control, name: "extraAccommodations" });

  const totalExtras = transfers.length + carHires.length + attractionTickets.length + loungePasses.length + airportParkings.length + extraAccommodations.length;

  const handleAdd = (type: ExtraType) => {
    if (type === "transfer") addTransfer({ bookingRef: "", tourOperatorId: "", pickUpLocation: "", dropOffLocation: "", pickUpDate: "", pickUpTime: "", dropOffDate: "", dropOffTime: "", note: "", cost: 0, commission: 0, isIncludedInPackage: true });
    else if (type === "carHire") addCarHire({ bookingRef: "", tourOperatorId: "", pickUpLocation: "", dropOffLocation: "", pickUpDate: "", pickUpTime: "", dropOffDate: "", dropOffTime: "", noOfDays: 1, driverAge: 25, cost: 0, commission: 0, isIncludedInPackage: true });
    else if (type === "attractionTicket") addAttractionTicket({ bookingRef: "", tourOperatorId: "", ticketType: "", dateOfVisit: "", numberOfTickets: 1, cost: 0, commission: 0, isIncludedInPackage: true });
    else if (type === "loungePass") addLoungePass({ bookingRef: "", tourOperatorId: "", airportId: "", terminal: "", dateOfUsage: "", note: "", cost: 0, commission: 0, isIncludedInPackage: true });
    else if (type === "airportParking") addAirportParking({ bookingRef: "", tourOperatorId: "", airportId: "", parkingType: "", parkingDate: "", carMake: "", carModel: "", colour: "", carRegNumber: "", duration: "", cost: 0, commission: 0, isIncludedInPackage: true });
    else if (type === "extraAccommodation") addExtraAccommodation({ bookingRef: "", tourOperatorId: "", accommodationId: "", boardBasisId: "", roomType: "", checkInDate: "", checkInTime: "", noOfNights: 0, cost: 0, commission: 0, isIncludedInPackage: true });
  };

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <SectionHeader icon={PackagePlus} title="Extras" />
        {totalExtras > 0 && (
          <span className="rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {totalExtras} added
          </span>
        )}
      </div>

      {/* Add Extra Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {EXTRA_OPTIONS.map(({ type, label, icon: Icon, color }) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-xl text-xs border-black/10 dark:border-white/10 gap-1.5"
            onClick={() => handleAdd(type)}
          >
            <Icon className={`h-3 w-3 ${color}`} />
            <Plus className="h-2.5 w-2.5 text-black/40" />
            {label}
          </Button>
        ))}
      </div>

      {/* No extras placeholder */}
      {totalExtras === 0 && (
        <p className="text-xs text-black/40 dark:text-white/40 text-center py-2">
          Click the buttons above to add extras to this quote
        </p>
      )}

      {/* Rendered extras */}
      {totalExtras > 0 && (
        <div className="space-y-3">
          {transfers.map((field, idx) => (
            <TransferExtra key={field.id} control={control} index={idx} tourOperatorOptions={tourOperatorOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeTransfer(idx)} />
          ))}
          {carHires.map((field, idx) => (
            <CarHireExtra key={field.id} control={control} index={idx} tourOperatorOptions={tourOperatorOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeCarHire(idx)} />
          ))}
          {attractionTickets.map((field, idx) => (
            <AttractionTicketExtra key={field.id} control={control} index={idx} tourOperatorOptions={tourOperatorOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeAttractionTicket(idx)} />
          ))}
          {loungePasses.map((field, idx) => (
            <LoungePassExtra key={field.id} control={control} index={idx} tourOperatorOptions={tourOperatorOptions} airportOptions={airportOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeLoungePass(idx)} />
          ))}
          {airportParkings.map((field, idx) => (
            <AirportParkingExtra key={field.id} control={control} index={idx} tourOperatorOptions={tourOperatorOptions} airportOptions={airportOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeAirportParking(idx)} />
          ))}
          {extraAccommodations.map((field, idx) => (
            <ExtraAccommodationExtra key={field.id} control={control} index={idx} initialLabel={initialAccomLabels[idx]} tourOperatorOptions={tourOperatorOptions} boardBasisOptions={boardBasisOptions} roomTypeOptions={roomTypeOptions} mainTourOperatorId={mainTourOperatorId} setValue={setValue} onRemove={() => removeExtraAccommodation(idx)} />
          ))}
        </div>
      )}
    </div>
  );
}
