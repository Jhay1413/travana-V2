import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { FormDrawerSection, drawerInputClass, drawerLabelClass } from "@/components/shared/form-drawer";
import { useTourOperators } from "@/hooks/queries";
import { operatorCommissionPct, recomputePricing, type PricingField } from "@/features/quote/lib/pricing";
import { cn } from "@/lib/utils";
import type { SharedHolidayFormValues } from "@/features/quote/types";

const PRICE_FIELDS: { name: PricingField; label: string }[] = [
  { name: "price", label: "Total Price" },
  { name: "discount", label: "Discount" },
  { name: "serviceCharge", label: "Serv Charge" },
];

const round2 = (n: number) => parseFloat(n.toFixed(2));

function PoundInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/70">£</span>
      <Input type="number" step="0.01" min={0} className={cn(drawerInputClass, "pl-7", className)} {...props} />
    </div>
  );
}

/**
 * "Costings" drawer section: Total Price · Commission · Discount · Serv Charge
 * · Total Profit.
 *
 * The stored `commission` field is already net (operator commission − discount
 * + service charge), and that net figure is what the rest of the app calls
 * profit. So the drawer shows the stored value as "Total Profit" and exposes
 * the gross operator commission (stored + discount − service charge) as the
 * editable "Commission" — the same split the card layout's breakdown line
 * prints.
 */
export function QuoteDrawerCostingsSection() {
  const { control, getValues, setValue } = useFormContext<SharedHolidayFormValues>();
  const { data: tourOperatorsData } = useTourOperators();
  const [price, commission, discount, serviceCharge, pricePerPerson] = useWatch({
    control,
    name: ["price", "commission", "discount", "serviceCharge", "pricePerPerson"],
  });

  const netCommission = Number(commission) || 0;
  const currentDiscount = Number(discount) || 0;
  const currentServiceCharge = Number(serviceCharge) || 0;
  const grossCommission = round2(netCommission + currentDiscount - currentServiceCharge);
  const finalTotal = (Number(price) || 0) - currentDiscount + currentServiceCharge;

  // What the user is typing into the gross-commission box. Held as text while
  // the box has focus so a trailing "." or "0" isn't eaten by the re-render
  // that follows every keystroke (the box shows a value derived from the form).
  const [grossDraft, setGrossDraft] = useState<string | null>(null);

  const handleGrossCommissionChange = (raw: string) => {
    setGrossDraft(raw);
    const gross = parseFloat(raw) || 0;
    setValue("commission", round2(gross - currentDiscount + currentServiceCharge), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handlePriceFieldChange = (field: PricingField, raw: string, onChange: (v: unknown) => void) => {
    // Snapshot BEFORE the field updates so the no-operator path can diff the
    // old and new discount / service charge.
    const operatorId = getValues("tourOperatorId");
    const op = operatorId ? tourOperatorsData?.find((o: { id: string }) => o.id === operatorId) : undefined;
    const result = recomputePricing(field, parseFloat(raw) || 0, {
      price: Number(getValues("price")) || 0,
      discount: Number(getValues("discount")) || 0,
      serviceCharge: Number(getValues("serviceCharge")) || 0,
      commission: Number(getValues("commission")) || 0,
      adults: Number(getValues("passengersAdults")) || 0,
      children: Number(getValues("passengersChildren")) || 0,
      operatorCommissionPct: operatorCommissionPct(op),
    });
    onChange(raw);
    if (result.commission != null) {
      setValue("commission", result.commission, { shouldValidate: true, shouldDirty: true });
    }
    setValue("pricePerPerson", result.pricePerPerson);
  };

  const [priceField, discountField, serviceChargeField] = PRICE_FIELDS;

  const renderPriceField = ({ name, label }: { name: PricingField; label: string }) => (
    <FormField
      key={name}
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="space-y-1.5">
          <FormLabel className={drawerLabelClass}>{label}</FormLabel>
          <FormControl>
            <PoundInput
              {...field}
              onChange={(e) => handlePriceFieldChange(name, e.target.value, field.onChange)}
              data-testid={`drawer-costing-${name}`}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <FormDrawerSection title="Costings" data-testid="drawer-section-costings">
      <div className="grid grid-cols-5 gap-x-5 gap-y-4">
        {renderPriceField(priceField)}

        <div className="space-y-1.5">
          <label htmlFor="drawer-costing-gross-commission" className={cn("block", drawerLabelClass)}>
            Commission
          </label>
          <PoundInput
            id="drawer-costing-gross-commission"
            value={grossDraft ?? String(grossCommission)}
            onFocus={() => setGrossDraft(String(grossCommission))}
            onBlur={() => setGrossDraft(null)}
            onChange={(e) => handleGrossCommissionChange(e.target.value)}
            data-testid="drawer-costing-commission"
          />
        </div>

        {renderPriceField(discountField)}
        {renderPriceField(serviceChargeField)}

        <div className="space-y-1.5">
          <span className={cn("block", drawerLabelClass)}>Total Profit</span>
          <div
            className={cn(drawerInputClass, "flex items-center bg-[#eef0f3] text-black/75")}
            data-testid="drawer-total-profit"
          >
            £{netCommission.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-black/55" data-testid="drawer-costing-summary">
        <span>
          Final total <span className="font-semibold text-black/80">£{finalTotal.toFixed(2)}</span>
        </span>
        <span>
          Per person <span className="font-semibold text-black/80">£{(Number(pricePerPerson) || 0).toFixed(2)}</span>
        </span>
      </div>
    </FormDrawerSection>
  );
}
