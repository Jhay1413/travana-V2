import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { useNeonClients } from "@/hooks/queries";

interface ReferrerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  firstName: string;
  hasReferrer: boolean;
  isPending: boolean;
  onSelect: (referrerId: string) => void;
  onClear: () => void;
}

/** Search box + results. Mounted only while the dialog is open, so nothing is fetched until then. */
function ReferrerSearch({ clientId, isPending, onSelect }: { clientId: string; isPending: boolean; onSelect: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data } = useNeonClients({ search: debounced, limit: 8 });
  const results = (data?.clients ?? []).filter((c) => c.id !== clientId);

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
        <Input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or phone" className="pl-9" data-testid="input-referrer-search" />
      </div>
      <ul className="max-h-64 divide-y divide-social-border overflow-y-auto rounded-xl border border-social-border">
        {results.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              disabled={isPending}
              onClick={() => onSelect(c.id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-muted disabled:opacity-60"
              data-testid={`referrer-option-${c.id}`}
            >
              <PersonAvatar name={`${c.firstName} ${c.surename}`} size={34} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">
                  {c.firstName} {c.surename}
                </span>
                <span className="block truncate text-xs text-social-muted">{c.phoneNumber}</span>
              </span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-3 py-6 text-center text-sm text-social-muted">{debounced ? "No clients found" : "Start typing to search"}</li>
        )}
      </ul>
    </>
  );
}

/** Pick the client who referred this one. The server only accepts an active client other than this one. */
export function ReferrerModal({ open, onOpenChange, clientId, firstName, hasReferrer, isPending, onSelect, onClear }: ReferrerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px] rounded-2xl" data-testid="dialog-referrer">
        <DialogHeader>
          <DialogTitle>Set referrer</DialogTitle>
          <DialogDescription>Who sent {firstName} to you? They earn referral credit on bookings.</DialogDescription>
        </DialogHeader>
        <ReferrerSearch clientId={clientId} isPending={isPending} onSelect={onSelect} />
        <DialogFooter className="gap-2 sm:justify-between">
          {hasReferrer ? (
            <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={isPending} onClick={onClear} data-testid="button-remove-referrer">
              Remove referrer
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
