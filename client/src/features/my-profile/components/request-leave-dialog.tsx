import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRequestMyLeave } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import type { LeaveType } from "@/features/hr/api/hr.api";

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "Annual", label: "Annual leave" },
  { value: "Sick",   label: "Sick leave" },
  { value: "Unpaid", label: "Unpaid leave" },
  { value: "Other",  label: "Other" },
];

const todayIso = () => new Date().toISOString().slice(0, 10);

export function RequestLeaveDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const request = useRequestMyLeave();
  const [type, setType] = useState<LeaveType>("Annual");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [reason, setReason] = useState("");

  const reset = () => {
    setType("Annual");
    setFrom(todayIso());
    setTo(todayIso());
    setReason("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (from > to) {
      toast({
        title: "Invalid dates",
        description: "'To' must be on or after 'From'.",
        variant: "destructive",
      });
      return;
    }
    request.mutate(
      { type, from, to, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          toast({
            title: "Leave requested",
            description: "Your manager has been notified.",
          });
          reset();
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({
            title: "Couldn't submit leave request",
            description: err?.response?.data?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-md" data-testid="dialog-request-leave">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Request leave</DialogTitle>
            <DialogDescription>
              Your manager will review and approve or reject the request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="leave-type">Type</Label>
            <select
              id="leave-type"
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              data-testid="select-leave-type"
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="leave-from">From</Label>
              <Input
                id="leave-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
                data-testid="input-leave-from"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leave-to">To</Label>
              <Input
                id="leave-to"
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                required
                data-testid="input-leave-to"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leave-reason">Reason (optional)</Label>
            <Textarea
              id="leave-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="A short note for your manager"
              rows={3}
              maxLength={2000}
              data-testid="input-leave-reason"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={request.isPending}
              data-testid="button-leave-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={request.isPending} data-testid="button-leave-submit">
              {request.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit request"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
