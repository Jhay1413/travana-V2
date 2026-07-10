import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserPlus, Link2, Phone, Mail } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { neonClientApi } from "@/features/client/api/neon-client.api";
import { useLinkContact, useCreateAndLinkContact } from "../api/use-contact-link";

export interface ClientPrefill {
  firstName: string;
  surename: string;
  phoneNumber: string;
  email: string;
}

type Mode = "search" | "create";

export function LinkClientDialog({
  open,
  onOpenChange,
  contactId,
  prefill,
  initialMode = "search",
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contactId: string;
  prefill: ClientPrefill;
  initialMode?: Mode;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [form, setForm] = useState<ClientPrefill>(prefill);

  const linkContact = useLinkContact(contactId);
  const createAndLink = useCreateAndLinkContact(contactId);

  // Reset to a clean state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setMode(initialMode);
      setSearch("");
      setDebounced("");
      setForm(prefill);
    }
  }, [open, initialMode, prefill]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["neon-clients", "link-search", debounced],
    queryFn: () => neonClientApi.getAll({ page: 1, limit: 8, search: debounced || undefined }),
    enabled: open && mode === "search",
  });

  const doLink = async (clientId: string) => {
    try {
      await linkContact.mutateAsync(clientId);
      toast({ title: "Client linked", description: "This conversation is now linked to the client record." });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't link", description: (err as Error).message, variant: "destructive" });
    }
  };

  const doCreate = async () => {
    if (!form.firstName.trim() || !form.surename.trim() || !form.phoneNumber.trim()) {
      toast({ title: "Missing details", description: "First name, surname and phone are required.", variant: "destructive" });
      return;
    }
    try {
      await createAndLink.mutateAsync({
        firstName: form.firstName.trim(),
        surename: form.surename.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim() || null,
      });
      toast({ title: "Client created & linked", description: `${form.firstName} ${form.surename} added to your clients.` });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Couldn't create client", description: (err as Error).message, variant: "destructive" });
    }
  };

  const clients = data?.clients ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to a client</DialogTitle>
          <DialogDescription>Connect this SendSeven contact to a record in your client database.</DialogDescription>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex gap-1 rounded-lg bg-black/5 p-1 text-sm dark:bg-white/10">
          {(["search", "create"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition",
                mode === m ? "bg-white shadow-sm dark:bg-white/15" : "text-black/60 dark:text-white/60",
              )}
            >
              {m === "search" ? <Search className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
              {m === "search" ? "Find existing" : "Create new"}
            </button>
          ))}
        </div>

        {mode === "search" ? (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/30 dark:text-white/30" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, phone or email…"
                className="pl-9"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto">
              {isFetching ? (
                <div className="flex items-center gap-2 py-6 text-sm text-black/50 dark:text-white/50">
                  <Loader2 className="h-4 w-4 animate-spin" /> Searching…
                </div>
              ) : clients.length === 0 ? (
                <div className="py-6 text-center text-sm text-black/45 dark:text-white/45">
                  No clients found. Try “Create new”.
                </div>
              ) : (
                clients.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl border border-black/8 px-3 py-2 dark:border-white/8"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {c.firstName} {c.surename}
                      </div>
                      <div className="truncate text-xs text-black/45 dark:text-white/45">
                        {c.phoneNumber}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={linkContact.isPending} onClick={() => doLink(c.id)}>
                      <Link2 className="h-3.5 w-3.5" /> Link
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="lc-first" className="text-xs">First name</Label>
                <Input id="lc-first" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lc-last" className="text-xs">Surname</Label>
                <Input id="lc-last" value={form.surename} onChange={(e) => setForm((f) => ({ ...f, surename: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-phone" className="text-xs flex items-center gap-1"><Phone className="h-3 w-3" /> Phone</Label>
              <Input id="lc-phone" value={form.phoneNumber} onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-email" className="text-xs flex items-center gap-1"><Mail className="h-3 w-3" /> Email <span className="text-black/40 dark:text-white/40">(optional)</span></Label>
              <Input id="lc-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button size="sm" className="gap-1.5" disabled={createAndLink.isPending} onClick={doCreate}>
                {createAndLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Create & link
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
