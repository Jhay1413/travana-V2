import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SourceChip, type ChipKind } from "./source-chip";

const CONTROL =
  "h-[42px] w-full rounded-[10px] border border-input bg-background px-3 text-[14px] font-normal text-foreground";

export interface FieldBoxProps {
  label: string;
  /** Grid span: 2 takes the full row. */
  span?: 1 | 2;
  chip?: ChipKind | null;
  error?: string;
  /** Receives the shared control classes (height, radius, border, amber/red state). */
  children: (controlClass: string) => ReactNode;
}

/** Label row with source chip, the control, and an error line. */
export function FieldBox({
  label,
  span = 1,
  chip = null,
  error,
  children,
}: FieldBoxProps) {
  const amber = chip === "check";
  const controlClass = cn(
    CONTROL,
    amber &&
      "border-amber-400 bg-[#FFFBEB] dark:border-amber-500/60 dark:bg-amber-950/30",
    error && "border-red-400 dark:border-red-500/70",
  );
  return (
    <div className={cn("min-w-0", span === 2 && "col-span-2")}>
      <div className="mb-1 flex min-h-[18px] items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-social-muted">
          {label}
        </span>
        {chip && <SourceChip kind={chip} />}
      </div>
      {children(controlClass)}
      {error && (
        <p className="mt-1 text-[12px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
