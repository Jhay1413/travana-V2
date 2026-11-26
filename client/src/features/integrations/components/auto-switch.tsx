import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useSetMessageSwitch } from "../api/use-customer-messaging";
import { apiErrorMessage } from "../lib/whatsapp-channels";
import type { AutoMessagePurpose, PurposeReadiness } from "../types";

interface AutoSwitchProps {
  purpose: AutoMessagePurpose;
  readiness: PurposeReadiness | undefined;
  /** Test id prefix, e.g. "auto-booking_confirmation". */
  testId: string;
}

/**
 * The on/off switch of a message type, on both channels. It is the active flag of the agency's text message for the
 * type, so turning it on here also turns the text on if the agency later switches back to SMS.
 */
export function AutoSwitch({ purpose, readiness, testId }: AutoSwitchProps) {
  const { toast } = useToast();
  const setSwitch = useSetMessageSwitch(purpose);
  if (!readiness) return null;

  const change = async (active: boolean) => {
    try {
      await setSwitch.mutateAsync(active);
      toast({ title: active ? "Switched on" : "Switched off" });
    } catch (err) {
      toast({ title: "Couldn't change it", description: apiErrorMessage(err), variant: "destructive" });
    }
  };

  return (
    <label className="mt-2 flex items-center gap-2 text-[12px] font-medium xl:text-[13px]">
      <Switch checked={readiness.switchedOn} disabled={setSwitch.isPending} onCheckedChange={(v) => void change(v)} aria-label="Send this message" data-testid={`${testId}-switch`} />
      Send this message
    </label>
  );
}
