import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type PresetKey = "this-month" | "last-month" | "last-90d" | "ytd" | "last-year";

function preset(key: PresetKey): { from: string; to: string } {
  const now = new Date();
  switch (key) {
    case "this-month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: iso(from), to: iso(now) };
    }
    case "last-month": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: iso(from), to: iso(to) };
    }
    case "last-90d": {
      const from = new Date(now);
      from.setDate(from.getDate() - 89);
      return { from: iso(from), to: iso(now) };
    }
    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { from: iso(from), to: iso(now) };
    }
    case "last-year": {
      const from = new Date(now.getFullYear() - 1, 0, 1);
      const to = new Date(now.getFullYear() - 1, 11, 31);
      return { from: iso(from), to: iso(to) };
    }
  }
}

export function DateRangePicker({ from, to, onChange }: DateRangePickerProps) {
  const apply = (key: PresetKey) => {
    const r = preset(key);
    onChange(r.from, r.to);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <DatePicker
          value={from}
          onChange={(v) => onChange(v, to)}
          placeholder="From"
          data-testid="reports-date-from"
          className="w-[150px]"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <DatePicker
          value={to}
          onChange={(v) => onChange(from, v)}
          placeholder="To"
          data-testid="reports-date-to"
          className="w-[150px]"
        />
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" data-testid="reports-date-presets">
            <Calendar className="mr-1 h-3.5 w-3.5" />
            Presets
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => apply("this-month")}>This month</DropdownMenuItem>
          <DropdownMenuItem onClick={() => apply("last-month")}>Last month</DropdownMenuItem>
          <DropdownMenuItem onClick={() => apply("last-90d")}>Last 90 days</DropdownMenuItem>
          <DropdownMenuItem onClick={() => apply("ytd")}>Year to date</DropdownMenuItem>
          <DropdownMenuItem onClick={() => apply("last-year")}>Last year</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
