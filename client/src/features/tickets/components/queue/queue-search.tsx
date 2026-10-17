import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export function QueueSearch({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  return (
    <label className={cn("flex h-10 w-[300px] max-w-full shrink-0 items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] xl:text-[13px]", className)}>
      <Search className="h-4 w-4 shrink-0 text-social-muted" />
      <input
        type="search"
        maxLength={100}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tickets, clients, refs"
        aria-label="Search tickets, clients, refs"
        className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-social-muted"
        data-testid="ticket-search"
      />
    </label>
  );
}
