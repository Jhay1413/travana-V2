import { useEffect, useRef, useState } from "react";
import { Search, User } from "lucide-react";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNeonClients } from "@/hooks/queries";
import { useFixedDropdownPosition } from "@/hooks/use-fixed-dropdown-position";
import { clientDisplayName, cn } from "@/lib/utils";
import { cleanContact, type PickedClient } from "../../../lib/raw-client";
import { HolidayPicker } from "../holiday-picker";

/** Client search with a dropdown of matches; once picked, a card with a Change button and the holiday select. */
export function LinkToSearch({
  client,
  onPick,
  transactionId,
  onTransactionChange,
}: {
  client: PickedClient | null;
  onPick: (client: PickedClient | null) => void;
  transactionId: string;
  onTransactionChange: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data } = useNeonClients({ page: 1, limit: 20, search });

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setFocused(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const showResults = focused && search.trim().length >= 1;
  // Fixed placement so the list floats above the dialog's scroll area instead of being clipped by it.
  const position = useFixedDropdownPosition(inputRef, showResults);

  if (client) {
    return (
      <div className="rounded-[14px] border border-social-border bg-muted/40 p-3" data-testid="ticket-linked-client">
        <div className="flex items-center gap-3">
          <PersonAvatar name={client.name} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold">{client.name}</div>
            <div className="truncate text-[12px] text-social-muted">{client.phone ?? client.email ?? "No contact details"}</div>
          </div>
          <Button type="button" variant="outline" size="sm" className="h-[34px] rounded-[10px] border-social-border bg-card text-[13px]" onClick={() => onPick(null)} data-testid="ticket-change-client">
            Change
          </Button>
        </div>
        <div className="mt-3">
          <HolidayPicker clientId={client.id} value={transactionId} onChange={onTransactionChange} testId="select-booking" />
        </div>
      </div>
    );
  }

  const clients = data?.clients ?? [];
  return (
    <div className="relative" ref={wrapperRef}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
      <Input
        ref={inputRef}
        data-testid="select-client"
        placeholder="Search a client by name, phone or email"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setFocused(true);
        }}
        onFocus={() => setFocused(true)}
        className={cn("h-12 w-full rounded-[10px] border-social-border pl-10 text-[14px]", focused && "border-social-orange ring-2 ring-social-orange/20")}
      />
      {showResults && position && (
        <div
          className="fixed z-[600] overflow-y-auto rounded-xl border border-social-border bg-popover shadow-lg"
          style={{ left: position.left, width: position.width, top: position.top, bottom: position.bottom, maxHeight: Math.min(256, position.maxHeight) }}
        >
          {clients.length > 0 ? (
            clients.map((c) => {
              const name = clientDisplayName(c);
              return (
                <button
                  key={c.id}
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted"
                  data-testid={`customer-option-${c.id}`}
                  onClick={() => {
                    onPick({ id: c.id, name: name || "Client", phone: cleanContact(c.phoneNumber), email: cleanContact(c.email) });
                    setSearch("");
                    setFocused(false);
                  }}
                >
                  <User className="h-3.5 w-3.5 text-social-muted" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{name}</span>
                  {cleanContact(c.phoneNumber) && <span className="text-[12px] text-social-muted">{c.phoneNumber}</span>}
                </button>
              );
            })
          ) : (
            <div className="px-4 py-3 text-[13px] text-social-muted">No customers found</div>
          )}
        </div>
      )}
    </div>
  );
}
