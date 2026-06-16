import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function SpecRow({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: React.ReactNode;
}) {
  const valueEl = (
    <div
      className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-black"
      data-testid={`text-itinerary-${testId}-value`}
    >
      {value}
    </div>
  );

  return (
    <div
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
      data-testid={`row-itinerary-${testId}`}
    >
      <div className="shrink-0 text-xs font-semibold text-black/65" data-testid={`text-itinerary-${testId}-label`}>
        {label}
      </div>
      {typeof value === "string" && value ? (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>{valueEl}</TooltipTrigger>
          <TooltipContent className="max-w-[280px] break-words">{value}</TooltipContent>
        </Tooltip>
      ) : (
        valueEl
      )}
    </div>
  );
}
