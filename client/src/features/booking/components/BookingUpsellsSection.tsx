import { useEffect } from "react";
import { useFieldArray, useWatch, type Control, type UseFormSetValue } from "react-hook-form";
import { Plus, X, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  UPSELL_TYPE_OPTIONS,
  upsellTypeMeta,
  emptyUpsellItem,
  type UpsellsFormValues,
} from "@/features/booking/types";
import { useTourOperators } from "@/features/tour-operator/api/use-tour-operator-queries";
import type { TourOperator } from "@/features/tour-operator/types";

// ─── Section Header (mirrors quote-extras-section) ────────────────────────────

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Icon className="h-4 w-4" />
      {title}
    </div>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">{children}</div>;
}

// ─── Single Upsell Row ────────────────────────────────────────────────────────

function UpsellRow({
  control,
  setValue,
  index,
  currentType,
  onRemove,
  tourOperators,
}: {
  control: Control<UpsellsFormValues>;
  setValue: UseFormSetValue<UpsellsFormValues>;
  index: number;
  currentType: ReturnType<typeof upsellTypeMeta>;
  onRemove: () => void;
  tourOperators: TourOperator[];
}) {
  const p = `upsells.${index}` as const;
  const Icon = currentType.icon;

  // Watch cost and tourOperatorId for auto-calc
  const cost = useWatch({ control, name: `upsells.${index}.cost` as "upsells.0.cost" });
  const tourOperatorId = useWatch({ control, name: `upsells.${index}.tourOperatorId` as "upsells.0.tourOperatorId" });

  // Auto-calc commission when cost or operator changes — mirrors booking-rhf-form pattern.
  // Only fires when an operator with a commission_percentage is selected.
  useEffect(() => {
    if (!tourOperatorId) return;
    const op = tourOperators.find((o) => o.id === tourOperatorId);
    if (op?.commission_percentage == null) return;
    const costNum = Number(cost) || 0;
    const calc = parseFloat(((costNum * parseFloat(op.commission_percentage)) / 100).toFixed(2));
    setValue(`upsells.${index}.commission` as "upsells.0.commission", calc, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [cost, tourOperatorId]); // eslint-disable-line react-hooks/exhaustive-deps

  const tourOperatorOptions = tourOperators.map((op) => ({
    value: op.id,
    label: op.name || op.id,
  }));

  return (
    <div
      className="space-y-3 rounded-xl border border-black/8 bg-black/[0.02] p-3"
      data-testid={`card-upsell-${index}`}
    >
      <div className="flex items-center justify-between">
        <div className={`flex items-center gap-2 text-xs font-semibold ${currentType.color}`}>
          <Icon className="h-3.5 w-3.5" />
          Upsell {index + 1}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-6 w-6 p-0 text-black/40 hover:text-red-500"
          data-testid={`button-remove-upsell-${index}`}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <FieldGrid>
        <FormField control={control} name={`${p}.upsellType` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Type</FormLabel>
            <FormControl>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="rounded-xl text-sm" data-testid={`select-upsell-type-${index}`}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {UPSELL_TYPE_OPTIONS.map(({ value, label, icon: OptIcon, color }) => (
                    <SelectItem key={value} value={value}>
                      <span className="flex items-center gap-2">
                        <OptIcon className={`h-3.5 w-3.5 ${color}`} />
                        {label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormControl>
          </FormItem>
        )} />

        <FormField control={control} name={`${p}.description` as any} render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel className="text-xs font-medium text-black/60">Description</FormLabel>
            <FormControl>
              <Input className="rounded-xl text-sm" placeholder="e.g. 2 extra nights at Hotel Melia" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={control} name={`${p}.tourOperatorId` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Tour Operator</FormLabel>
            <FormControl>
              <SearchableSelect
                options={tourOperatorOptions}
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  const op = tourOperators.find((o) => o.id === value);
                  const costNum = Number(cost) || 0;
                  if (op?.commission_percentage != null && costNum > 0) {
                    const calc = parseFloat(((costNum * parseFloat(op.commission_percentage)) / 100).toFixed(2));
                    setValue(`upsells.${index}.commission` as "upsells.0.commission", calc, {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                  }
                }}
                placeholder="Select operator (optional)"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={control} name={`${p}.quantity` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Quantity</FormLabel>
            <FormControl>
              <Input type="number" min={1} className="rounded-xl text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={control} name={`${p}.cost` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Cost (£)</FormLabel>
            <FormControl>
              <Input type="number" min={0} step={0.01} className="rounded-xl text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />

        <FormField control={control} name={`${p}.commission` as any} render={({ field }) => (
          <FormItem>
            <FormLabel className="text-xs font-medium text-black/60">Commission (£)</FormLabel>
            <FormControl>
              <Input type="number" min={0} step={0.01} className="rounded-xl text-sm" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </FieldGrid>
    </div>
  );
}

// ─── Main Upsells Section ─────────────────────────────────────────────────────

export function BookingUpsellsSection({
  control,
  setValue,
  bare = false,
}: {
  control: Control<UpsellsFormValues>;
  setValue: UseFormSetValue<UpsellsFormValues>;
  /** Render without the card wrapper and header (inside a drawer section). */
  bare?: boolean;
}) {
  // keyName must NOT be the default "id" — each upsell row carries its own
  // persisted `id`, and the default would overwrite it and strip it on submit,
  // making hydrated rows look like new creates.
  const { fields, append, remove } = useFieldArray({ control, name: "upsells", keyName: "_fieldId" });
  const { data: tourOperatorsData = [] } = useTourOperators();

  const content = (
    <>
      <div className={bare ? "mb-1 flex items-center justify-end" : "mb-1 flex items-center justify-between"}>
        {!bare && <SectionHeader icon={PackagePlus} title="Upsells" />}
        {fields.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
            {fields.length} added
          </span>
        )}
      </div>
      <p className="mb-4 text-[11px] text-black/45">
        Extras added after the booking was made. Profit is recognised in the month added.
      </p>

      {fields.length === 0 && (
        <p className="py-2 text-center text-xs text-black/40">
          No upsells yet. Add extra nights, transfers or fees added after this booking was made.
        </p>
      )}

      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => {
            const value = field as typeof field & { upsellType: Parameters<typeof upsellTypeMeta>[0] };
            return (
              <UpsellRow
                key={field._fieldId}
                control={control}
                setValue={setValue}
                index={index}
                currentType={upsellTypeMeta(value.upsellType ?? "OTHER")}
                onRemove={() => remove(index)}
                tourOperators={tourOperatorsData}
              />
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3 h-8 gap-1.5 rounded-xl border-black/10 text-xs"
        onClick={() => append(emptyUpsellItem())}
        data-testid="button-add-upsell"
      >
        <Plus className="h-3.5 w-3.5" />
        Add Upsell
      </Button>
    </>
  );

  if (bare) return content;

  return <div className="rounded-2xl border border-black/10 bg-white/70 p-4">{content}</div>;
}
