import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Control, UseFormSetValue } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useReconcileUpsells } from "@/hooks/mutations";
import { useBooking } from "@/hooks/queries";
import { BookingUpsellsSection } from "./BookingUpsellsSection";
import { bookingFormSchema, upsellsToFormValues } from "@/features/booking/types";
import type { UpsellsFormValues, UpsellRecord } from "@/features/booking/types";

// Standalone form holding only the `upsells` array — reuses the booking form's
// upsell schema so validation/shape stays in lockstep with the in-form section.
const upsellsOnlySchema = z.object({ upsells: bookingFormSchema.shape.upsells });

interface BookingUpsellsDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BookingUpsellsDialog({
  bookingId,
  open,
  onOpenChange,
  onSuccess,
}: BookingUpsellsDialogProps) {
  const { toast } = useToast();
  const { reconcile, isPending: isSaving } = useReconcileUpsells();
  const { data: bookingData, isLoading, isError } = useBooking(bookingId);

  const form = useForm<UpsellsFormValues>({
    resolver: zodResolver(upsellsOnlySchema),
    defaultValues: { upsells: [] },
  });

  // Re-hydrate from the booking's existing upsells whenever it loads or the
  // dialog re-opens, so the rows reflect what's currently saved.
  useEffect(() => {
    if (open && bookingData) {
      form.reset({ upsells: upsellsToFormValues((bookingData as any).upsells) });
    }
  }, [open, bookingData, form]);

  const handleSubmit = async (values: UpsellsFormValues) => {
    const existing: UpsellRecord[] = ((bookingData as any)?.upsells ?? []) as UpsellRecord[];
    try {
      await reconcile(bookingId, values.upsells, existing);
      toast({ title: "Upsells updated", description: "Changes saved successfully." });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Failed to update upsells",
        description: err instanceof Error ? err.message : "Something went wrong.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-lg font-semibold">Manage Upsells</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Add extras sold after this booking was made. Each upsell's profit is recognised in the month it was added.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <div className="px-6 pb-2">
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Spinner className="h-6 w-6" />
              </div>
            )}
            {isError && (
              <div className="py-12 text-center text-sm text-red-500">
                Failed to load booking data.
              </div>
            )}
            {!isLoading && !isError && bookingData && (
              <Form {...form}>
                <form id="upsells-form" onSubmit={form.handleSubmit(handleSubmit)}>
                  <BookingUpsellsSection
                    control={form.control as unknown as Control<UpsellsFormValues>}
                    setValue={form.setValue as unknown as UseFormSetValue<UpsellsFormValues>}
                  />
                </form>
              </Form>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 border-t border-black/10 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            data-testid="button-upsells-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="upsells-form"
            className="rounded-xl"
            disabled={isSaving || isLoading || isError}
            data-testid="button-upsells-save"
          >
            {isSaving ? "Saving…" : "Save Upsells"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
