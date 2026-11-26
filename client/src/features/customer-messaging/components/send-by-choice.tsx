import { Loader2 } from "lucide-react";
import { SEGMENT_ITEM, SEGMENTED } from "@/components/ui/segmented";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SEND_CHANNELS } from "../lib/send-by";
import type { SendAvailability, SendChannel } from "../types";

interface SendByChoiceProps {
  availability: SendAvailability | undefined;
  loading?: boolean;
  /** The channel currently selected (already resolved: see effectiveChannel). */
  value: SendChannel;
  onChange: (channel: SendChannel) => void;
  disabled?: boolean;
  testId?: string;
}

/**
 * "Send by: WhatsApp / SMS". An option that cannot be used is disabled and says why: on hover and keyboard focus
 * (title + focusable wrapper) and as helper text under the control, which is what a touch screen shows.
 */
export function SendByChoice({ availability, loading = false, value, onChange, disabled = false, testId = "send-by" }: SendByChoiceProps) {
  const unavailable = SEND_CHANNELS.filter((c) => availability && !availability.channels[c.value].available);
  const noted = SEND_CHANNELS.filter((c) => availability?.channels[c.value].available && availability.channels[c.value].note);
  return (
    <div className="min-w-0" data-testid={testId}>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-social-muted">Send by</span>
        <ToggleGroup
          type="single"
          value={value}
          aria-label="Send by"
          disabled={disabled}
          onValueChange={(next) => {
            const match = SEND_CHANNELS.find((c) => c.value === next);
            if (match && availability?.channels[match.value].available) onChange(match.value);
          }}
          className={`${SEGMENTED} h-8`}
        >
          {SEND_CHANNELS.map((c) => {
            const state = availability?.channels[c.value];
            const blocked = !!availability && state?.available === false;
            return (
              <span
                key={c.value}
                title={blocked ? state?.reason : undefined}
                tabIndex={blocked ? 0 : -1}
                aria-label={blocked ? `${c.label} unavailable: ${state?.reason ?? ""}` : undefined}
                className="flex h-full"
                data-testid={`${testId}-${c.value}-wrap`}
              >
                <ToggleGroupItem value={c.value} disabled={blocked || !availability} className={`${SEGMENT_ITEM} px-3 text-[12px]`} data-testid={`${testId}-${c.value}`}>
                  {c.label}
                </ToggleGroupItem>
              </span>
            );
          })}
        </ToggleGroup>
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-black/40" aria-label="Checking channels" />}
      </div>
      {noted.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-social-muted" data-testid={`${testId}-notes`}>
          {noted.map((c) => (
            <li key={c.value} data-testid={`${testId}-note-${c.value}`}>
              <span className="font-semibold">{c.label}:</span> {availability?.channels[c.value].note}
            </li>
          ))}
        </ul>
      )}
      {unavailable.length > 0 && (
        <ul className="mt-1.5 space-y-0.5 text-[11px] leading-snug text-social-muted" data-testid={`${testId}-helper`}>
          {unavailable.map((c) => (
            <li key={c.value} data-testid={`${testId}-reason-${c.value}`}>
              <span className="font-semibold">{c.label}:</span> {availability?.channels[c.value].reason}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
