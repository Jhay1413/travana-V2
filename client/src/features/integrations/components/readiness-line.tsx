import { readinessReasonText, readinessTone } from "../lib/readiness-text";
import type { PurposeReadiness } from "../types";

interface ReadinessLineProps {
  readiness: PurposeReadiness | undefined;
  /** Test id prefix, e.g. "auto-booking_confirmation". */
  testId: string;
}

/** One line under a message type's description: green "Ready", red "Not being sent: why", or grey "Switched off". */
export function ReadinessLine({ readiness, testId }: ReadinessLineProps) {
  const tone = readinessTone(readiness);
  if (!readiness || !tone) return null;
  if (tone === "ready") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-status-scheduled-fg xl:text-[13px]" data-testid={`${testId}-status`} data-state="ready">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        Ready
        {readiness.note === "no_template_outside_window" && (
          <span className="font-normal text-social-muted"> · no template chosen, so customers outside the 24-hour window won't get it</span>
        )}
      </p>
    );
  }
  if (tone === "off") {
    return (
      <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-social-muted xl:text-[13px]" data-testid={`${testId}-status`} data-state="off">
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
        Switched off. Turn it on from the matching text message in SMS templates.
      </p>
    );
  }
  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-destructive xl:text-[13px]" data-testid={`${testId}-status`} data-state="not-sent" role="status">
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      Not being sent: {readinessReasonText(readiness.reason ?? "no_template")}
    </p>
  );
}
