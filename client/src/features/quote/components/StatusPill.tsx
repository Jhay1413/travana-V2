import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "quoted", label: "Quoted" },
  { value: "in_play", label: "In Play" },
  { value: "lost", label: "Lost" },
  { value: "archived", label: "Archived" },
];

function getStyles(status: string) {
  if (status === "in_play")
    return "border-amber-500/20 bg-amber-500/10 text-amber-900 hover:bg-amber-500/15";
  if (status === "lost")
    return "border-rose-500/20 bg-rose-500/10 text-rose-900 hover:bg-rose-500/15";
  if (status === "archived")
    return "border-slate-400/20 bg-slate-100/60 text-slate-700 hover:bg-slate-200/60";
  // "quoted" and any unknown value fall through to indigo (default)
  return "border-indigo-500/20 bg-indigo-500/10 text-indigo-900 hover:bg-indigo-500/15";
}

export function StatusPill({
  status,
  onStatusChange,
}: {
  status: string;
  onStatusChange?: (value: string) => void;
}) {
  const styles = getStyles(status);

  if (!onStatusChange) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`}
        data-testid={`pill-quote-status-${status}`}
      >
        {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\B\w+/g, (m) => m.toLowerCase())}
      </span>
    );
  }

  return (
    <Select value={status || "quoted"} onValueChange={onStatusChange}>
      <SelectTrigger
        className={`h-6 w-auto gap-1 rounded-full border px-2.5 py-0 text-[11px] font-semibold shadow-none ${styles}`}
        data-testid="select-quote-status"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
