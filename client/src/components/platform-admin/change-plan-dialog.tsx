import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChangeOrgPlan } from "@/hooks/mutations";
import type { ChangePlanPayload } from "@/api/endpoints/platform-admin.api";

const PLAN_OPTIONS: ChangePlanPayload["plan"][] = ["starter", "growth", "pro", "enterprise"];

interface Props {
  orgId:           string | null;
  orgName:         string;
  currentPlan:     string | null;
  currentSeatLimit: number | null;
  open:    boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePlanDialog({ orgId, orgName, currentPlan, currentSeatLimit, open, onOpenChange }: Props) {
  const [plan, setPlan]           = useState<ChangePlanPayload["plan"]>("starter");
  const [seatLimit, setSeatLimit] = useState<string>("");
  const [error, setError]         = useState<string | null>(null);
  const changePlan = useChangeOrgPlan();

  useEffect(() => {
    if (!open) return;
    const initial = PLAN_OPTIONS.includes(currentPlan as ChangePlanPayload["plan"])
      ? (currentPlan as ChangePlanPayload["plan"])
      : "starter";
    setPlan(initial);
    setSeatLimit(currentSeatLimit != null ? String(currentSeatLimit) : "");
    setError(null);
  }, [open, currentPlan, currentSeatLimit]);

  const handleSave = async () => {
    if (!orgId) return;
    const payload: ChangePlanPayload = { plan };
    if (seatLimit.trim() !== "") {
      const n = Number(seatLimit);
      if (!Number.isInteger(n) || n <= 0) {
        setError("Seat limit must be a positive whole number.");
        return;
      }
      payload.seatLimit = n;
    }
    setError(null);
    try {
      await changePlan.mutateAsync({ orgId, payload });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to change plan");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-change-plan">
        <DialogHeader>
          <DialogTitle>Change plan — {orgName}</DialogTitle>
          <DialogDescription>
            Update the subscription plan and optional seat limit. This action is recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Plan</label>
            <Select value={plan} onValueChange={(v) => setPlan(v as ChangePlanPayload["plan"])}>
              <SelectTrigger data-testid="select-plan">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PLAN_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Seat limit (optional)</label>
            <Input
              type="number"
              min={1}
              value={seatLimit}
              onChange={(e) => setSeatLimit(e.target.value)}
              placeholder="Leave blank to keep current"
              data-testid="input-seat-limit"
            />
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={changePlan.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={changePlan.isPending} data-testid="button-confirm-change-plan">
            {changePlan.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
