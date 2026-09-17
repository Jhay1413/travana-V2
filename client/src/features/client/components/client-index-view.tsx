import { useMemo, useState } from "react";
import {
  Check,
  CirclePoundSterling,
  Ellipsis,
  Eye,
  Pencil,
  ShieldUser,
  SquarePlus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { cn } from "@/lib/utils";
import { useClientNotes, useCurrentUser } from "@/hooks/queries";
import { useClientQuoteViews } from "@/features/quote";
import { useDeleteTask, useToggleTask } from "@/hooks/mutations";
import type { NeonClient } from "@/features/client/types/neon-client";
import type { EnquiryTable } from "@/features/quote/types";
import type { Ticket as ApiTicket } from "@/features/tickets/types";
import type { User as ApiUser } from "@/features/user/types";
import type { TaskNew, ClientFile } from "@shared/schema";
import { currency, type Client, type QuoteWithJoins, type BookingWithJoins, type FileItem } from "@/features/client/components/client-types";
import { ClientFilesTab } from "@/features/client/components/tabs/ClientFilesTab";
import { ClientTicketsTab } from "@/features/client/components/tabs/ClientTicketsTab";
import { ClientChatsTab } from "@/features/client/components/tabs/ClientChatsTab";
import { ClientVipClubTab } from "@/features/client/components/tabs/ClientVipClubTab";
import { ReferrerSelector } from "@/features/client/components/sections/ReferrerSelector";
import { PortalAccessCard } from "@/features/client/components/sections/PortalAccessCard";
import { ReferralNetworkCard } from "@/features/client/components/sections/ReferralNetworkCard";
import { EditTaskDialog, type EditableTask } from "@/features/tasks/components/tasks/EditTaskDialog";

export { composeAddress } from "@/features/client/lib/compose-address";

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function longDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Most recent of a list of ISO dates, as dd/MM/yy. */
function latestDate(values: Array<string | null | undefined>): string | null {
  const times = values.map((v) => (v ? new Date(v).getTime() : NaN)).filter((t) => !isNaN(t));
  if (times.length === 0) return null;
  return shortDate(new Date(Math.max(...times)).toISOString());
}

function taskDueChip(due: Date): { label: string; className: string } {
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(due) - startOfDay(new Date())) / 86_400_000);
  if (dayDiff < 0) return { label: "Overdue", className: "bg-rose-500 text-white" };
  if (dayDiff === 0) return { label: "Today", className: "bg-emerald-500 text-white" };
  if (dayDiff === 1) return { label: "Tomorrow", className: "bg-sky-500 text-white" };
  return { label: due.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), className: "bg-black/5 text-black/60" };
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

// ─── Stats ──────────────────────────────────────────────────────────────────

function StatBox({ label, value, caption, testId }: { label: string; value: string; caption: string | null; testId: string }) {
  return (
    <div className="relative flex h-full flex-col rounded-sm border border-black/10 bg-white px-4 py-3.5 dark:border-white/10 dark:bg-white/[0.04]" data-testid={testId}>
      {/* Green pound badge straddling the corner, per the design. */}
      <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-black" aria-hidden>
        <CirclePoundSterling className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
      <div className="text-sm font-semibold text-black/85 dark:text-white/85">{label}</div>
      <div className="mt-1 text-4xl font-semibold leading-none tracking-tight text-black/90 dark:text-white">{value}</div>
      <div className="mt-auto truncate pt-2 text-[11px] text-black/45 dark:text-white/45" title={caption ?? undefined}>{caption ?? " "}</div>
    </div>
  );
}

// ─── Tasks tab ──────────────────────────────────────────────────────────────

const TASKS_PREVIEW_LIMIT = 5;

/** Title + travel date of the deal a task belongs to, for the row's second line. */
interface TaskHoliday {
  title: string | null;
  travelDate: string | null;
}

function TasksList({
  clientId,
  tasks,
  users,
  holidays,
  navigate,
}: {
  clientId: string;
  tasks: TaskNew[];
  users: ApiUser[];
  holidays: Map<string, TaskHoliday>;
  navigate: (to: string) => void;
}) {
  const toggleMutation = useToggleTask("client", clientId);
  const deleteMutation = useDeleteTask("client", clientId);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);

  const rows = useMemo(
    () =>
      [...tasks]
        .sort((a, b) => Number(a.completed) - Number(b.completed) || (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0))
        .slice(0, TASKS_PREVIEW_LIMIT),
    [tasks],
  );

  if (rows.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40 dark:text-white/40">No tasks yet.</p>;
  }

  return (
    <>
      <div data-testid="client-index-tasks">
        {rows.map((task) => {
          const due = task.dueDate ? new Date(task.dueDate) : null;
          const validDue = due && !isNaN(due.getTime()) ? due : null;
          const time = validDue ? validDue.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
          const chip = validDue && !task.completed ? taskDueChip(validDue) : null;
          const assigneeName = task.userId ? userNameById.get(task.userId) || "" : "";
          const created = longDate(task.createdAt ? String(task.createdAt) : null);
          const holiday = task.entityId ? holidays.get(task.entityId) : undefined;
          const travel = holiday?.travelDate ? longDate(holiday.travelDate) : null;
          const meta = [created ? `Created ${created}` : null, holiday?.title || null, travel ? `Travel ${travel}` : null].filter(Boolean).join(" – ");
          return (
            <div key={task.id} className="flex items-start gap-3 px-1 py-3.5" data-testid={`client-index-task-${task.id}`}>
              <button
                type="button"
                onClick={() => toggleMutation.mutate(task.id)}
                title={task.completed ? "Mark as pending" : "Mark as done"}
                className={cn(
                  "mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full border transition",
                  task.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-black/25 hover:border-emerald-500",
                )}
                data-testid={`client-index-task-toggle-${task.id}`}
              >
                {task.completed && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-sm">
                  {time && (
                    <>
                      <span className="shrink-0 font-semibold text-[#fe9a00]">{time}</span>
                      <span className="text-black/30" aria-hidden>
                        –
                      </span>
                    </>
                  )}
                  <span className={cn("truncate font-semibold", task.completed ? "text-black/40 line-through" : "text-black/90 dark:text-white")}>
                    {task.title}
                  </span>
                </div>
                {meta && <div className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">{meta}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {chip && (
                  <span className={cn("rounded-sm px-2.5 py-1 text-[11px] font-semibold", chip.className)} data-testid={`client-index-task-due-${task.id}`}>
                    {chip.label}
                  </span>
                )}
                {assigneeName && (
                  <span
                    className="grid h-6 w-6 place-items-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-600"
                    title={assigneeName}
                    data-testid={`client-index-task-assignee-${task.id}`}
                  >
                    {initials(assigneeName)}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-sm text-black/45 transition hover:bg-black/5 hover:text-black"
                      title="More"
                      data-testid={`client-index-task-menu-${task.id}`}
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-sm">
                    <DropdownMenuItem onClick={() => setEditingTask(task)} className="gap-2 rounded-sm text-sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => deleteMutation.mutate(task.id)} className="gap-2 rounded-sm text-sm text-rose-600 focus:text-rose-600">
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => navigate("/tasks")}
        className="mt-2 px-1 text-[13px] font-semibold text-[#fe9a00] transition hover:underline"
        data-testid="client-index-view-all-tasks"
      >
        View All Tasks
      </button>
      <EditTaskDialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)} task={editingTask} entityType="client" entityId={clientId} />
    </>
  );
}

// ─── Notes tab ──────────────────────────────────────────────────────────────

function NotesList({ clientId, users }: { clientId: string; users: ApiUser[] }) {
  const { data: notes, isLoading } = useClientNotes(clientId);
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);
  const rows = useMemo(
    () =>
      [...(notes ?? [])]
        .filter((n) => n.description !== "system")
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notes],
  );

  if (isLoading) return <p className="py-8 text-center text-[13px] text-black/40">Loading…</p>;
  if (rows.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40 dark:text-white/40">No notes yet. Notes are added from a quote, enquiry or booking.</p>;
  }

  return (
    <div className="divide-y divide-black/[0.05]" data-testid="client-index-notes">
      {rows.map((note) => {
        const author = note.author_name || (note.user_id && userNameById.get(note.user_id)) || (note.agent_id && userNameById.get(note.agent_id)) || "Unknown";
        return (
          <div key={note.id} className="px-1 py-3" data-testid={`client-index-note-${note.id}`}>
            <div className="text-xs">
              <span className="font-semibold text-[#3b82f6]">{author}</span>
              <span className="text-black/40"> – {longDate(note.createdAt)}</span>
            </div>
            <div className="prose prose-sm mt-1 max-w-none text-[13px] leading-relaxed text-black/75 dark:text-white/75">
              <RichTextDisplay content={note.content || ""} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Views tab ──────────────────────────────────────────────────────────────
// Which of the client's quotes they have opened, and how recently.

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return longDate(iso) ?? "";
}

function ViewsList({ clientId, navigate }: { clientId: string; navigate: (to: string) => void }) {
  const { data: views, isLoading } = useClientQuoteViews(clientId);

  if (isLoading) return <p className="py-8 text-center text-[13px] text-black/40">Loading…</p>;
  if (!views || views.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40 dark:text-white/40">The client hasn't viewed any quotes yet.</p>;
  }

  return (
    <div className="divide-y divide-black/[0.05]" data-testid="client-index-views">
      {views.map((v) => {
        const travel = longDate(v.travelDate);
        return (
          <button
            key={v.quoteId}
            type="button"
            onClick={() => navigate(`/clients/${clientId}?holiday=quote:${v.quoteId}`)}
            className="flex w-full items-center gap-3 px-1 py-3 text-left transition hover:bg-black/[0.02]"
            data-testid={`client-index-view-${v.quoteId}`}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-sky-50 text-[#07a9f4]">
              <Eye className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-black/90 dark:text-white">{v.title || "Untitled quote"}</div>
              <div className="mt-0.5 truncate text-xs text-black/45 dark:text-white/45">
                {[travel ? `Travel ${travel}` : null, v.lastDevice ? v.lastDevice : null].filter(Boolean).join(" – ")}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold text-black/85 dark:text-white/85">
                {v.viewCount} {v.viewCount === 1 ? "view" : "views"}
              </div>
              <div className="text-[11px] text-black/45 dark:text-white/45">Last {relativeTime(v.lastViewedAt)}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Dashboard tabs ─────────────────────────────────────────────────────────

type ClientIndexTab = "tasks" | "notes" | "chats" | "tickets" | "files" | "views" | "club-vip";

const CLIENT_INDEX_TABS: Array<{ value: ClientIndexTab; label: string }> = [
  { value: "tasks", label: "Tasks" },
  { value: "notes", label: "Notes" },
  { value: "chats", label: "Chats" },
  { value: "tickets", label: "Tickets" },
  { value: "files", label: "Files" },
  { value: "views", label: "Views" },
  { value: "club-vip", label: "Club VIP" },
];

// Older links used ?tab=overview / ?tab=vip-club — keep them landing somewhere sensible.
const LEGACY_TAB_ALIASES: Record<string, ClientIndexTab> = { overview: "tasks", "vip-club": "club-vip" };

function resolveInitialTab(): ClientIndexTab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  if (!t) return "tasks";
  const valid = CLIENT_INDEX_TABS.map((tab) => tab.value) as string[];
  if (valid.includes(t)) return t as ClientIndexTab;
  return LEGACY_TAB_ALIASES[t] ?? "tasks";
}

// ─── View ───────────────────────────────────────────────────────────────────

interface ClientIndexViewProps {
  clientId: string;
  client: Client;
  clientData: NeonClient | undefined;
  onSelectReferrer: (referredByClientId: string) => void;
  onClearReferrer: () => void;
  onCreateTask: () => void;
  enquiries: EnquiryTable[];
  quotes: QuoteWithJoins[];
  bookings: BookingWithJoins[];
  tasks: TaskNew[];
  navigate: (to: string) => void;
  clientFiles: ClientFile[];
  filteredFiles: FileItem[];
  onDeleteFile: (id: string) => void;
  onUploadFile: () => void;
  role: string;
  rawTickets: ApiTicket[];
  users: ApiUser[];
  onNewTicket: () => void;
}

export function ClientIndexView({
  clientId,
  client,
  clientData,
  onSelectReferrer,
  onClearReferrer,
  onCreateTask,
  enquiries,
  quotes,
  bookings,
  tasks,
  navigate,
  clientFiles,
  filteredFiles,
  onDeleteFile,
  onUploadFile,
  role,
  rawTickets,
  users,
  onNewTicket,
}: ClientIndexViewProps) {
  const [tab, setTab] = useState<ClientIndexTab>(resolveInitialTab);
  const { data: currentUser } = useCurrentUser();
  void client;

  const totalProfit = useMemo(
    () => bookings.reduce((sum, b) => sum + (parseFloat(b.package_commission || "0") || 0), 0),
    [bookings],
  );
  const avgPpb = bookings.length > 0 ? totalProfit / bookings.length : 0;
  const dashboardOwner = currentUser?.name?.trim() || "Agent";

  // Deal title + travel date by id, so a task row can say which holiday it is for.
  const taskHolidays = useMemo(() => {
    const map = new Map<string, TaskHoliday>();
    for (const e of enquiries) map.set(e.id, { title: e.title, travelDate: e.travel_date });
    for (const q of quotes) map.set(q.id, { title: q.title, travelDate: q.travel_date });
    for (const b of bookings) map.set(b.id, { title: b.title, travelDate: b.travel_date });
    return map;
  }, [enquiries, quotes, bookings]);

  return (
    <div className="min-h-full rounded-sm border border-black/10 bg-[#f7f8fa] p-3 dark:border-white/10 dark:bg-white/[0.04]" data-testid="client-index-view">
      {/* Two independent stacks: each column flows on its own, so the dashboard
          card starts right under the stats instead of under the taller right column. */}
      <div className="grid gap-3 xl:grid-cols-[1.9fr_.8fr] 2xl:grid-cols-[1.5fr_1fr] 3xl:grid-cols-[2fr_.95fr]">
        {/* Left stack matches the height of the taller column: the stats keep their own height and the dashboard card grows to fill the rest, no further. */}
        <div className="flex min-w-0 flex-col gap-3">
        {/* ── Left column: stats ─────────────────────────────────────────── */}
        <div className="shrink-0 rounded-sm border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]" data-testid="client-index-stats">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatBox label="Enquiries" value={String(enquiries.length)} caption={latestDate(enquiries.map((e) => e.date_created)) ? `Last enq. ${latestDate(enquiries.map((e) => e.date_created))}` : null} testId="client-index-stat-enquiries" />
            <StatBox label="Quotes" value={String(quotes.length)} caption={latestDate(quotes.map((q) => q.date_created)) ? `Last quote ${latestDate(quotes.map((q) => q.date_created))}` : null} testId="client-index-stat-quotes" />
            <StatBox label="Bookings" value={String(bookings.length)} caption={latestDate(bookings.map((b) => b.date_created)) ? `Last booked ${latestDate(bookings.map((b) => b.date_created))}` : null} testId="client-index-stat-bookings" />
            <StatBox label="Total Profit" value={currency.format(totalProfit)} caption={avgPpb > 0 ? `Av. PPB ${currency.format(avgPpb)}` : null} testId="client-index-stat-total-profit" />
          </div>
        </div>

        {/* ── Left column: agent dashboard ──────────────────────────────── */}
        <div className="flex flex-1 flex-col rounded-sm border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]" data-testid="client-index-tabs-card">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-black/90 dark:text-white" data-testid="client-index-dashboard-title">
              {dashboardOwner} Dashboard
            </h3>
            <button
              type="button"
              onClick={onCreateTask}
              title="Add task"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-black/15 text-black/60 transition hover:bg-black/5 hover:text-black dark:border-white/20 dark:text-white/60"
              data-testid="client-index-add-task"
            >
              <SquarePlus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 flex w-full items-center gap-1 rounded-sm border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {CLIENT_INDEX_TABS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTab(t.value)}
                className={cn(
                  "flex-1 whitespace-nowrap rounded-sm px-2 py-1 text-center text-[13px] font-semibold transition",
                  tab === t.value
                    ? "border border-black/10 bg-white text-[#fe9a00] shadow-sm dark:border-white/15 dark:bg-white/15"
                    : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white",
                )}
                data-testid={`client-index-tab-${t.value}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-2" data-testid={`client-index-tab-panel-${tab}`}>
            {tab === "tasks" && <TasksList clientId={clientId} tasks={tasks} users={users} holidays={taskHolidays} navigate={navigate} />}
            {tab === "notes" && <NotesList clientId={clientId} users={users} />}
            {tab === "chats" && <ClientChatsTab clientId={clientId} />}
            {tab === "tickets" && <ClientTicketsTab tickets={rawTickets} users={users} onNewTicket={onNewTicket} />}
            {tab === "views" && <ViewsList clientId={clientId} navigate={navigate} />}
            {tab === "files" && (
              <ClientFilesTab clientFiles={clientFiles} onDeleteFile={onDeleteFile} filteredFiles={filteredFiles} onUploadFile={onUploadFile} role={role} />
            )}
            {tab === "club-vip" && <ClientVipClubTab clientId={clientId} />}
          </div>
        </div>

        </div>

        {/* ── Right column: referred by, portal access, referral network ── */}
        <div className="flex min-w-0 flex-col gap-3 self-start">
          <div className="rounded-sm border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/[0.04]" data-testid="client-index-referrer">
            <div className="flex items-center gap-2">
              <ShieldUser className="h-[22px] w-[22px] text-[#07a9f4]" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-black/90 dark:text-white">Referred By</h3>
            </div>
            <div className="mt-3">
              <ReferrerSelector
                className="w-full"
                variant="field"
                currentReferredByClientId={clientData?.referredByClientId}
                excludeClientId={clientId}
                onSelect={onSelectReferrer}
                onClear={onClearReferrer}
              />
            </div>
          </div>
          <PortalAccessCard clientId={clientId} />
          <ReferralNetworkCard clientId={clientId} />
        </div>
      </div>
    </div>
  );
}
