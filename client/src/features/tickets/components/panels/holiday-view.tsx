import { OperatorTile } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { KvGrid, RefRows, type KvItem } from "./panel-parts";

export interface HolidayViewModel {
  title: string;
  /** Under the title: location and operator. */
  subtitle: string | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  /** Small status chip next to the title block, e.g. "Confirmed". */
  status: string | null;
  refs: Array<[string, string]>;
  fields: KvItem[];
}

/** Operator tile and title, reference rows, then the key / value grid. */
export function HolidayView({ model, className }: { model: HolidayViewModel; className?: string }) {
  return (
    <div className={cn("pt-3.5", className)} data-testid="ticket-holiday-view">
      <div className="flex items-start gap-3 px-[18px] pb-2.5">
        <OperatorTile name={model.operatorName} logoUrl={model.operatorLogoUrl} size={46} />
        <div className="min-w-0 flex-1">
          <div className="text-[16px] font-semibold leading-[1.3]">{model.title}</div>
          {model.subtitle && <div className="text-[12px] text-social-muted">{model.subtitle}</div>}
          {model.status && (
            <span className="mt-1.5 inline-flex rounded-md bg-status-scheduled-bg px-2 py-0.5 text-[11.5px] font-semibold text-status-scheduled-fg">
              {model.status}
            </span>
          )}
        </div>
      </div>
      <RefRows refs={model.refs} />
      <KvGrid items={model.fields} />
    </div>
  );
}
