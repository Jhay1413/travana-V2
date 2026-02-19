import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import CsvImportDialog from "@/components/csv-import-dialog";
import { useNeonClients, useTransactions, useAllTasks, useTickets } from "@/hooks/queries";
import { useCurrentUser } from "@/hooks/queries";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useRemoveFavorite } from "@/hooks/mutations/use-favorite-mutations";
import { useCreateTask } from "@/hooks/mutations";
import type { EnrichedQuote } from "@/types/quote";
import {
  Activity,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  LifeBuoy,
  ListChecks,
  Pin,
  PinOff,
  Sparkles,
  Star,
  StickyNote,
  UserRound,
  CalendarClock,
  Eye,
  Plane,
  Hotel,
  UtensilsCrossed,
  Calendar,
  Mail,
  Phone,
  FileText,
  Upload,
  Plus,
  Search,
  X,
  Users,
  Moon,
  ChevronDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TASK_PRESETS_BY_ENTITY: Record<string, string[]> = {
  general: ["Follow up", "Phone call", "Send email", "Research", "Admin"],
  enquiry: ["New Enquiry", "Start Quote"],
  quote: ["Quote Call", "Start Quote", "Call Supplier", "Quote In Progress", "Re-Quote", "Quote Follow-Up", "Book or Ditch!!!"],
  booking: ["Booking confirmation call", "Send booking confirmation", "Request passport details", "Online Visa", "Final payment", "Send travel documents", "Online check-in", "Holiday change", "Amend booking", "Cancellation"],
};

const TASK_CATEGORIES = [
  { value: "general", label: "General Task" },
  { value: "enquiry", label: "Enquiry" },
  { value: "quote", label: "Quote" },
  { value: "booking", label: "Booking" },
];

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function spFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function spFormatPrice(price: string | null | undefined): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `£${num.toFixed(2)}`;
}

function spIsSameDay(dateStr: string | null | undefined, target: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth() && d.getDate() === target.getDate();
}

function spGetFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}

function spGetSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  return parts.join(" · ") || "—";
}

function spGetHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].accomodation_name || "—";
  return "—";
}

function spGetDepartingAirport(q: EnrichedQuote): string {
  const outbound = q.flights?.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null));
  return outbound?.departing_airport_name || "—";
}

function spGetBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].board_basis_name || "—";
  return "—";
}

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const { role, setRole } = useRole();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"whats-on" | "pipeline" | "calendar" | "news">("whats-on");
  const [whatsOnFilter, setWhatsOnFilter] = useState<"today" | "tomorrow" | "this-week" | "custom">("today");
  const [whatsOnDate, setWhatsOnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [socialFilter, setSocialFilter] = useState<"today" | "tomorrow" | "date">("today");
  const [socialDate, setSocialDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [showImport, setShowImport] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [dashTaskCategory, setDashTaskCategory] = useState<string>("general");
  const [dashNewTitle, setDashNewTitle] = useState("");
  const [dashNewDueDate, setDashNewDueDate] = useState("");
  const [dashNewDueTime, setDashNewDueTime] = useState("09:00");
  const { data: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const dashCreateTaskMutation = useCreateTask("quote", "");
  const dashTaskPresets = TASK_PRESETS_BY_ENTITY[dashTaskCategory] || TASK_PRESETS_BY_ENTITY.general;

  const handleDashAddTask = () => {
    if (!dashNewTitle || !dashNewDueDate || !currentUser?.id) return;
    const dueDate = new Date(`${dashNewDueDate}T${dashNewDueTime || "09:00"}`);
    dashCreateTaskMutation.mutate(
      {
        entityType: dashTaskCategory === "booking" ? "quote" : dashTaskCategory,
        entityId: "",
        userId: currentUser.id,
        title: dashNewTitle,
        dueDate,
        completed: false,
      } as any,
      {
        onSuccess: () => {
          setShowAddTaskDialog(false);
          setDashNewTitle("");
          setDashNewDueDate("");
          setDashNewDueTime("09:00");
          setDashTaskCategory("general");
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
      }
    );
  };

  const { data: transactionsData } = useTransactions();
  const { data: allNeonClientsData } = useNeonClients({ page: 1, limit: 500 });
  const { data: paginatedNeonClients } = useNeonClients({ page: 1, limit: 10, search: q.trim() || undefined });
  const { data: allTasksData } = useAllTasks();
  const { data: allTicketsData } = useTickets();
  const { data: userFavorites } = useFavorites();
  const removeFavoriteMutation = useRemoveFavorite();

  const allClientNames = useMemo(() => {
    const map = new Map<string, string>();
    const sources = [paginatedNeonClients?.clients, allNeonClientsData?.clients];
    for (const list of sources) {
      if (list) {
        for (const c of list) {
          if (!map.has(c.id)) {
            const title = c.title && c.title !== "NULL" ? c.title : "";
            map.set(c.id, [title, c.firstName, c.surename].filter(Boolean).join(" "));
          }
        }
      }
    }
    return map;
  }, [paginatedNeonClients, allNeonClientsData]);

  const pinnedClientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (transactionsData) {
      for (const t of transactionsData as any[]) {
        if (t.client_id && allClientNames.has(t.client_id)) {
          map.set(t.id, allClientNames.get(t.client_id)!);
        }
      }
    }
    return map;
  }, [transactionsData, allClientNames]);

  const getQuoteProfit = (q: any): number => {
    const commission = parseFloat(q.package_commission) || 0;
    if (commission > 0) return commission;
    const salesPrice = parseFloat(q.sales_price) || 0;
    if (salesPrice > 0) return salesPrice * 0.1;
    return 0;
  };

  const pipelineStages = useMemo(() => {
    type PStage = "New Lead" | "In Play" | "Booked";
    const stages: Record<PStage, any[]> = { "New Lead": [], "In Play": [], "Booked": [] };
    if (!transactionsData) return stages;
    for (const t of transactionsData) {
      if (t.status === "on_booking" || t.booking) {
        stages["Booked"].push({ ...t, title: t.enquiry?.title || t.booking?.title || "Untitled", travel_date: t.booking?.travel_date || t.enquiry?.travel_date || t.created_at, sales_price: t.booking?.sales_price || t.quotes?.[0]?.sales_price, package_commission: t.booking?.package_commission || t.quotes?.[0]?.package_commission, transaction_id: t.client_id });
      } else if (t.status === "on_quote" && t.quotes && t.quotes.length > 0) {
        stages["In Play"].push({ ...t, title: t.quotes[0]?.title || t.enquiry?.title || "Untitled", travel_date: t.quotes[0]?.travel_date || t.enquiry?.travel_date || t.created_at, sales_price: t.quotes[0]?.sales_price, package_commission: t.quotes[0]?.package_commission, transaction_id: t.client_id });
      } else {
        stages["New Lead"].push({ ...t, title: t.enquiry?.title || "New Enquiry", travel_date: t.enquiry?.travel_date || t.created_at, sales_price: null, package_commission: null, transaction_id: t.client_id });
      }
    }
    return stages;
  }, [transactionsData]);

  const whatsOnDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    switch (whatsOnFilter) {
      case "today":
        return { start: today, end: tomorrow };
      case "tomorrow":
        return { start: tomorrow, end: endOfTomorrow };
      case "this-week":
        return { start: startOfWeek, end: endOfWeek };
      case "custom": {
        const d = new Date(whatsOnDate);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return { start: d, end: next };
      }
    }
  }, [whatsOnFilter, whatsOnDate]);

  const filteredTasks = useMemo(() => {
    if (!allTasksData) return [];
    return (allTasksData as any[])
      .filter((t: any) => {
        const dueVal = t.due_date || t.dueDate;
        if (!dueVal) return false;
        const due = new Date(dueVal);
        return due >= whatsOnDateRange.start && due < whatsOnDateRange.end;
      })
      .sort((a: any, b: any) => new Date(a.due_date || a.dueDate || 0).getTime() - new Date(b.due_date || b.dueDate || 0).getTime());
  }, [allTasksData, whatsOnDateRange]);

  const filteredTickets = useMemo(() => {
    if (!allTicketsData) return [];
    return allTicketsData
      .filter((t) => {
        const created = new Date(t.createdAt);
        return created >= whatsOnDateRange.start && created < whatsOnDateRange.end;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allTicketsData, whatsOnDateRange]);

  const overviewSocialPosts = useMemo(() => {
    if (!transactionsData) return [];
    const posts: { quote: EnrichedQuote; clientId: string }[] = [];
    for (const txn of transactionsData) {
      if (!txn.client_id || !txn.quotes) continue;
      for (const qu of txn.quotes) {
        if (qu.is_active === false) continue;
        posts.push({ quote: qu as EnrichedQuote, clientId: txn.client_id });
      }
    }
    posts.sort((a, b) => {
      const da = a.quote.date_created ? new Date(a.quote.date_created).getTime() : 0;
      const db = b.quote.date_created ? new Date(b.quote.date_created).getTime() : 0;
      return db - da;
    });
    return posts;
  }, [transactionsData]);

  const filteredOverviewSocialPosts = useMemo(() => {
    let result = overviewSocialPosts;
    if (socialFilter === "today") {
      const today = new Date();
      result = result.filter(({ quote: qu }) => spIsSameDay(qu.date_created, today));
    } else if (socialFilter === "tomorrow") {
      const tmrw = new Date();
      tmrw.setDate(tmrw.getDate() + 1);
      result = result.filter(({ quote: qu }) => spIsSameDay(qu.date_created, tmrw));
    } else if (socialFilter === "date" && socialDate) {
      const target = new Date(socialDate + "T00:00:00");
      result = result.filter(({ quote: qu }) => spIsSameDay(qu.date_created, target));
    }
    return result;
  }, [overviewSocialPosts, socialFilter, socialDate]);

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active="clients"
      title="Clients"
      query={q}
      onQuery={setQ}
      theme={theme}
      onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
        <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <div className="text-sm font-medium" data-testid="text-clients-title">
                Clients
              </div>
              <div className="text-xs text-muted-foreground" data-testid="text-clients-subtitle">
                Your client base at a glance.
              </div>
            </div>

            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-clients">
                <TabsTrigger value="whats-on" className="rounded-xl" data-testid="tab-clients-whats-on">
                  What's On!
                </TabsTrigger>
                <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-clients-pipeline">
                  Pipeline
                </TabsTrigger>
                <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-clients-social">
                  Social Posts
                </TabsTrigger>
                <TabsTrigger value="news" className="rounded-xl" data-testid="tab-clients-news">
                  News
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <Separator className="my-4 bg-black/10 dark:bg-white/10" />

          <Tabs value={tab}>
            <TabsContent value="whats-on" className="mt-0">
              <div className="grid gap-4" data-testid="panel-clients-whats-on">
                <div className="flex flex-wrap items-center gap-2" data-testid="clients-whats-on-filters">
                  {(["today", "tomorrow", "this-week", "custom"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setWhatsOnFilter(f)}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        whatsOnFilter === f
                          ? "bg-black text-white dark:bg-white dark:text-black"
                          : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                      }`}
                      data-testid={`button-clients-whats-on-${f}`}
                    >
                      {f === "today" ? "Today" : f === "tomorrow" ? "Tomorrow" : f === "this-week" ? "This Week" : "Select Date"}
                    </button>
                  ))}
                  {whatsOnFilter === "custom" && (
                    <DatePicker
                      value={whatsOnDate}
                      onChange={(v) => setWhatsOnDate(v)}
                      placeholder="Pick a date"
                      data-testid="input-clients-whats-on-date"
                    />
                  )}
                </div>

                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-black/50 dark:text-white/50" />
                    <div className="text-sm font-semibold" data-testid="text-clients-tasks-title">Tasks ({filteredTasks.length})</div>
                  </div>
                  {filteredTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-clients-tasks">
                      No tasks due {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                    </div>
                  ) : (
                    filteredTasks.map((task, idx) => {
                      const taskHref = task.clientId
                        ? task.transaction_type === "enquiry"
                          ? `/clients/${task.clientId}/enquiries/${task.deal_id}`
                          : task.transaction_type === "booking"
                            ? `/clients/${task.clientId}/bookings/${task.deal_id}`
                            : task.transaction_type === "quote"
                              ? `/clients/${task.clientId}/quotes/${task.deal_id}`
                              : `/clients/${task.clientId}`
                        : null;
                      return (
                        <motion.button
                          key={task.id}
                          type="button"
                          className={`group w-full rounded-2xl border p-3 text-left transition ${task.status === "completed" ? "border-emerald-500/20 bg-emerald-500/5" : "border-black/10 bg-black/5 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"}`}
                          data-testid={`card-clients-task-${task.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          onClick={() => taskHref && navigate(taskHref)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 shrink-0 rounded-full ${task.status === "completed" ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(task.due_date || 0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                                <div className={`truncate text-sm font-medium ${task.status === "completed" ? "text-black/40 line-through dark:text-white/40" : ""}`} data-testid={`text-clients-task-title-${task.id}`}>
                                  {task.clientName && <span className="text-blue-600 dark:text-blue-400">{task.clientName} — </span>}
                                  {task.title}
                                </div>
                              </div>
                              <div className="mt-1 ml-4 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                {task.tags?.map((tag: string) => (
                                  <span key={tag} className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" data-testid={`pill-clients-task-tag-${task.id}-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${task.status === "completed" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                                {task.status === "completed" ? "Done" : "Pending"}
                              </span>
                              {taskHref && <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />}
                            </div>
                          </div>
                        </motion.button>
                      );
                    })
                  )}
                </div>

                <Separator className="bg-black/10 dark:bg-white/10" />

                <div className="grid gap-3">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4 text-black/50 dark:text-white/50" />
                    <div className="text-sm font-semibold" data-testid="text-clients-tickets-title">Tickets ({filteredTickets.length})</div>
                  </div>
                  {filteredTickets.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-clients-tickets">
                      No tickets {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                    </div>
                  ) : (
                    filteredTickets.map((ticket, idx) => (
                      <motion.button
                        key={ticket.id}
                        type="button"
                        className="group w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                        data-testid={`card-clients-ticket-${ticket.id}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                        onClick={() => navigate(`/tickets/${ticket.id}`)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(ticket.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                              <span className="truncate text-sm font-medium" data-testid={`text-clients-ticket-subject-${ticket.id}`}>
                                {ticket.subject}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                              {ticket.clientName && <span>{ticket.clientName}</span>}
                              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                ticket.priority === "Urgent" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                ticket.priority === "High" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                              }`} data-testid={`pill-clients-ticket-priority-${ticket.id}`}>
                                {ticket.priority}
                              </span>
                              <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                ticket.status === "Open" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                ticket.status === "In Progress" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                ticket.status === "Resolved" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" :
                                "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                              }`} data-testid={`pill-clients-ticket-status-${ticket.id}`}>
                                {ticket.status}
                              </span>
                            </div>
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pipeline" className="mt-0">
              <div className="grid gap-3 md:grid-cols-3">
                {([
                  { stage: "New Lead" as const, hint: "No commission yet", color: "blue" },
                  { stage: "In Play" as const, hint: "Commission added", color: "amber" },
                  { stage: "Booked" as const, hint: "Confirmed", color: "emerald" },
                ] as const).map((col) => {
                  const items = pipelineStages[col.stage] || [];
                  const sum = items.reduce((s: number, qu: any) => s + getQuoteProfit(qu), 0);
                  const dotColor = col.color === "blue" ? "bg-blue-500" : col.color === "amber" ? "bg-amber-500" : "bg-emerald-500";
                  const textColor = col.color === "blue" ? "text-blue-700" : col.color === "amber" ? "text-amber-700" : "text-emerald-700";
                  return (
                    <div key={col.stage} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                            <div className={`text-sm font-semibold ${textColor}`}>
                              {col.stage}
                            </div>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {col.hint} · {items.length} quotes
                          </div>
                        </div>
                        <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          {currency.format(sum)}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {items.slice(0, 5).map((qu: any) => (
                          <button
                            key={qu.id}
                            onClick={() => navigate(col.stage === "Booked" ? `/clients/${qu.transaction_id}/bookings/${qu.booking?.id || qu.id}` : col.stage === "In Play" ? `/clients/${qu.transaction_id}/quotes/${qu.quotes?.[0]?.id || qu.id}` : `/clients/${qu.transaction_id}/enquiries/${qu.enquiry?.id || qu.id}`)}
                            className="w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                            data-testid={`card-clients-pipeline-${col.stage}-${qu.id}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-semibold" data-testid={`text-clients-pipeline-name-${qu.id}`}>
                                  {qu.title}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-black/55 dark:text-white/55">
                                  {allClientNames.get(qu.transaction_id) || "Client"}
                                </div>
                                <div className="mt-0.5 truncate text-xs text-black/40 dark:text-white/40">
                                  {new Date(qu.travel_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                </div>
                              </div>
                              <div className="text-xs font-semibold text-emerald-700" data-testid={`text-clients-pipeline-value-${qu.id}`}>
                                {getQuoteProfit(qu) > 0 ? currency.format(getQuoteProfit(qu)) : "TBC"}
                              </div>
                            </div>
                          </button>
                        ))}
                        {items.length > 5 && (
                          <button
                            onClick={() => navigate("/pipeline")}
                            className="w-full rounded-2xl border border-dashed border-black/10 p-2 text-center text-xs text-black/50 hover:bg-black/5 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                          >
                            +{items.length - 5} more · View full pipeline
                          </button>
                        )}
                        {items.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-black/10 p-3 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
                            No quotes
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-center">
                <button
                  onClick={() => navigate("/pipeline")}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  data-testid="link-clients-view-full-pipeline"
                >
                  View full pipeline →
                </button>
              </div>
            </TabsContent>

            <TabsContent value="calendar" className="mt-0">
              <div className="space-y-3" data-testid="panel-clients-social-posts">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5" data-testid="group-clients-social-filters">
                    {(["today", "tomorrow", "date"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setSocialFilter(f)}
                        className={
                          "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                          (socialFilter === f
                            ? "bg-[#3b82f6] text-white"
                            : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                        }
                        data-testid={`filter-clients-social-${f}`}
                      >
                        {f === "date" ? "Date selection" : f.charAt(0).toUpperCase() + f.slice(1)}
                      </button>
                    ))}
                  </div>

                  <div className={(socialFilter === "date" ? "flex" : "hidden") + " items-center gap-2"} data-testid="wrap-clients-social-date">
                    <DatePicker
                      value={socialDate}
                      onChange={(v) => setSocialDate(v)}
                      placeholder="Pick a date"
                      data-testid="input-clients-social-date"
                    />
                    <span className="text-xs text-black/45 dark:text-white/45" data-testid="text-clients-social-date-hint">
                      Showing: {socialDate}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-black/50 dark:text-white/50">
                  {filteredOverviewSocialPosts.length} {filteredOverviewSocialPosts.length === 1 ? "post" : "posts"} found
                </p>

                {filteredOverviewSocialPosts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
                    <CalendarClock className="w-10 h-10 mx-auto text-black/15 dark:text-white/15 mb-2" />
                    <p className="text-sm text-black/50 dark:text-white/50">No posts for this filter</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredOverviewSocialPosts.slice(0, 6).map(({ quote, clientId }) => {
                        const imageUrl = spGetFirstImage(quote);
                        const tourOp = quote.main_tour_operator_name;
                        const pricePerPerson = quote.price_per_person
                          ? `${spFormatPrice(quote.price_per_person)}pp`
                          : spFormatPrice(quote.sales_price);
                        return (
                          <motion.div
                            key={quote.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
                            data-testid={`card-clients-social-post-${quote.id}`}
                          >
                            <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                              <img
                                src={imageUrl || "/images/default-hotel.jpg"}
                                alt={quote.title || "Deal image"}
                                className="w-full h-full object-cover"
                                data-testid={`img-clients-social-post-${quote.id}`}
                              />
                              {tourOp && (
                                <Badge
                                  className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full"
                                  data-testid={`badge-tour-op-clients-${quote.id}`}
                                >
                                  {tourOp}
                                </Badge>
                              )}
                            </div>

                            <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-sp-title-${quote.id}`}>
                                    Title: <span className="font-semibold">{quote.title || "Untitled"}</span>
                                  </h3>
                                  <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate" data-testid={`text-clients-sp-subtitle-${quote.id}`}>
                                    Sub: {spGetSubtitle(quote)}
                                  </p>
                                </div>
                                <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow" data-testid={`badge-price-clients-${quote.id}`}>
                                  {pricePerPerson}
                                </Badge>
                              </div>

                              <div className="space-y-1.5 text-xs">
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Hotel:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-sp-hotel-${quote.id}`}>{spGetHotelName(quote)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Departing:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-sp-departing-${quote.id}`}>{spGetDepartingAirport(quote)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Nights:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-sp-nights-${quote.id}`}>{quote.num_of_nights}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Board:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-sp-board-${quote.id}`}>{spGetBoardBasis(quote)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Date:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-sp-travel-date-${quote.id}`}>{spFormatDate(quote.travel_date)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                  <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                  <span>Date Created:</span>
                                  <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-sp-created-${quote.id}`}>{spFormatDate(quote.date_created)}</span>
                                </div>
                              </div>

                              <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8 flex flex-col gap-3">
                                <Link href={`/clients/${clientId}/quotes/${quote.id}`}>
                                  <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2" data-testid={`button-view-quote-clients-${quote.id}`}>
                                    <Eye className="w-4 h-4" />
                                    View Quote
                                  </Button>
                                </Link>
                                <Button className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white" data-testid={`button-schedule-post-clients-${quote.id}`}>
                                  <CalendarClock className="w-4 h-4" />
                                  Schedule Post
                                </Button>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                )}

                {filteredOverviewSocialPosts.length > 6 && (
                  <div className="text-center pt-2">
                    <Link href="/social-posts">
                      <Button variant="outline" size="sm" className="rounded-xl text-xs" data-testid="link-clients-view-all-social-posts">
                        View all {filteredOverviewSocialPosts.length} posts →
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="news" className="mt-0">
              <div className="grid gap-3">
                {[
                  { title: "Travel trends 2026", src: "Skift", time: "2h ago" },
                  { title: "New BA routes to Asia", src: "TTG", time: "5h ago" },
                  { title: "ABTA conference highlights", src: "Travel Weekly", time: "1d ago" },
                ].map((n, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div>
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-xs text-black/55 dark:text-white/55">
                        {n.src} · {n.time}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/40" />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-clients-pinned-section">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10">
                  <Star className="h-3.5 w-3.5 text-amber-600" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-black/80 dark:text-white/80">Pinned</div>
                  <div className="text-[10px] text-black/45 dark:text-white/45">
                    {userFavorites && userFavorites.length > 0
                      ? `${userFavorites.length} item${userFavorites.length !== 1 ? "s" : ""}`
                      : "No items pinned yet"}
                  </div>
                </div>
              </div>
            </div>
            {userFavorites && userFavorites.length > 0 ? (
              <div className="space-y-1.5">
                {userFavorites.map((fav: any) => {
                  const icon = fav.itemType === "client" ? <UserRound className="h-3.5 w-3.5" /> : fav.itemType === "quote" ? <Sparkles className="h-3.5 w-3.5" /> : fav.itemType === "note" ? <StickyNote className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />;
                  const noteQuoteId = fav.itemType === "note" && fav.subtitle?.startsWith("quoteId:") ? fav.subtitle.split("|")[0].replace("quoteId:", "") : null;
                  const href = fav.itemType === "client" ? `/clients/${fav.itemId}` : fav.itemType === "quote" ? `/clients/_/quotes/${fav.itemId}` : fav.itemType === "enquiry" ? `/clients/_/enquiries/${fav.itemId}` : noteQuoteId ? `/clients/_/quotes/${noteQuoteId}` : "#";
                  const resolvedClientName = (fav.itemType === "quote" || fav.itemType === "note") ? pinnedClientNameMap.get(fav.itemType === "note" ? (noteQuoteId || "") : fav.itemId) : null;
                  let displaySubtitle = fav.itemType === "note" && fav.subtitle?.includes("|") ? fav.subtitle.split("|").slice(1).join("|") : fav.subtitle;
                  if (fav.itemType !== "client" && resolvedClientName && !displaySubtitle?.includes(resolvedClientName)) {
                    displaySubtitle = resolvedClientName + (displaySubtitle ? " · " + displaySubtitle : "");
                  }
                  return (
                    <motion.div
                      key={fav.id}
                      className="group flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      data-testid={`card-clients-pinned-${fav.id}`}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                        onClick={() => navigate(fav.itemType === "client" ? `/clients/${fav.itemId}` : href)}
                        data-testid={`link-clients-pinned-${fav.id}`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                          {icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{fav.label}</div>
                          {displaySubtitle && <div className="truncate text-[10px] text-black/50 dark:text-white/50">{displaySubtitle}</div>}
                        </div>
                      </button>
                      <button
                        type="button"
                        className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/30 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100 dark:text-white/30 dark:hover:bg-white/10 dark:hover:text-white/60"
                        onClick={() => removeFavoriteMutation.mutate(fav.id)}
                        title="Unpin"
                        data-testid={`button-clients-unpin-${fav.id}`}
                      >
                        <PinOff className="h-3 w-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-3 py-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
                <Pin className="mx-auto h-5 w-5 text-black/20 dark:text-white/20 mb-1.5" />
                <div className="text-[11px] text-black/40 dark:text-white/40">
                  Pin clients, quotes, or enquiries for quick access. Use the pin icon on any client card.
                </div>
              </div>
            )}
          </Card>

          <Card className="glass ringed grain rounded-3xl p-4 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition" onClick={() => navigate("/pipeline")} data-testid="card-clients-pipeline-stats">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-black/70 dark:text-white/70">Pipeline</div>
                <div className="title-serif text-2xl font-bold tabular-nums" data-testid="text-clients-pipeline-total">
                  {currency.format(
                    (pipelineStages["New Lead"] || []).reduce((s: number, qu: any) => s + getQuoteProfit(qu), 0) +
                    (pipelineStages["In Play"] || []).reduce((s: number, qu: any) => s + getQuoteProfit(qu), 0) +
                    (pipelineStages["Booked"] || []).reduce((s: number, qu: any) => s + getQuoteProfit(qu), 0)
                  )}
                </div>
              </div>
              <CircleDollarSign className="h-6 w-6 text-black/40 dark:text-white/40" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-2xl border border-blue-200/50 bg-blue-50/50 px-3 py-2 dark:border-blue-800/30 dark:bg-blue-900/20">
                <div className="text-blue-700/70 dark:text-blue-400/70">New Lead</div>
                <div className="font-medium text-blue-800 dark:text-blue-300">{(pipelineStages["New Lead"] || []).length}</div>
              </div>
              <div className="rounded-2xl border border-amber-200/50 bg-amber-50/50 px-3 py-2 dark:border-amber-800/30 dark:bg-amber-900/20">
                <div className="text-amber-700/70 dark:text-amber-400/70">In Play</div>
                <div className="font-medium text-amber-800 dark:text-amber-300">{(pipelineStages["In Play"] || []).length}</div>
              </div>
              <div className="rounded-2xl border border-emerald-200/50 bg-emerald-50/50 px-3 py-2 dark:border-emerald-800/30 dark:bg-emerald-900/20">
                <div className="text-emerald-700/70 dark:text-emerald-400/70">Booked</div>
                <div className="font-medium text-emerald-800 dark:text-emerald-300">{(pipelineStages["Booked"] || []).length}</div>
              </div>
            </div>
          </Card>

          <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-clients-activity">
            <div className="space-y-1">
              <div className="text-xs text-black/70 dark:text-white/70">Activity</div>
              <div className="title-serif text-lg font-semibold">Recent</div>
            </div>
            <div className="mt-3 space-y-2">
              {[
                { id: 1, action: "Quote sent", client: "Ava Harrington", meta: "2h ago" },
                { id: 2, action: "Booking confirmed", client: "James Whitmore", meta: "Yesterday" },
                { id: 3, action: "New enquiry", client: "Emma Richardson", meta: "2d ago" },
              ].map((a) => (
                <button
                  key={a.id}
                  className="flex w-full items-start gap-3 rounded-2xl border border-black/10 bg-black/5 p-3 text-left hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid={`card-clients-activity-${a.id}`}
                >
                  <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <Activity className="h-4 w-4 text-black/70 dark:text-white/80" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{a.action}</div>
                      <div className="shrink-0 text-xs text-black/45 dark:text-white/45">{a.meta}</div>
                    </div>
                    <div className="mt-1 truncate text-xs text-black/55 dark:text-white/55">{a.client}</div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="rounded-3xl border border-black/10 bg-black/5 p-4 ringed dark:border-white/10 dark:bg-white/5" data-testid="card-clients-assist">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs text-black/70 dark:text-white/70">Assist</div>
                <div className="title-serif text-lg font-semibold">Next-best actions</div>
                <div className="text-xs text-black/55 dark:text-white/55">
                  High intent leads and at-risk quotes detected.
                </div>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <Sparkles className="h-5 w-5 text-black/70 dark:text-white/80" />
              </div>
            </div>
            <div className="mt-3 grid gap-2">
              <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                Refresh Noah's quote with alternative departure airport (+£320 margin).
              </div>
              <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                Sofia's enquiry: propose two itineraries, one adventure-forward.
              </div>
            </div>
          </div>
        </div>
      </section>

      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />

      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-clients-add-task">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add Task</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Set a task with a due date and time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Category</Label>
              <Select value={dashTaskCategory} onValueChange={(v) => { setDashTaskCategory(v); setDashNewTitle(""); }}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-clients-task-category">
                  <SelectValue placeholder="Choose a category…" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Task</Label>
              <Select value={dashNewTitle} onValueChange={setDashNewTitle}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-clients-task-title">
                  <SelectValue placeholder="Choose a task…" />
                </SelectTrigger>
                <SelectContent>
                  {dashTaskPresets.map((preset) => (
                    <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Date</Label>
                <DatePicker
                  value={dashNewDueDate}
                  onChange={(v) => setDashNewDueDate(v)}
                  placeholder="Pick a date"
                  data-testid="input-clients-task-due-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Time</Label>
                <Input
                  type="time"
                  value={dashNewDueTime}
                  onChange={(e) => setDashNewDueTime(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-clients-task-due-time"
                />
              </div>
            </div>

            <Button
              className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-confirm-clients-add-task"
              onClick={handleDashAddTask}
              disabled={!dashNewTitle || !dashNewDueDate || dashCreateTaskMutation.isPending}
            >
              {dashCreateTaskMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Add Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}
