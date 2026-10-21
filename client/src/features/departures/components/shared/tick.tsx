import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export const TICK_BOX = "h-5 w-5 rounded-md border-2 border-social-muted data-[state=checked]:border-social-navy data-[state=checked]:bg-social-navy";

/** A tick box with a 40px hit area. A disabled one explains why in its tooltip and accessible name. */
export function Tick({
  checked,
  onChange,
  label,
  disabled,
  title,
  testId,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
  testId?: string;
}) {
  return (
    <span
      title={title}
      className={cn("inline-grid h-10 w-10 place-items-center rounded-[10px]", disabled ? "cursor-not-allowed" : "hover:bg-muted")}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange(v === true)}
        aria-label={disabled && title ? `${label}. ${title}` : label}
        className={TICK_BOX}
        data-testid={testId}
      />
    </span>
  );
}
