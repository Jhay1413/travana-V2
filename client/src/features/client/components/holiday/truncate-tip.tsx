import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * One-line text cut off with "…" when it does not fit, with the full text in a tooltip on hover/focus.
 *
 * Props:
 * - text: the full text (shown in the tooltip).
 * - children: optional rich content for the line itself; defaults to `text`.
 * - className: classes for the line (font, colour); `truncate` and `min-w-0` are always applied.
 * - as: "span" (inline-block) or "div" (block).
 */
export function TruncateTip({
  text,
  children,
  className,
  as = "span",
  testId,
}: {
  text: string;
  children?: ReactNode;
  className?: string;
  as?: "span" | "div";
  testId?: string;
}) {
  const Tag = as;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Tag className={cn("block min-w-0 truncate", className)} data-testid={testId}>
          {children ?? text}
        </Tag>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs break-words">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
