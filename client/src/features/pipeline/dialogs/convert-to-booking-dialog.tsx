import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { transactionKeys } from "@/hooks/queries";
import { useConvertToBooking } from "@/hooks/mutations";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

const FIELD = "h-10 rounded-[10px] border-social-border bg-card text-[13px]";

/** "Move to Booked": collects the HAYS and tour references and converts the quote. */
export function ConvertToBookingDialog({ quoteId, onClose }: { quoteId: string | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const convertToBooking = useConvertToBooking();
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");

  const close = () => {
    setHaysRef("");
    setTourRef("");
    onClose();
  };

  return (
    <Dialog open={!!quoteId} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-sm rounded-2xl border-social-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Convert to Booking</DialogTitle>
          <DialogDescription className="text-[13px] text-social-muted">Enter the booking references to confirm.</DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-social-muted">HAYS Reference</Label>
            <Input value={haysRef} onChange={(e) => setHaysRef(e.target.value)} placeholder="e.g. HAYS-12345" className={FIELD} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-social-muted">Tour Reference</Label>
            <Input value={tourRef} onChange={(e) => setTourRef(e.target.value)} placeholder="e.g. TOUR-67890" className={FIELD} />
          </div>
          <Button
            className={PRIMARY_ACTION}
            disabled={convertToBooking.isPending}
            data-testid="button-convert-to-booking"
            onClick={() => {
              if (!quoteId) return;
              convertToBooking.mutate(
                { quoteId, haysRef, supplierRef: tourRef },
                {
                  onSuccess: () => {
                    close();
                    void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
                    toast({ title: "Converted to booking" });
                  },
                  onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
                },
              );
            }}
          >
            {convertToBooking.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
