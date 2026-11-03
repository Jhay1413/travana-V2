import { cn } from "@/lib/utils";
import { gbp } from "../../lib/money";

export interface AllocSlice {
  name: string;
  value: number;
  /** Tailwind background class for the swatch and bar segment. */
  colour: string;
}

/** How the business target is split across shops and homeworkers. */
export function AllocBar({ slices, total }: { slices: AllocSlice[]; total: number }) {
  const used = slices.reduce((s, x) => s + x.value, 0);
  const denom = Math.max(total, used) || 1;
  return (
    <div>
      <div className="flex h-7 overflow-hidden rounded-full bg-social-border" role="img" aria-label="How the business target is split across shops and homeworkers">
        {slices.map((s) => (
          <div key={s.name} title={s.name} className={cn("border-r-2 border-card last:border-r-0", s.colour)} style={{ width: `${(s.value / denom) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-2 text-[13px]">
            <span className={cn("h-3 w-3 rounded-[3px]", s.colour)} />
            <b className="font-semibold">{s.name}</b>
            <span className="text-social-muted">
              {gbp(s.value)} · {((s.value / (total || denom)) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
