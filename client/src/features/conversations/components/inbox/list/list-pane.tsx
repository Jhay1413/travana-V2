import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, SquarePen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Conversation, ConversationChannel, ConversationTag } from "../../../types";
import {
  countActiveFilters,
  groupRows,
  type InboxFilters,
  type QuickChip,
  type SnoozePresetId,
  type SortPreference,
} from "../lib";
import { Segmented } from "../shared";
import { ConversationRow } from "./conversation-row";
import { emptyCopy, type ListTab } from "./empty-copy";
import { FiltersPopover } from "./filters-popover";
import { SortPopover } from "./sort-popover";

export interface ListPaneProps {
  rows: Conversation[];
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
  tab: ListTab;
  onTabChange: (tab: ListTab) => void;
  tabCounts: { open: number; snoozed?: number };
  unreadCount: number;
  search: string;
  onSearchChange: (v: string) => void;
  chip: QuickChip;
  onChipChange: (c: QuickChip) => void;
  chipCounts: { unread: number; needsReply: number; mine: number };
  filters: InboxFilters;
  onFiltersChange: (f: InboxFilters) => void;
  channelCounts: Record<ConversationChannel, number>;
  tagOptions: ConversationTag[];
  unassignedCount: number;
  sort: SortPreference;
  onSortChange: (p: SortPreference) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  currentUserId: string | null;
  staff: { id: string; name: string }[];
  onSnooze: (id: string, presetId: SnoozePresetId) => void;
  onUnsnooze: (id: string) => void;
  onDone: (id: string) => void;
  onReopen: (id: string) => void;
  onAssign: (id: string, userId: string | null) => void;
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  /** Show the pager at all (more than one page). */
  showPager: boolean;
  /** Pager buttons are inert while a page is loading; the pager itself stays put. */
  pagerDisabled?: boolean;
  /** Conversation id → unsent draft text, shown as a "Draft" tag on that row. */
  draftTags?: Record<string, string>;
  onPageChange: (p: number) => void;
  inboxSwitcher?: ReactNode;
  onNewMessage: () => void;
  now: Date;
}

const CHIPS: { value: QuickChip; label: string; count?: "unread" | "needsReply" | "mine" }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread", count: "unread" },
  { value: "needs_reply", label: "Needs reply", count: "needsReply" },
  { value: "mine", label: "Mine", count: "mine" },
];

export function ListPane(props: ListPaneProps) {
  const { rows, tab, search, filters, sort, now, page } = props;
  const hasSearch = search.trim().length > 0;
  const hasFilters = countActiveFilters(filters) > 0 || props.chip !== "all";
  const grouped = sort.key === "latest" && !sort.unreadFirst;

  const renderRow = (c: Conversation) => (
    <ConversationRow
      key={c.id}
      conversation={c}
      selected={c.id === props.selectedId}
      isDoneTab={tab === "done"}
      staff={props.staff}
      currentUserId={props.currentUserId}
      draftPreview={props.draftTags?.[c.id]}
      now={now}
      onSelect={() => props.onSelect(c.id)}
      onSnooze={(p) => props.onSnooze(c.id, p)}
      onUnsnooze={() => props.onUnsnooze(c.id)}
      onDone={() => props.onDone(c.id)}
      onReopen={() => props.onReopen(c.id)}
      onAssign={(u) => props.onAssign(c.id, u)}
    />
  );

  let body: ReactNode;
  if (props.isLoading) {
    body = (
      <div>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex gap-3 border-b border-social-border px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3.5 w-full" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  } else if (props.isError) {
    body = (
      <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="text-[14px] text-social-muted">Couldn't load conversations.</p>
        {props.onRetry && (
          <button
            type="button"
            onClick={props.onRetry}
            className="h-9 rounded-lg border border-social-border px-4 text-[13px] font-medium hover:bg-muted/40"
          >
            Retry
          </button>
        )}
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="px-6 py-16 text-center text-[14px] text-social-muted">
        {emptyCopy({ tab, hasSearch, hasFilters })}
      </p>
    );
  } else if (grouped) {
    body = groupRows(rows, (r) => r.lastActivityAt, now).map((g) => (
      <section key={g.key}>
        <h2 className="sticky top-0 z-10 bg-[#F8FAFC] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-social-muted dark:bg-card">
          {g.label}
        </h2>
        {g.rows.map(renderRow)}
      </section>
    ));
  } else {
    body = (
      <>
        {rows.map(renderRow)}
        <p className="px-4 py-3 text-center text-[12px] text-social-muted">Sorted within this page</p>
      </>
    );
  }

  return (
    <div className="flex h-full w-[330px] shrink-0 flex-col rounded-2xl border border-social-border bg-card" data-testid="inbox-list-pane">
      <div className="space-y-3 border-b border-social-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-[20px] font-semibold leading-tight">Inbox</h1>
            <p className="text-[12px] text-social-muted">{props.unreadCount} unread</p>
          </div>
          <div className="flex items-center gap-1">
            {props.inboxSwitcher}
            <button
              type="button"
              onClick={props.onNewMessage}
              title="New message"
              aria-label="New message"
              className="grid h-8 w-8 place-items-center rounded-md bg-social-navy text-white hover:opacity-90"
              data-testid="conversation-compose"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
          <Input
            value={search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Search name or message"
            className="h-10 pl-9 text-[14px]"
            data-testid="conversation-search"
          />
        </div>
        <Segmented
          value={tab}
          onChange={props.onTabChange}
          height={38}
          className="w-full"
          items={[
            { value: "open", label: "Open", count: props.tabCounts.open },
            { value: "snoozed", label: "Snoozed", count: props.tabCounts.snoozed },
            { value: "done", label: "Done" },
          ]}
        />
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => {
            const active = props.chip === c.value;
            const n = c.count ? props.chipCounts[c.count] : undefined;
            return (
              <button
                key={c.value}
                type="button"
                onClick={() => props.onChipChange(c.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11.5px] font-semibold transition",
                  active
                    ? "border-[#1F2937] bg-[#1F2937] text-white"
                    : "border-social-border bg-card text-social-muted hover:bg-muted/40",
                )}
              >
                {c.label}
                {n !== undefined && ` ${n}`}
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <FiltersPopover
            filters={filters}
            onFiltersChange={props.onFiltersChange}
            channelCounts={props.channelCounts}
            tagOptions={props.tagOptions}
            unassignedCount={props.unassignedCount}
          />
          <SortPopover sort={sort} onSortChange={props.onSortChange} />
        </div>
      </div>
      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">{body}</div>
      {props.showPager && (
        <div className="flex items-center justify-between border-t border-social-border px-4 py-2">
          <button
            type="button"
            disabled={!props.hasPrev || props.pagerDisabled}
            onClick={() => props.onPageChange(page - 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-social-border px-2.5 text-[12px] font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="conversations-prev-page"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="text-[12px] text-social-muted">Page {page}</span>
          <button
            type="button"
            disabled={!props.hasNext || props.pagerDisabled}
            onClick={() => props.onPageChange(page + 1)}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-social-border px-2.5 text-[12px] font-medium hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-40"
            data-testid="conversations-next-page"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
