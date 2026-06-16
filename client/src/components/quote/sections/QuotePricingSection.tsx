import { useFormContext, useWatch } from "react-hook-form";
import { DollarSign } from "lucide-react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useTourOperators } from "@/hooks/queries";
import { SectionHeader } from "@/components/quote/sections/SectionHeader";
import type { QuoteFormValues } from "@/types/quote";

const FIELDS = [
  { name: "price", label: "Total Price (£)" },
  { name: "commission", label: "Commission (£)" },
  { name: "discount", label: "Discount (£)" },
  { name: "serviceCharge", label: "Service Charge (£)" },
  { name: "pricePerPerson", label: "Price Per Person (£)" },
] as const;

export function QuotePricingSection() {
  const { control, getValues, setValue } = useFormContext<QuoteFormValues>();
  const { data: tourOperatorsData } = useTourOperators();
  const price = useWatch({ control, name: "price" });
  const commission = useWatch({ control, name: "commission" });
  const discount = useWatch({ control, name: "discount" });
  const serviceCharge = useWatch({ control, name: "serviceCharge" });

  const currentPrice = Number(price) || 0;
  const currentDiscount = Number(discount) || 0;
  const currentServiceCharge = Number(serviceCharge) || 0;
  const currentCommission = Number(commission) || 0;
  const hasAdjustments = currentDiscount > 0 || currentServiceCharge > 0;
  // Total price = price − discount + service charge.
  const finalTotal = currentPrice - currentDiscount + currentServiceCharge;
  // The commission field already holds the total (operator % − discount + service charge);
  // recover the raw operator portion for the breakdown line.
  const operatorCommission = currentCommission + currentDiscount - currentServiceCharge;

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
      <SectionHeader icon={DollarSign} title="Pricing" />
      <div className="grid gap-3 md:grid-cols-3">
        {FIELDS.map(({ name, label }) => (
          <FormField
            key={name}
            control={control}
            name={name}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-black/60">{label}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.01"
                    {...field}
                    onChange={(e) => {
                      // Capture the previous discount / service charge BEFORE RHF updates them,
                      // so we can adjust commission by the delta when there is no operator base.
                      const prevDiscount = Number(getValues("discount")) || 0;
                      const prevServiceCharge = Number(getValues("serviceCharge")) || 0;
                      field.onChange(e);
                      if (name === "price" || name === "discount" || name === "serviceCharge") {
                        const nextPrice = name === "price" ? parseFloat(e.target.value) || 0 : Number(getValues("price")) || 0;
                        const nextDiscount = name === "discount" ? parseFloat(e.target.value) || 0 : prevDiscount;
                        const nextServiceCharge = name === "serviceCharge" ? parseFloat(e.target.value) || 0 : prevServiceCharge;

                        const currentOperatorId = getValues("tourOperatorId");
                        const op = currentOperatorId ? tourOperatorsData?.find((o: { id: string }) => o.id === currentOperatorId) : undefined;

                        if (op?.commission_percentage != null && nextPrice > 0) {
                          // Commission = price × operator % − discount + service charge.
                          const operatorCommission = (nextPrice * parseFloat(op.commission_percentage)) / 100;
                          const adjustedCommission = operatorCommission - nextDiscount + nextServiceCharge;
                          setValue("commission", parseFloat(adjustedCommission.toFixed(2)), { shouldValidate: true, shouldDirty: true });
                        } else if (name === "discount" || name === "serviceCharge") {
                          // No operator base to recompute from — adjust the existing commission by
                          // the change: discount is deducted, service charge is added.
                          const currentCommission = Number(getValues("commission")) || 0;
                          const delta = name === "discount" ? prevDiscount - nextDiscount : nextServiceCharge - prevServiceCharge;
                          setValue("commission", parseFloat((currentCommission + delta).toFixed(2)), { shouldValidate: true, shouldDirty: true });
                        }

                        const adults = Number(getValues("passengersAdults")) || 0;
                        const children = Number(getValues("passengersChildren")) || 0;
                        const total = adults + children;
                        // Total price = price − discount + service charge, split across passengers.
                        const netPrice = nextPrice - nextDiscount + nextServiceCharge;
                        setValue("pricePerPerson", total > 0 ? parseFloat((netPrice / total).toFixed(2)) : 0);
                      }
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    min={0}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ))}
      </div>
      {currentPrice > 0 && (
        <div className="mt-3 flex items-center justify-between rounded-xl border border-black/10 bg-black/[0.03] px-3 py-2">
          <span className="text-xs font-semibold text-black/65">Final Total</span>
          <span className="text-sm font-semibold text-black">£{finalTotal.toFixed(2)}</span>
        </div>
      )}
      {hasAdjustments && currentPrice > 0 && (
        <div className="mt-3 rounded-xl border border-blue-500/20 bg-blue-50/50 p-3">
          <div className="text-xs font-medium text-blue-900">Total Commission: £{currentCommission.toFixed(2)}</div>
          <div className="mt-1 text-[10px] text-blue-700/70">
            Commission: £{operatorCommission.toFixed(2)}{" "}
            {currentDiscount > 0 && `Discount: -£${currentDiscount.toFixed(2)} `}
            {currentServiceCharge > 0 && `Service Charge: +£${currentServiceCharge.toFixed(2)}`}
          </div>
        </div>
      )}
    </div>
  );
}
