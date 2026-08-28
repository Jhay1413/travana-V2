import { useState } from "react";
import { useLocation } from "wouter";
import {
  Bot,
  BotOff,
  CalendarDays,
  ChevronDown,
  Mail,
  MapPin,
  Merge,
  Pencil,
  Phone,
  Pin,
  PinOff,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { NeonClient } from "@/features/client/types/neon-client";
import type { EnquiryTable } from "@/features/quote/types";
import type { Ticket as ApiTicket } from "@/features/tickets/types";
import type { User as ApiUser } from "@/features/user/types";
import type { TaskNew, ClientFile } from "@shared/schema";
import type { Client, QuoteWithJoins, BookingWithJoins, TicketItem, FileItem } from "@/features/client/components/client-types";
import { ClientOverviewTab, PortalPinSection, ReferralStatsSection } from "@/features/client/components/tabs/ClientOverviewTab";
import { ClientFilesTab } from "@/features/client/components/tabs/ClientFilesTab";
import { ClientTicketsTab } from "@/features/client/components/tabs/ClientTicketsTab";
import { ClientChatsTab } from "@/features/client/components/tabs/ClientChatsTab";
import { ClientVipClubTab } from "@/features/client/components/tabs/ClientVipClubTab";
import { ReferrerSelector } from "@/features/client/components/sections/ReferrerSelector";

// ─── Breadcrumbs ────────────────────────────────────────────────────────────
// "Home > Clients > <client>" — same 13px muted style as HolidayDetailView's
// breadcrumbs, but the current client name is the terminal (non-link) crumb.

function IndexBreadcrumbs({ clientName }: { clientName: string }) {
  const [, navigate] = useLocation();
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 text-[13px] text-black/45 3xl:text-sm"
      data-testid="client-index-breadcrumbs"
    >
      <button
        type="button"
        onClick={() => navigate("/")}
        className="transition hover:text-black/70 hover:underline"
        data-testid="client-index-breadcrumb-home"
      >
        Home
      </button>
      <span aria-hidden>&gt;</span>
      <button
        type="button"
        onClick={() => navigate("/clients")}
        className="transition hover:text-black/70 hover:underline"
        data-testid="client-index-breadcrumb-clients"
      >
        Clients
      </button>
      <span aria-hidden>&gt;</span>
      <span className="truncate text-black/45" data-testid="client-index-breadcrumb-current" aria-disabled>
        {clientName}
      </span>
    </nav>
  );
}

// ─── Avatar ─────────────────────────────────────────────────────────────────
// Large initials circle in a hashed gradient — NeonClient has no photo field
// beyond avatarUrl, which most records don't have, so this is the primary path.

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-sky-400 to-blue-600",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-700",
];

function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

function clientInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ProfileAvatar({ clientId, name, avatarUrl }: { clientId: string; name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="h-16 w-16 shrink-0 rounded-full object-cover 3xl:h-20 3xl:w-20"
        data-testid="client-index-avatar-photo"
      />
    );
  }
  return (
    <div
      className={cn(
        "grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br text-lg font-bold text-white 3xl:h-20 3xl:w-20 3xl:text-xl",
        gradientFor(clientId),
      )}
      data-testid="client-index-avatar-initials"
    >
      {clientInitials(name)}
    </div>
  );
}

// ─── Contact field (red-icon pattern) ──────────────────────────────────────
// Grey label above, red icon + bold value — same look as the inbox's Client
// Details panel field rows.

function ClientField({ label, icon: Icon, value }: { label: string; icon: LucideIcon; value: string }) {
  return (
    <div data-testid={`client-index-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <div className="text-xs text-black/45">{label}</div>
      <div className="mt-1 flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-[#ff0000]" strokeWidth={1.25} />
        <span className="truncate text-sm font-bold 3xl:text-base">{value}</span>
      </div>
    </div>
  );
}

function memberSince(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export function composeAddress(clientData: NeonClient | undefined): string | null {
  if (!clientData) return null;
  const line1 = [clientData.houseNumber, clientData.street].filter(Boolean).join(" ");
  const line2 = [clientData.city, clientData.post_code].filter(Boolean).join(", ");
  const parts = [line1, line2, clientData.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

// ─── Badge / pin / AI-reply chips ───────────────────────────────────────────
// Cheap carry-over from the old ClientProfileHeader — same data, compact chips.

const BADGE_OPTIONS = ["New Client", "Repeat Client", "VIP Client", "Family Member", "Time Waster", "Banned"] as const;

function badgePillClass(badge: string | null | undefined): string {
  switch (badge) {
    case "VIP Client":
      return "border-blue-200 bg-blue-50 text-blue-600";
    case "Banned":
    case "Time Waster":
      return "border-red-200 bg-red-50 text-red-600";
    case "Repeat Client":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Family Member":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

// ─── Tabs ───────────────────────────────────────────────────────────────────
// Enquiries/Quotes/Booked are intentionally dropped here — the left All
// Holidays panel now covers that ground.

type ClientIndexTab = "overview" | "files" | "tickets" | "chats" | "vip-club";

const CLIENT_INDEX_TABS: Array<{ value: ClientIndexTab; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "files", label: "Files" },
  { value: "tickets", label: "Tickets" },
  { value: "chats", label: "Chats" },
  { value: "vip-club", label: "VIP Club" },
];

function resolveInitialTab(): ClientIndexTab {
  const params = new URLSearchParams(window.location.search);
  const t = params.get("tab");
  const valid = CLIENT_INDEX_TABS.map((tab) => tab.value) as string[];
  return t && valid.includes(t) ? (t as ClientIndexTab) : "overview";
}

interface ClientIndexViewProps {
  clientId: string;
  client: Client;
  clientData: NeonClient | undefined;
  onEdit: () => void;
  onMerge: () => void;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onChangeBadge: (badge: string | null) => void;
  aiReplyEnabled: boolean;
  onToggleAiReply: (enabled: boolean) => void;
  onSelectReferrer: (referredByClientId: string) => void;
  onClearReferrer: () => void;
  enquiries: EnquiryTable[];
  quotes: QuoteWithJoins[];
  bookings: BookingWithJoins[];
  overviewTickets: TicketItem[];
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
  onEdit,
  onMerge,
  isFavorited,
  onToggleFavorite,
  onChangeBadge,
  aiReplyEnabled,
  onToggleAiReply,
  onSelectReferrer,
  onClearReferrer,
  enquiries,
  quotes,
  bookings,
  overviewTickets,
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

  const since = memberSince(clientData?.createdAt);
  const address = composeAddress(clientData);

  return (
    <div data-testid="client-index-view">
      <IndexBreadcrumbs clientName={client.name} />

      <Card className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="client-index-profile-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ProfileAvatar clientId={clientId} name={client.name} avatarUrl={clientData?.avatarUrl} />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-black/90 3xl:text-xl" data-testid="client-index-name">
                {client.name}
              </h1>
              {since && (
                <div className="mt-1 text-[13px] text-black/45 3xl:text-sm" data-testid="client-index-member-since-line">
                  Member since {since}
                </div>
              )}
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95",
                        badgePillClass(clientData?.badge),
                      )}
                      data-testid="client-index-badge"
                    >
                      {clientData?.badge || "No Badge"}
                      <ChevronDown className="h-3 w-3 opacity-70" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {BADGE_OPTIONS.map((option) => (
                      <DropdownMenuItem key={option} onClick={() => onChangeBadge(option)} data-testid={`client-index-badge-option-${option}`}>
                        {option}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuItem onClick={() => onChangeBadge(null)} className="text-black/60" data-testid="client-index-badge-option-none">
                      No Badge
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <button
                  type="button"
                  onClick={onToggleFavorite}
                  aria-pressed={isFavorited}
                  title={isFavorited ? "Unpin client" : "Pin client"}
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
                    isFavorited ? "border-amber-400 bg-amber-400/20 text-amber-700" : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100",
                  )}
                  data-testid="client-index-pin"
                >
                  {isFavorited ? <Pin className="h-3 w-3 fill-current" /> : <PinOff className="h-3 w-3" />}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleAiReply(!aiReplyEnabled)}
                  aria-pressed={aiReplyEnabled}
                  title={
                    aiReplyEnabled
                      ? "AI auto-reply is ON for this client's conversations — click to turn off"
                      : "AI auto-reply is OFF for this client's conversations — click to turn on"
                  }
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95",
                    aiReplyEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-black/10 bg-black/[0.03] text-black/50",
                  )}
                  data-testid="client-index-ai-reply"
                >
                  {aiReplyEnabled ? <Bot className="h-3.5 w-3.5" /> : <BotOff className="h-3.5 w-3.5" />}
                  {aiReplyEnabled ? "AI replies on" : "AI replies off"}
                </button>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" className="h-9 rounded-md border-black/10" onClick={onEdit} data-testid="client-index-button-edit">
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="outline" className="h-9 rounded-md border-black/10" onClick={onMerge} data-testid="client-index-button-merge">
              <Merge className="mr-1.5 h-3.5 w-3.5" />
              Merge
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-black/10 pt-5 sm:grid-cols-2" data-testid="client-index-contact-fields">
          {clientData?.phoneNumber && <ClientField label="Phone" icon={Phone} value={clientData.phoneNumber} />}
          {clientData?.email && <ClientField label="Email" icon={Mail} value={clientData.email} />}
          {address && <ClientField label="Address" icon={MapPin} value={address} />}
          {since && <ClientField label="Member Since" icon={CalendarDays} value={since} />}
        </div>
      </Card>

      <Card className="mt-4 rounded-2xl border border-black/10 bg-white p-4 shadow-sm" data-testid="client-index-stats">
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Enquiries", count: enquiries.length, className: "text-emerald-500" },
            { label: "Quotes", count: quotes.length, className: "text-sky-500" },
            { label: "Bookings", count: bookings.length, className: "text-amber-500" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-black/10 px-2 py-3 text-center" data-testid={`client-index-stat-${stat.label.toLowerCase()}`}>
              <div className="text-2xl font-semibold">{stat.count}</div>
              <div className={cn("mt-0.5 text-[13px]", stat.className)}>{stat.label}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4 rounded-2xl border border-black/10 bg-white p-3 shadow-sm" data-testid="client-index-tabs-card">
        <Tabs value={tab} onValueChange={(v) => setTab(v as ClientIndexTab)}>
          <TabsList className="h-8 rounded-md border border-black/10 bg-black/[0.02] p-0.5">
            {CLIENT_INDEX_TABS.map((t) => (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="rounded-sm px-4 py-0.5 text-[13px] font-semibold data-[state=active]:font-bold 3xl:text-sm"
                data-testid={`client-index-tab-${t.value}`}
              >
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="overview" className="mt-3" data-testid="client-index-tab-panel-overview">
            <ClientOverviewTab
              clientData={clientData}
              client={client}
              enquiries={enquiries}
              quotes={quotes}
              bookings={bookings}
              tickets={overviewTickets}
              tasks={tasks}
              clientId={clientId}
              navigate={navigate}
            />

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="client-index-referrer">
                <div className="mb-1.5 text-[11px] font-semibold text-black/50">Referred by</div>
                <ReferrerSelector
                  className="w-full"
                  currentReferredByClientId={clientData?.referredByClientId}
                  excludeClientId={clientId}
                  onSelect={onSelectReferrer}
                  onClear={onClearReferrer}
                />
              </div>
              <ReferralStatsSection clientId={clientId} />
            </div>

            <div className="mt-3">
              <PortalPinSection clientId={clientId} />
            </div>
          </TabsContent>

          <TabsContent value="files" className="mt-3" data-testid="client-index-tab-panel-files">
            <ClientFilesTab
              clientFiles={clientFiles}
              onDeleteFile={onDeleteFile}
              filteredFiles={filteredFiles}
              onUploadFile={onUploadFile}
              role={role}
            />
          </TabsContent>

          <TabsContent value="tickets" className="mt-3" data-testid="client-index-tab-panel-tickets">
            <ClientTicketsTab tickets={rawTickets} users={users} onNewTicket={onNewTicket} />
          </TabsContent>

          <TabsContent value="chats" className="mt-3" data-testid="client-index-tab-panel-chats">
            <ClientChatsTab clientId={clientId} />
          </TabsContent>

          <TabsContent value="vip-club" className="mt-3" data-testid="client-index-tab-panel-vip-club">
            <ClientVipClubTab clientId={clientId} />
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
