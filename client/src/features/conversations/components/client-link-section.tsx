import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Loader2, Link2, UserPlus, ArrowUpRight, Unlink, UserCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useContactLink, useLinkContact, useUnlinkContact } from "../api/use-contact-link";
import { LinkClientDialog, type ClientPrefill } from "./link-client-dialog";
import type { NeonClient } from "@/features/client/types/neon-client";
import type { Conversation } from "../types";

// The phone/email we try to auto-match a contact to a client with. Shared with
// ContactPanel so both read the same cached contact-link query (keyed by contact).
export function contactLinkMatch(conversation: Conversation): { phone?: string; email?: string } {
  const handle = conversation.contact.handle;
  return conversation.channel === "email" ? { email: handle } : { phone: handle };
}

export function formatClientDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function composeClientAddress(c: NeonClient): string | null {
  const line = [c.houseNumber, c.street].filter(Boolean).join(" ").trim();
  const parts = [line, c.city, c.post_code, c.country].map((p) => p?.trim()).filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// Right-panel section for linking a SendSeven inbox contact to a CRM client.
// Shows a compact linked card (View/Unlink) or, when unlinked, phone/email
// suggestions plus a dialog to search or create a client. The linked client's
// details are rendered separately in the Master Data section (ContactPanel).
export function ClientLinkSection({ conversation }: { conversation: Conversation }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"search" | "create">("search");

  const contactId = conversation.contact.id;
  const isEmail = conversation.channel === "email";
  const handle = conversation.contact.handle;
  const match = useMemo(() => contactLinkMatch(conversation), [conversation]);

  const { data, isLoading } = useContactLink(contactId, match);
  const linkContact = useLinkContact(contactId);
  const unlinkContact = useUnlinkContact(contactId);

  const prefill: ClientPrefill = useMemo(() => {
    const parts = conversation.contact.displayName.trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts[0] ?? conversation.contact.firstName ?? "",
      surename: parts.slice(1).join(" ") || conversation.contact.lastName || "",
      phoneNumber: isEmail ? "" : handle,
      email: isEmail ? handle : "",
    };
  }, [conversation.contact, isEmail, handle]);

  const openDialog = (mode: "search" | "create") => {
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const quickLink = async (clientId: string) => {
    try {
      await linkContact.mutateAsync(clientId);
      toast({ title: "Client linked" });
    } catch (err) {
      toast({ title: "Couldn't link", description: (err as Error).message, variant: "destructive" });
    }
  };

  const unlink = async () => {
    try {
      await unlinkContact.mutateAsync();
      toast({ title: "Unlinked", description: "This contact is no longer linked to a client." });
    } catch (err) {
      toast({ title: "Couldn't unlink", description: (err as Error).message, variant: "destructive" });
    }
  };

  const linked = data?.linkedClient ?? null;
  const suggestions = data?.suggestions ?? [];

  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-black/35 dark:text-white/35">
        <UserCheck className="h-3 w-3" /> Client record
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-2 text-xs text-black/45 dark:text-white/45">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
        </div>
      ) : linked ? (
        <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">
                {[linked.title, linked.firstName, linked.surename].filter(Boolean).join(" ")}
              </div>
              <div className="truncate text-[11px] text-black/45 dark:text-white/45">
                {linked.phoneNumber}
                {linked.email ? ` · ${linked.email}` : ""}
              </div>
            </div>
            <span className="flex flex-shrink-0 items-center gap-1 rounded-md bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-green-600 dark:text-green-400">
              <Link2 className="h-2.5 w-2.5" /> Linked
            </span>
          </div>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => navigate(`/clients/${linked.id}`)}>
              <ArrowUpRight className="h-3.5 w-3.5" /> View full profile
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-red-500 hover:text-red-600"
              disabled={unlinkContact.isPending}
              onClick={unlink}
            >
              {unlinkContact.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
              Unlink
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1 text-[11px] text-black/45 dark:text-white/45">
                <Sparkles className="h-3 w-3" /> Possible match{suggestions.length > 1 ? "es" : ""}
              </div>
              {suggestions.map((c) => (
                <div key={c.id} className="flex items-center gap-2 rounded-xl border border-black/8 px-2.5 py-1.5 dark:border-white/8">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.firstName} {c.surename}</div>
                    <div className="truncate text-[11px] text-black/45 dark:text-white/45">
                      {c.phoneNumber}{c.email ? ` · ${c.email}` : ""}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={linkContact.isPending} onClick={() => quickLink(c.id)}>
                    <Link2 className="h-3.5 w-3.5" /> Link
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => openDialog("search")}>
              <Link2 className="h-3.5 w-3.5" /> {suggestions.length ? "Search other" : "Link to client"}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => openDialog("create")}>
              <UserPlus className="h-3.5 w-3.5" /> New client
            </Button>
          </div>
        </div>
      )}

      <LinkClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        contactId={contactId}
        prefill={prefill}
        initialMode={dialogMode}
      />
    </div>
  );
}
