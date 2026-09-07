import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { BadgePoundSterling, Check, ChevronDown, Ellipsis, Filter, LifeBuoy, Search, ShieldCheck, SquarePen, Wrench } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useUsers } from "@/hooks/queries";
import { dayLabel } from "@/features/conversations";
import { useTickets } from "../api/use-ticket-queries";
import { isActiveTicket } from "../lib/ticket-filters";
import type { Ticket } from "../types";
import { CreateTicketDialog } from "./create-ticket-dialog";
import { TicketThreadPanel } from "./ticket-thread-panel";
import { TicketClientPanel } from "./ticket-client-panel";

// Tickets, redesigned to the conversations inbox's 3-panel layout: a list on
// the left (pill tabs + sort row, same DNA as ConversationRow/AllHolidaysPanel),
// a thread in the centre, and client details on the right.

type TicketTab = "open" | "closed";

const CHIP_PALETTE = ["bg-red-500", "bg-sky-500", "bg-orange-500", "bg-emerald-600", "bg-indigo-500"];

// Coloured initials circle for the row's primary identity — the client (or a
// neutral support icon for internal "Build" tickets, which carry no client).
function TicketRowChip({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/10 text-black/50 3xl:h-8 3xl:w-8 dark:bg-white/10 dark:text-white/50">
        <LifeBuoy className="h-4 w-4" />
      </span>
    );
  }
  const label = name[0]?.toUpperCase() || "•";
  const hash = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white 3xl:h-8 3xl:w-8 3xl:text-sm",
        CHIP_PALETTE[hash % CHIP_PALETTE.length],
      )}
      title={name}
      aria-hidden
    >
      {label}
    </span>
  );
}

// Category icon for the ticket's `type` field — same visual language as the
// inbox row's category line (BadgePoundSterling for Sales, ShieldCheck for
// Admin), plus a Wrench for internal Build tickets.
function typeIconFor(type: string): { Icon: typeof LifeBuoy; className: string } {
  switch (type) {
    case "Sales": return { Icon: BadgePoundSterling, className: "text-[#b3b3b3]" };
    case "Admin": return { Icon: ShieldCheck, className: "text-[#808080]" };
    case "Build": return { Icon: Wrench, className: "text-[#808080]" };
    default: return { Icon: LifeBuoy, className: "text-black/45 dark:text-white/45" };
  }
}

// "16:33" for today, otherwise the usual day label — mirrors the conversations
// inbox's rowTime.
function rowTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (!isNaN(d.getTime()) && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  }
  return dayLabel(iso);
}

function ticketClientName(ticket: Ticket): string | null {
  const name = ticket.clientName?.trim();
  return name && name !== "null" ? name : null;
}

function TicketListRow({ ticket, active, onClick }: { ticket: Ticket; active: boolean; onClick: () => void }) {
  const clientName = ticketClientName(ticket);
  const category = typeIconFor(ticket.type);
  const lastActivity = ticket.updatedAt || ticket.createdAt;
  return (
    <button
      onClick={onClick}
      data-testid={`ticket-row-${ticket.id}`}
      className={cn(
        "relative w-full px-3 py-3 text-left transition",
        active
          ? "rounded-2xl border border-sky-100 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10"
          : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
      )}
    >
      <div className="flex items-start gap-3">
        <TicketRowChip name={clientName} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-black/85 3xl:text-sm dark:text-white/85">
              {clientName || "Internal ticket"}
            </span>
            <span className="whitespace-nowrap text-xs text-black/45 dark:text-white/45">{rowTime(lastActivity)}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#a195a5] 3xl:text-[13px] dark:text-white/50">
            <category.Icon className={cn("h-4 w-4 shrink-0", category.className)} />
            <span className="truncate">{ticket.type}</span>
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-3">
        <span className="w-9 shrink-0 text-center text-[10px] tracking-[0.2em] text-[#a195a5]/70 dark:text-white/30" aria-hidden>
          ···
        </span>
        <span className="truncate text-xs text-[#a195a5] 3xl:text-[13px] dark:text-white/50">{ticket.subject}</span>
      </div>
      {!active && (
        <span className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-black/[0.06] dark:bg-white/[0.06]" aria-hidden />
      )}
    </button>
  );
}

export function TicketsInbox({ selectedTicketId }: { selectedTicketId?: string }) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TicketTab>("open");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [selectedId, setSelectedId] = useState<string | null>(selectedTicketId ?? null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { data: tickets, isLoading } = useTickets();
  const { data: users = [] } = useUsers();

  useEffect(() => {
    if (selectedTicketId) setSelectedId(selectedTicketId);
  }, [selectedTicketId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tickets ?? [])
      .filter((t) => (tab === "open" ? isActiveTicket(t) : !isActiveTicket(t)))
      .filter((t) => !q || (t.clientName ?? "").toLowerCase().includes(q) || t.subject.toLowerCase().includes(q))
      .sort((a, b) => {
        const diff = new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime();
        return sortOrder === "newest" ? diff : -diff;
      });
  }, [tickets, tab, search, sortOrder]);

  // Selects a ticket (or clears the selection) and keeps the URL in sync.
  // `replace` is used when this is a programmatic correction (e.g. the keep-
  // valid-selection effect below) rather than a deliberate click, so it
  // doesn't add a junk history entry.
  const selectTicket = (id: string | null, opts?: { replace?: boolean }) => {
    setSelectedId(id);
    navigate(id ? `/tickets/${id}` : "/tickets", opts?.replace ? { replace: true } : undefined);
  };

  // A deliberate tab click drops the current selection so the effect below
  // re-seeds it from the NEW tab's first row. Without this, the keep-valid
  // effect saw the still-selected ticket living in the other tab and flipped
  // the tab straight back — clicking "Closed" bounced to "Open".
  const switchTab = (next: TicketTab) => {
    if (next === tab) return;
    setTab(next);
    selectTicket(null, { replace: true });
  };

  // Keep a valid selection without ever dropping one that still exists.
  //
  // Bails out while `tickets` hasn't loaded yet — otherwise this ran against an
  // empty/undefined list on first render and nulled out a URL-seeded
  // `selectedId` (the deep-link) before the query had a chance to resolve.
  //
  // If the selection fell out of the current tab's `filtered` list but still
  // exists in the full `tickets` list, the ticket itself is fine — only the
  // tab is wrong (e.g. resolving/closing the open ticket you're looking at
  // moves it from Open to Done). Switch to the tab that has it instead of
  // dropping the selection. Only a selection that has truly vanished (deleted,
  // or never existed) falls back to the first row of the current tab, or null.
  useEffect(() => {
    if (isLoading || !tickets) return;

    if (selectedId) {
      const stillExists = tickets.some((t) => t.id === selectedId);
      if (stillExists) {
        if (!filtered.some((t) => t.id === selectedId)) {
          const match = tickets.find((t) => t.id === selectedId)!;
          const targetTab: TicketTab = isActiveTicket(match) ? "open" : "closed";
          if (tab !== targetTab) setTab(targetTab);
        }
        return;
      }
    }

    if (filtered.length === 0) {
      if (selectedId !== null) selectTicket(null, { replace: true });
    } else if (!filtered.some((t) => t.id === selectedId)) {
      selectTicket(filtered[0].id, { replace: true });
    }
  }, [tickets, isLoading, filtered, selectedId, tab]);

  const selected = useMemo(() => tickets?.find((t) => t.id === selectedId) ?? null, [tickets, selectedId]);

  return (
    <section
      className="-m-4 grid h-[calc(100vh-3.5rem)] grid-cols-[250px_1fr_240px] gap-0 overflow-hidden rounded-tl-lg md:-m-6 lg:grid-cols-[300px_1fr_300px] 3xl:grid-cols-[380px_1fr_380px]"
      data-testid="section-tickets"
    >
      {/* ── Ticket list ── */}
      <Card className="flex flex-col overflow-hidden rounded-none border-0 border-r border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-black/10 px-5 dark:border-white/10">
          <h2 className="text-sm font-semibold">Tickets</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className={cn(
                "grid h-8 w-8 place-items-center rounded-md border transition",
                searchOpen
                  ? "border-black/20 bg-black/5 text-black dark:border-white/20 dark:bg-white/10 dark:text-white"
                  : "border-black/10 bg-white text-black/70 hover:bg-black/[0.03] dark:border-white/15 dark:bg-transparent dark:text-white/70",
              )}
              title="Search tickets"
              data-testid="ticket-search-toggle"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCreateDialogOpen(true)}
              className="grid h-8 w-8 place-items-center rounded-md bg-sky-500 text-white transition hover:bg-sky-600"
              title="New ticket"
              data-testid="ticket-compose"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="px-4 pb-3 pt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40 dark:text-white/40" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tickets…"
                className="h-8 rounded-xl border-black/10 bg-black/[0.03] pl-9 text-xs dark:border-white/10 dark:bg-white/[0.04]"
                data-testid="ticket-search"
              />
            </div>
          </div>
        )}

        <div className="px-4 pt-4">
          <div className="flex w-full items-center gap-1 rounded-sm border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {(["open", "closed"] as const).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={cn(
                  "flex-1 rounded-xs px-2 py-1 text-center text-[13px] font-semibold transition 3xl:text-sm",
                  tab === t
                    ? "border border-black/10 bg-white text-black shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white"
                    : "text-[#7c98b0] hover:text-[#5f7d97] dark:text-white/45 dark:hover:text-white/70",
                )}
                data-testid={`ticket-tab-${t}`}
              >
                {t === "open" ? "Open" : "Closed"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1 text-sm font-semibold text-[#7c98b0] hover:text-[#5f7d97] dark:text-white/60 dark:hover:text-white"
                data-testid="ticket-sort"
              >
                {sortOrder === "newest" ? "Newest" : "Oldest"}
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="rounded-xl">
              <DropdownMenuItem onClick={() => setSortOrder("newest")} className="flex items-center justify-between gap-3 rounded-lg text-sm">
                Newest {sortOrder === "newest" && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortOrder("oldest")} className="flex items-center justify-between gap-3 rounded-lg text-sm">
                Oldest {sortOrder === "oldest" && <Check className="h-3.5 w-3.5" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Filter and overflow are visual placeholders from the design — no
              behaviour is specced for them yet, same as AllHolidaysPanel. */}
          <div className="flex items-center gap-1 text-black/40 dark:text-white/40">
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
              title="Filter"
              data-testid="ticket-filter"
            >
              <Filter className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
              title="More"
              data-testid="ticket-list-more"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <p className="py-6 text-center text-xs text-black/45 dark:text-white/45">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-xs text-black/45 dark:text-white/45">No tickets found</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((t) => (
                <TicketListRow key={t.id} ticket={t} active={t.id === selectedId} onClick={() => selectTicket(t.id)} />
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ── Thread ── */}
      <TicketThreadPanel
        ticket={selected}
        users={users}
        onDeleted={() => selectTicket(null)}
      />

      {/* ── Client details ── */}
      <TicketClientPanel ticket={selected} />

      <CreateTicketDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={(ticket) => selectTicket(ticket.id)}
      />
    </section>
  );
}
