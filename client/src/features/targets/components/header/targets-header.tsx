import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PRIMARY_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { yearOptions } from "../../lib/routes";
import { TARGETS_CONTROL } from "../shared/targets-styles";

interface TargetsHeaderProps {
  title: string;
  subtitle: string;
  year: number;
  currentYear: number;
  onYear?: (year: number) => void;
  onAllocate?: () => void;
  right?: ReactNode;
}

/** Title and subtitle on the left; year picker and "Allocate targets" on the right. No box. */
export function TargetsHeader({ title, subtitle, year, currentYear, onYear, onAllocate, right }: TargetsHeaderProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      <div className="min-w-[240px] flex-1">
        <h1 className="text-[22px] font-semibold leading-[1.2] xl:text-[24px]" data-testid="targets-title">
          {title}
        </h1>
        <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]" data-testid="targets-subtitle">
          {subtitle}
        </p>
      </div>
      {onYear && (
        <Select value={String(year)} onValueChange={(v) => onYear(Number(v))}>
          <SelectTrigger className={cn(TARGETS_CONTROL, "w-[120px]")} aria-label="Year" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from(new Set([...yearOptions(currentYear), year]))
              .sort((a, b) => a - b)
              .map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}
      {right}
      {onAllocate && (
        <Button type="button" className={PRIMARY_ACTION} onClick={onAllocate} data-testid="button-allocate">
          Allocate targets
        </Button>
      )}
    </div>
  );
}
