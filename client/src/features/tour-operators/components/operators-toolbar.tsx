import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";

interface OperatorsToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  onTemplate: () => void;
}

export function OperatorsToolbar({ query, onQuery, onTemplate }: OperatorsToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex h-10 min-w-[220px] max-w-[460px] flex-1 items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-social-muted focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0" aria-hidden />
        <span className="sr-only">Search</span>
        <input
          id="to-q"
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search name, phone, website or username"
          data-testid="input-search-operators"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-social-muted"
        />
      </label>
      <Button type="button" variant="ghost" className={OUTLINE_ACTION} onClick={onTemplate} data-testid="button-download-template">
        Download CSV template
      </Button>
    </div>
  );
}
