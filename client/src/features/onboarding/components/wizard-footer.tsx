import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ERROR_TEXT, MUTED_LINK_BUTTON, OUTLINE_BUTTON, PRIMARY_BUTTON } from "./styles";

interface WizardFooterProps {
  onBack?: () => void;
  skipLabel?: string;
  onSkip?: () => void;
  primaryLabel: ReactNode;
  busy?: boolean;
  primaryDisabled?: boolean;
  /** Form-level message, e.g. "Add at least one shop, or skip for now." */
  error?: string | null;
  className?: string;
}

/** Back on the left; Skip + the main action on the right. The main action submits the surrounding form. */
export function WizardFooter({
  onBack,
  skipLabel,
  onSkip,
  primaryLabel,
  busy,
  primaryDisabled,
  error,
  className,
}: WizardFooterProps) {
  return (
    <div className={cn("mt-7", className)}>
      {error && (
        <p role="alert" className={cn(ERROR_TEXT, "mb-3 text-right text-[13px]")}>
          {error}
        </p>
      )}
      <div className={cn("flex items-center", onBack ? "justify-between" : "justify-end")}>
        {onBack && (
          <Button type="button" variant="outline" className={OUTLINE_BUTTON} onClick={onBack} disabled={busy}>
            &larr; Back
          </Button>
        )}
        <div className="flex items-center gap-5">
          {skipLabel && onSkip && (
            <button type="button" className={MUTED_LINK_BUTTON} onClick={onSkip} disabled={busy}>
              {skipLabel}
            </button>
          )}
          <Button type="submit" className={PRIMARY_BUTTON} disabled={busy || primaryDisabled}>
            {primaryLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
