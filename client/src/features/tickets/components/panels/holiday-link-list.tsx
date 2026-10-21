import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OperatorTile } from "@/features/pipeline";
import { filterHolidayOptions, groupHolidayOptions, holidayOptionSubline, type HolidayOption } from "../../lib/holiday-groups";

/** The client's holidays grouped Bookings / Quotes / Enquiries, each row with a Link button. */
export function HolidayLinkList({
  options,
  linkingId,
  onLink,
}: {
  options: HolidayOption[];
  linkingId: string | null;
  onLink: (transactionId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => groupHolidayOptions(filterHolidayOptions(options, query)), [options, query]);

  if (options.length === 0) return <div className="text-[12px] text-social-muted">No holidays on file for this client.</div>;

  return (
    <div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-social-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search holidays or refs"
          className="h-9 rounded-[10px] border-social-border bg-card pl-9 text-[13px]"
          data-testid="ticket-holiday-search"
        />
      </div>
      {groups.length === 0 && <div className="text-[12px] text-social-muted">No holidays match.</div>}
      {groups.map((g) => (
        <div key={g.kind} className="mb-3.5">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">
            {g.heading} · {g.options.length}
          </div>
          <div className="flex flex-col gap-2">
            {g.options.map((o) => {
              const sub = holidayOptionSubline(o);
              return (
                <div key={o.id} className="flex items-center gap-2.5 rounded-xl border border-social-border px-3 py-2" data-testid={`ticket-holiday-option-${o.id}`}>
                  <OperatorTile name={o.operatorName ?? o.title} logoUrl={o.operatorLogoUrl} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{o.title}</div>
                    {sub && <div className="truncate text-[12px] text-social-muted">{sub}</div>}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 rounded-[10px] border-social-border bg-card px-3.5 text-[12.5px]"
                    disabled={linkingId !== null}
                    onClick={() => onLink(o.id)}
                    data-testid={`ticket-link-holiday-${o.id}`}
                  >
                    {linkingId === o.id ? "Linking…" : "Link"}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
