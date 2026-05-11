import { useEffect, useRef, useState } from "react";
import { Search, UserCheck, UserRound, Users, X } from "lucide-react";
import { useNeonClient, useNeonClients } from "@/hooks/queries";

interface ReferrerSelectorProps {
  currentReferredByClientId: string | null | undefined;
  excludeClientId: string;
  onSelect: (clientId: string) => void;
  onClear: () => void;
  className?: string;
}

export function ReferrerSelector({
  currentReferredByClientId,
  excludeClientId,
  onSelect,
  onClear,
  className,
}: ReferrerSelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch current referrer name
  const { data: currentReferrer } = useNeonClient(currentReferredByClientId ?? "");

  // Search results
  const { data: searchResults } = useNeonClients({
    search: debouncedSearch,
    limit: 8,
  });

  const results = (searchResults?.clients ?? []).filter((c) => c.id !== excludeClientId);

  function handleSelect(client: { id: string; firstName: string; surename: string }) {
    onSelect(client.id);
    setOpen(false);
    setSearch("");
    setDebouncedSearch("");
  }

  if (currentReferredByClientId && currentReferrer) {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/5 px-3 py-2 ${className ?? ""}`}>
        <UserCheck className="h-3.5 w-3.5 shrink-0 text-green-600" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold text-black/40">Referred by</p>
          <p className="truncate text-xs font-semibold text-black/80">
            {currentReferrer.firstName} {currentReferrer.surename}
            {currentReferrer.phoneNumber && (
              <span className="ml-1.5 font-normal text-black/40">{currentReferrer.phoneNumber}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-black/[0.05] text-black/40 transition hover:bg-red-500/10 hover:text-red-600"
          title="Remove referrer"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center gap-1.5 rounded-2xl border border-dashed border-black/15 bg-black/[0.02] px-3 py-1.5 text-xs font-medium text-black/40 transition hover:border-black/25 hover:bg-black/[0.04] hover:text-black/60"
        >
          <Users className="h-3.5 w-3.5" />
          Set referrer
        </button>
      ) : (
        <div className="w-full rounded-2xl border border-black/10 bg-white shadow-lg">
          <div className="flex items-center gap-2 px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-black/30" />
            <input
              autoFocus
              type="text"
              placeholder="Search by name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs text-black/80 placeholder:text-black/30 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setSearch("");
              }}
              className="text-black/30 hover:text-black/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {results.length > 0 && (
            <ul className="max-h-48 divide-y divide-black/5 overflow-y-auto border-t border-black/5">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-black/[0.03]"
                    onClick={() => handleSelect(c)}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
                      <UserRound className="h-3.5 w-3.5 text-black/40" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-black/80">
                        {c.firstName} {c.surename}
                      </p>
                      <p className="truncate text-[10px] text-black/40">{c.phoneNumber}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {debouncedSearch && results.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-black/30">No clients found</p>
          )}

          {!debouncedSearch && results.length === 0 && (
            <p className="px-3 py-3 text-center text-xs text-black/30">Start typing to search</p>
          )}
        </div>
      )}
    </div>
  );
}
