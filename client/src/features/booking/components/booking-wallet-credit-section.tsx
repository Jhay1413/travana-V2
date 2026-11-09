import { useWatch } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/features/wallet/api/wallet.api";
import { Button } from "@/components/ui/button";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { fmInputClass, fmLabelClass } from "@/features/quote/components/fm-classes";
import type { BookingFormValues } from "@/features/booking/types";

interface BookingWalletCreditSectionProps {
  clientId: string;
  control: Control<BookingFormValues>;
  setValue: UseFormSetValue<BookingFormValues>;
}

/** Allocate part of the client wallet balance to this booking. */
export function BookingWalletCreditSection({ clientId, control, setValue }: BookingWalletCreditSectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["wallet-balance", clientId],
    queryFn: () => walletApi.getBalance(clientId),
    enabled: !!clientId,
  });

  const available = parseFloat(data ?? "0");
  const allocatedAmount = useWatch({ control, name: "walletCreditAmount" });

  if (isLoading) return <div className="h-8 w-48 animate-pulse rounded-xl bg-black/5" />;
  if (available <= 0) return <p className="text-xs text-black/40">No wallet balance available for this client.</p>;

  return (
    <>
      <div className="mb-3 flex items-center justify-between rounded-xl border border-black/8 bg-black/[0.02] px-3 py-2">
        <span className="text-xs text-black/50">Available balance</span>
        <span className="text-sm font-semibold text-black/80">£{available.toFixed(2)}</span>
      </div>
      <FormField
        control={control}
        name="walletCreditAmount"
        render={({ field }) => (
          <FormItem>
            <FormLabel className={fmLabelClass}>Amount to allocate (£)</FormLabel>
            <div className="flex items-center gap-2">
              <FormControl>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  max={available}
                  placeholder="0.00"
                  {...field}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    field.onChange(Math.min(val, available));
                  }}
                  className={fmInputClass}
                />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-[42px] shrink-0 rounded-[10px] text-xs"
                onClick={() => setValue("walletCreditAmount", available, { shouldDirty: true })}
              >
                Use all
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />
      {Number(allocatedAmount) > 0 && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-50/50 p-3 text-xs text-emerald-800">
          £{Number(allocatedAmount).toFixed(2)} will be applied as a booking credit when saved.
        </div>
      )}
    </>
  );
}
