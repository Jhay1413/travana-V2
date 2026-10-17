import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useClientSearch, type NeonClient } from "@/features/client";

interface ClientPickerProps {
  value: NeonClient | null;
  onChange: (client: NeonClient | null) => void;
  error?: string;
}

export function ClientPicker({ value, onChange, error }: ClientPickerProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching, isError } = useClientSearch(value ? "" : debounced);
  const results = (data?.clients ?? []).slice(0, 6);

  if (value) {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-full bg-social-navy px-3 py-1 text-sm text-white">
          {value.firstName} {value.surename}
          <button type="button" aria-label="Remove client" onClick={() => onChange(null)} className="opacity-80 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a client by name or number"
          className="pl-9 text-sm"
          aria-invalid={!!error}
        />
        {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-social-muted" />}
      </div>
      {debounced && results.length > 0 && (
        <ul className="max-h-60 overflow-y-auto rounded-md border border-social-border">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(c);
                  setQuery("");
                }}
                className="block w-full px-3 py-2 text-left hover:bg-muted"
              >
                <div className="text-sm font-medium">
                  {c.firstName} {c.surename}
                </div>
                <div className="text-xs text-social-muted">{[c.phoneNumber, c.email].filter(Boolean).join(" · ")}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debounced && isError && <p className="text-xs text-destructive">Couldn't search clients.</p>}
      {debounced && query.trim() === debounced && !isError && !isFetching && results.length === 0 && (
        <p className="text-xs text-social-muted">No clients found.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
