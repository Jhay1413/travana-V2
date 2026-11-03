import type { ComponentPropsWithoutRef } from "react";
import { FormLabel } from "@/components/ui/form";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface FormLabelTooltipProps extends ComponentPropsWithoutRef<typeof FormLabel> {
  /** Help text shown when hovering the label. */
  tip: string;
}

/**
 * A `FormLabel` that shows a hover tooltip. Same pattern as the enquiry wizard's
 * Flexibility / Min. Star Rating labels (Tooltip + TooltipTrigger asChild + cursor-help),
 * with its own `TooltipProvider` so it works wherever the form is mounted.
 */
export function FormLabelTooltip({ tip, className, children, ...props }: FormLabelTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <FormLabel className={cn("cursor-help", className)} {...props}>
            {children}
          </FormLabel>
        </TooltipTrigger>
        <TooltipContent>{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
