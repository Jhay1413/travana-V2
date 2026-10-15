import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrganization } from "@/features/organization/api/use-organization-queries";
import { MAX_NAME_LENGTH } from "../lib/invite-body";
import { defaultShareToInput, validateProfitShare } from "../lib/profit-share";

/**
 * Profit-share input state pre-filled from the organisation default
 * (homeworkerCommission). Untouched means "follow the default", so the value
 * appears as soon as the org loads without an effect.
 */
export function useShareInput(initial?: string) {
  const { data: org } = useCurrentOrganization();
  const orgDefault = defaultShareToInput(org?.homeworkerCommission);
  const [touched, setTouched] = useState<string | null>(initial ?? null);
  const value = touched ?? orgDefault;
  return {
    value,
    setValue: (v: string) => setTouched(v),
    reset: () => setTouched(initial ?? null),
    error: validateProfitShare(value),
    orgDefault,
  };
}

interface Props {
  share: string;
  onShareChange: (v: string) => void;
  shareError: string | null;
  displayName: string;
  onDisplayNameChange: (v: string) => void;
  disabled?: boolean;
  showDisplayName?: boolean;
}

export function HomeworkerInviteFields({
  share,
  onShareChange,
  shareError,
  displayName,
  onDisplayNameChange,
  disabled,
  showDisplayName = true,
}: Props) {
  return (
    <>
      {showDisplayName && (
        <div className="space-y-1.5">
          <Label>Branch display name (optional)</Label>
          <Input
            value={displayName}
            onChange={(e) => onDisplayNameChange(e.target.value)}
            placeholder="Defaults to their name once they accept"
            maxLength={MAX_NAME_LENGTH}
            disabled={disabled}
            data-testid="input-invite-display-name"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label>Profit share %</Label>
        <Input
          inputMode="decimal"
          value={share}
          onChange={(e) => onShareChange(e.target.value)}
          placeholder="e.g. 70"
          disabled={disabled}
          aria-invalid={shareError ? true : undefined}
          data-testid="input-invite-profit-share"
        />
        {shareError && <p className="text-xs text-rose-600">{shareError}</p>}
        <p className="text-xs text-slate-500">
          Homeworkers get their own branch. Share is pre-filled from your agency default.
        </p>
      </div>
    </>
  );
}
