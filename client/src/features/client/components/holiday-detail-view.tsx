import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgePoundSterling,
  BedDouble,
  Bus,
  CalendarDays,
  Check,
  CheckSquare,
  ChevronDown,
  Copy,
  Ellipsis,
  Eye,
  Globe,
  Hotel,
  Images,
  Loader2,
  type LucideIcon,
  MapPin,
  MoonStar,
  PackagePlus,
  Paperclip,
  Pencil,
  Pin,
  PinOff,
  PlaneTakeoff,
  RefreshCw,
  Reply,
  Smile,
  SquareArrowRight,
  Tag,
  Ticket as TicketIcon,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DrawerField,
  FormDrawer,
  FormDrawerFooter,
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
} from "@/components/shared/form-drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { EMOJI_CATEGORIES } from "@/lib/emoji";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuote, useBooking, useEnquiry, useNotes, useTasks, useUsers, useCurrentUser, usePackageTypes } from "@/hooks/queries";
import {
  useCreateNote,
  useUpdateNote,
  useDeleteNote,
  useToggleTask,
  useDeleteTask,
  useCreateTask,
  useCreateQuote,
  useUpdateEnquiry,
} from "@/hooks/mutations";
import { useRole } from "@/hooks/use-role";
import { EditTaskDialog, type EditableTask } from "@/features/tasks/components/tasks/EditTaskDialog";
import { useToast } from "@/hooks/use-toast";
import { currency, formatUKDate, formatLeadSource, transformQuoteData, type QuoteDisplay } from "@/features/quote/components/quote-types";
import {
  useQuoteImages,
  useQuoteConvert,
  useQuoteDelete,
  useQuoteToFormValues,
} from "@/features/quote/components/hooks";
import { useBookingPin, useBookingDelete } from "@/features/booking/components/hooks";
import { NoteEditor } from "@/components/shared/note-editor";
import { useQuoteViews } from "@/features/quote/api/use-quote-share-queries";
import { sumUpsells } from "@/features/booking/types";
import { ClientConversationBox } from "@/features/client/components/tabs/ClientChatsTab";
import { HolidayTicketsTab } from "@/features/client/components/holiday-tickets-tab";
import { QuoteEditDialog } from "@/features/quote/components/quote-edit-dialog";
import { QuoteCreateDialog, buildQuotePayload } from "@/features/quote/components/quote-create-dialog";
import { QuoteConvertDialog } from "@/features/quote/components/QuoteConvertDialog";
import { QuoteDeleteDialog } from "@/features/quote/components/QuoteDeleteDialog";
import { QuoteRHFForm } from "@/features/quote/components/quote-rhf-form";
import { buildQuoteInitialValuesFromEnquiry } from "@/features/quote/lib/enquiry-to-quote";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { useClientTicketCreate } from "@/features/client/components/hooks";
import { BookingEditDialog } from "@/features/booking/components/booking-edit-dialog";
import { BookingUpsellsDialog } from "@/features/booking/components/BookingUpsellsDialog";
import { EnquiryWizard } from "@/features/enquiry/components/enquiry-wizard";
import { useFavorites } from "@/features/favorite/api/use-favorite-queries";
import { useToggleFavorite } from "@/features/favorite/api/use-favorite-mutations";
import type { Favorite } from "@/features/favorite/api/favorite.api";
import type { EnquiryTable, TransactionNote, CreateQuoteData, QuoteFormValues } from "@/features/quote/types";
import type { HolidaySelection } from "@/features/client/types";

// ─── Breadcrumbs ────────────────────────────────────────────────────────────
// "Home > <client> > <item>" — Home routes to "/", the client name clears the
// holiday selection so the center column falls back to the dashboard.

function Breadcrumbs({
  clientName,
  itemTitle,
  onClientClick,
}: {
  clientName: string;
  itemTitle: string;
  onClientClick: () => void;
}) {
  const [, navigate] = useLocation();
  return (
    <nav
      className="flex flex-wrap items-center gap-1.5 text-[11px] text-black/45 3xl:text-xs"
      data-testid="holiday-detail-breadcrumbs"
    >
      <button
        type="button"
        onClick={() => navigate("/")}
        className="transition hover:text-black/70 hover:underline"
        data-testid="breadcrumb-home"
      >
        Home
      </button>
      <span aria-hidden>&gt;</span>
      <button
        type="button"
        onClick={onClientClick}
        className="transition hover:text-black/70 hover:underline"
        data-testid="breadcrumb-client"
      >
        {clientName}
      </button>
      <span aria-hidden>&gt;</span>
      <span className="truncate text-black/45" data-testid="breadcrumb-current" aria-disabled>
        {itemTitle}
      </span>
    </nav>
  );
}

// ─── Hero gallery ───────────────────────────────────────────────────────────
// Display-only, per the mock: one large image left, a 2×2 grid of thumbnails
// right, with a photo-count badge on the last thumbnail. Image management stays
// on the standalone quote/booking pages.

interface GalleryImage {
  id: string;
  url: string;
}

function HeroGallery({
  primaryImage,
  galleryImages,
}: {
  primaryImage?: GalleryImage;
  galleryImages: GalleryImage[];
}) {
  // Clicking any image opens the shared lightbox over the FULL image set
  // (not just the four visible thumbnails), primary first — same viewer the
  // standalone quote/booking pages use.
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const withUrls = galleryImages.filter((img) => img.url);
  if (!primaryImage?.url) return null;
  const thumbs = withUrls.slice(0, 4);
  const total = 1 + withUrls.length;
  const lightboxImages = [primaryImage, ...withUrls].map((img) => ({ id: img.id, url: img.url }));
  return (
    <>
      {/* One visual block: only the OUTER corners are rounded (via the
          wrapper's overflow clip) and the images are separated by a thin
          0.5-unit line of card background, per the design. */}
      <div
        className={cn("grid gap-0.5 overflow-hidden rounded-lg", thumbs.length > 0 && "md:grid-cols-[3fr_2fr]")}
        data-testid="holiday-detail-gallery"
      >
        <button
          type="button"
          onClick={() => setLightboxIndex(0)}
          className="relative h-[220px] cursor-pointer overflow-hidden md:h-[260px] 3xl:h-[320px]"
          aria-label="View images"
        >
          <img src={primaryImage.url} alt="" className="h-full w-full object-cover" />
        </button>
        {thumbs.length > 0 && (
          <div className="hidden grid-cols-2 grid-rows-2 gap-0.5 md:grid">
            {thumbs.map((img, i) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setLightboxIndex(i + 1)}
                className="relative cursor-pointer overflow-hidden"
                aria-label="View image"
              >
                <img src={img.url} alt="" className="h-full w-full object-cover" />
                {i === thumbs.length - 1 && total > thumbs.length + 1 && (
                  <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <Images className="h-3 w-3" /> {total}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <ImageLightbox
        images={lightboxImages}
        open={lightboxIndex !== null}
        startIndex={lightboxIndex ?? 0}
        onOpenChange={(open) => {
          if (!open) setLightboxIndex(null);
        }}
      />
    </>
  );
}

// ─── Icon field grid ────────────────────────────────────────────────────────
// Solid orange icon chip with "Label:" and bold value inline — per the mock's
// 2-column field grid.

interface FieldRowSpec {
  key: string;
  icon: LucideIcon;
  label: string;
  value: string | null;
}

function FieldItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3" data-testid={`holiday-detail-field-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] bg-orange-500 text-white">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 truncate text-[13px] 3xl:text-sm">
        <span className="font-medium text-black/45">{label}: </span>
        <span className="font-semibold text-black/90">{value}</span>
      </div>
    </div>
  );
}

function FieldsGrid({ left, right }: { left: FieldRowSpec[]; right: FieldRowSpec[] }) {
  // Missing fields (e.g. hot tub breaks have no hotel/room/board) are dropped
  // BEFORE splitting into columns, then the survivors are rebalanced — a static
  // left/right assignment left one column with 2 rows and the other with 4.
  const rows = [...left, ...right].filter((f): f is FieldRowSpec & { value: string } => !!f.value);
  if (rows.length === 0) return null;
  const split = Math.ceil(rows.length / 2);
  const leftRows = rows.slice(0, split);
  const rightRows = rows.slice(split);
  return (
    <div className="mt-4 grid gap-x-6 gap-y-3 xl:grid-cols-2" data-testid="holiday-detail-fields-grid">
      <div className="grid content-start gap-3">
        {leftRows.map((f) => (
          <FieldItem key={f.key} icon={f.icon} label={f.label} value={f.value} />
        ))}
      </div>
      <div className="grid content-start gap-3">
        {rightRows.map((f) => (
          <FieldItem key={f.key} icon={f.icon} label={f.label} value={f.value} />
        ))}
      </div>
    </div>
  );
}

function formatQuotePassengers(quote: QuoteDisplay): string | null {
  const adults = quote.passengers?.adults ?? 0;
  const children = quote.passengers?.children ?? 0;
  const infants = quote.passengersInfants ?? 0;
  if (!adults && !children && !infants) return null;
  const parts = [`${adults} Adult${adults === 1 ? "" : "s"}`];
  if (children) parts.push(`${children} Child${children === 1 ? "" : "ren"}`);
  if (infants) parts.push(`${infants} Infant${infants === 1 ? "" : "s"}`);
  return parts.join(", ");
}

// Same field set for quotes and bookings — both share the QuoteDisplay shape
// produced by transformQuoteData.
function buildQuoteLikeFields(item: QuoteDisplay): { left: FieldRowSpec[]; right: FieldRowSpec[] } {
  return {
    // Icon set from Icons.txt ("Quote Templates"). GlobeCheck and
    // SquareArrowRightEnter aren't in the installed lucide-react — Globe and
    // SquareArrowRight are the closest available marks.
    left: [
      { key: "travel-date", icon: CalendarDays, label: "Travel Date", value: item.travelDate ? formatUKDate(item.travelDate) : null },
      { key: "hotel", icon: Hotel, label: "Hotel", value: item.accommodation?.property || null },
      { key: "room-type", icon: BedDouble, label: "Room Type", value: item.accommodation?.roomType || null },
      { key: "board-basis", icon: Utensils, label: "Board Basis", value: item.accommodation?.board || null },
      { key: "transfer-type", icon: Bus, label: "Transfer Type", value: item.transferType || "Private Transfer" },
    ],
    right: [
      { key: "departure-airport", icon: PlaneTakeoff, label: "Departure Airport", value: item.flights?.outbound?.from || null },
      { key: "tour-operator", icon: Globe, label: "Tour Operator", value: item.commissions?.tourOperator || null },
      { key: "no-passengers", icon: Users, label: "No. Passengers", value: formatQuotePassengers(item) },
      { key: "no-nights", icon: MoonStar, label: "No. Nights", value: item.nights != null ? `${item.nights} night${item.nights === 1 ? "" : "s"}` : null },
      { key: "lead-source", icon: SquareArrowRight, label: "Lead Source", value: item.leadSource ? formatLeadSource(item.leadSource) : null },
    ],
  };
}

function buildEnquiryFields(enquiry: EnquiryTable): { left: FieldRowSpec[]; right: FieldRowSpec[] } {
  const destinationName = enquiry.destinations?.[0]?.name ?? null;
  const resortName = enquiry.resorts?.[0]?.name ?? null;
  const passengerParts: string[] = [];
  if (enquiry.adults) passengerParts.push(`${enquiry.adults} Adult${enquiry.adults === 1 ? "" : "s"}`);
  if (enquiry.children) passengerParts.push(`${enquiry.children} Child${enquiry.children === 1 ? "" : "ren"}`);
  if (enquiry.infants) passengerParts.push(`${enquiry.infants} Infant${enquiry.infants === 1 ? "" : "s"}`);
  return {
    left: [
      { key: "travel-date", icon: CalendarDays, label: "Travel Date", value: enquiry.travel_date ? formatUKDate(enquiry.travel_date) : null },
      { key: "destination", icon: MapPin, label: "Destination", value: destinationName },
      { key: "resort", icon: Hotel, label: "Resort", value: resortName },
    ],
    right: [
      { key: "no-passengers", icon: Users, label: "No. Passengers", value: passengerParts.length ? passengerParts.join(", ") : null },
      { key: "no-nights", icon: MoonStar, label: "No. Nights", value: enquiry.no_of_nights ? `${enquiry.no_of_nights} night${enquiry.no_of_nights === 1 ? "" : "s"}` : null },
      { key: "budget", icon: BadgePoundSterling, label: "Budget", value: enquiry.budget ? currency.format(parseFloat(enquiry.budget)) : null },
      { key: "status", icon: Tag, label: "Status", value: enquiry.status ?? null },
    ],
  };
}

// ─── Views pill ─────────────────────────────────────────────────────────────
// "👁 9 · 58m ago" — quote share view tracking doesn't extend to bookings or
// enquiries, so this only renders for quotes.

function formatTimeAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

function ViewsPill({ quoteId }: { quoteId: string }) {
  const { data } = useQuoteViews(quoteId);
  if (!data || data.totalViews === 0) return null;
  const lastViewedAgo = formatTimeAgo(data.lastViewed);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-black/60"
      data-testid="holiday-detail-views-pill"
    >
      <Eye className="h-3 w-3" /> {data.totalViews}
      {lastViewedAgo ? ` · ${lastViewedAgo}` : ""}
    </span>
  );
}

// ─── Notes tab ──────────────────────────────────────────────────────────────
// Mock-styled note cards: light grey card, round avatar, blue author name with
// "– 25 Aug 2026, 12:52", always-visible reply / edit / delete actions at the
// right. Same notes hooks as QuoteNotesSection; only the presentation differs.
// New notes are added via the bottom composer, so the tab has no editor.

function formatNoteDateTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

// The author's uploaded profile photo (user.image) when they have one,
// otherwise their initial in a blue circle.
function NoteAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#3b82f6]/10 text-sm font-bold text-[#3b82f6]">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

function HolidayNoteCard({
  note,
  replies,
  transactionId,
  avatarByUserId,
}: {
  note: TransactionNote;
  replies: TransactionNote[];
  transactionId: string;
  avatarByUserId: Map<string, string | null>;
}) {
  const isSystem = note.description === "system";
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(transactionId);
  const deleteMutation = useDeleteNote(transactionId);
  const createMutation = useCreateNote(transactionId);

  const authorName = isSystem ? "System" : note.author_name || "Agent";
  const authorId = note.user_id || note.agent_id;
  const avatarUrl = !isSystem && authorId ? avatarByUserId.get(authorId) : null;

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: note.id, content: html },
      {
        onSuccess: () => {
          setIsEditing(false);
          toast({ title: "Note updated" });
        },
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      },
    );
  };

  const handleReply = (html: string) => {
    createMutation.mutate(
      { transaction_id: transactionId, content: html },
      {
        onSuccess: () => {
          setIsReplying(false);
          toast({ title: "Reply added" });
        },
        onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="relative mt-5" data-testid={`holiday-note-${note.id}`}>
      {/* Avatar sits at the card's top-left, straddling the TOP edge — half
          above it, half inside, per the design. The wrapper's mt-5 reserves
          room for the protruding half. */}
      <div className="absolute -top-5 left-0">
        <NoteAvatar name={authorName} imageUrl={avatarUrl} />
      </div>
      <div className="min-w-0 rounded-xl bg-black/[0.03] py-3 pl-12 pr-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 truncate text-[13px] 3xl:text-[15px]">
            <span className="font-semibold text-[#3b82f6]">{authorName}</span>
            <span className="text-black/45"> – {formatNoteDateTime(note.createdAt)}</span>
          </div>
          {!isSystem && (
            <div className="flex shrink-0 items-center gap-1.5 text-[#7c98b0]">
              <button
                type="button"
                onClick={() => setIsReplying((v) => !v)}
                className="grid h-6 w-6 place-items-center rounded transition hover:bg-black/5 hover:text-[#3b82f6]"
                title="Reply"
                data-testid={`holiday-note-reply-${note.id}`}
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditing((v) => !v)}
                className="grid h-6 w-6 place-items-center rounded transition hover:bg-black/5 hover:text-[#3b82f6]"
                title="Edit"
                data-testid={`holiday-note-edit-${note.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() =>
                  deleteMutation.mutate(note.id, {
                    onSuccess: () => toast({ title: "Note deleted" }),
                    onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
                  })
                }
                className="grid h-6 w-6 place-items-center rounded transition hover:bg-rose-50 hover:text-rose-500"
                title="Delete"
                data-testid={`holiday-note-delete-${note.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        {isEditing ? (
          <div className="mt-2">
            <NoteEditor
              initialContent={note.content ?? undefined}
              onSubmit={handleEdit}
              onCancel={() => setIsEditing(false)}
              submitLabel="Save"
              isLoading={updateMutation.isPending}
              compact
            />
          </div>
        ) : (
          <div
            className="prose prose-sm mt-1 max-w-none text-[13px] leading-relaxed text-black/70 3xl:text-[15px] [&_a]:text-[#3b82f6] [&_ol]:pl-4 [&_ul]:pl-4"
            dangerouslySetInnerHTML={{ __html: note.content || "" }}
            data-testid={`holiday-note-content-${note.id}`}
          />
        )}
        {replies.length > 0 && (
          <div className="mt-3 space-y-2 border-l-2 border-[#3b82f6]/20 pl-3">
            {replies.map((reply) => (
              <div key={reply.id} className="text-[13px]" data-testid={`holiday-note-reply-row-${reply.id}`}>
                <span className="font-semibold text-[#3b82f6]">{reply.author_name || "Agent"}</span>
                <span className="text-black/45"> – {formatNoteDateTime(reply.createdAt)}</span>
                <div
                  className="prose prose-sm mt-0.5 max-w-none leading-relaxed text-black/70"
                  dangerouslySetInnerHTML={{ __html: reply.content || "" }}
                />
              </div>
            ))}
          </div>
        )}
        {isReplying && (
          <div className="mt-2">
            <NoteEditor
              placeholder="Write a reply…"
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              submitLabel="Reply"
              isLoading={createMutation.isPending}
              compact
            />
          </div>
        )}
      </div>
    </div>
  );
}

function HolidayNotesTab({ transactionId }: { transactionId: string }) {
  const { data: notesData, isLoading } = useNotes(transactionId);
  const { data: users = [] } = useUsers();
  const avatarByUserId = useMemo(
    () => new Map(users.map((u) => [u.id, (u as { image?: string | null }).image ?? null])),
    [users],
  );

  const topLevelNotes = useMemo(
    () =>
      (notesData || [])
        .filter((n) => !n.parent_id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notesData],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, TransactionNote[]>();
    (notesData || [])
      .filter((n) => n.parent_id)
      .forEach((n) => {
        const existing = map.get(n.parent_id!) || [];
        existing.push(n);
        map.set(n.parent_id!, existing);
      });
    return map;
  }, [notesData]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (topLevelNotes.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40">No notes yet. Add one below.</p>;
  }
  return (
    <div className="space-y-3" data-testid="holiday-detail-notes">
      {topLevelNotes.map((note) => (
        <HolidayNoteCard
          key={note.id}
          note={note}
          replies={repliesByParent.get(note.id) || []}
          transactionId={transactionId}
          avatarByUserId={avatarByUserId}
        />
      ))}
    </div>
  );
}

// ─── Tasks tab ──────────────────────────────────────────────────────────────
// Mock-styled task rows: toggle circle, orange due time – bold title, "Created"
// line, then a due chip, assignee-initials chip and a "···" menu on the right.
// Same data hooks as QuoteTasksSection; only the presentation differs.

function taskDueChip(due: Date | string): { label: string; className: string } {
  const d = new Date(due);
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86_400_000);
  if (dayDiff < 0) return { label: "Overdue", className: "bg-rose-500 text-white" };
  if (dayDiff === 0) return { label: "Today", className: "bg-emerald-500 text-white" };
  if (dayDiff === 1) return { label: "Tomorrow", className: "bg-sky-500 text-white" };
  return { label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }), className: "bg-black/5 text-black/60" };
}

function taskInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Minimal "Add Task" dialog used from the Actions menu — mirrors the add-task
// form embedded in QuoteTasksSection/EnquiryTasksSection, but standalone so it
// can be opened without also mounting a full Tasks card (the tab already
// covers that).
function HolidayAddTaskDialog({
  open,
  onOpenChange,
  entityId,
  entityType,
  assignedUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityId: string;
  entityType: "enquiry" | "quote" | "booking";
  assignedUserId?: string;
}) {
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateTask(taskEntityType, entityId);
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("09:00");
  const [assignedToId, setAssignedToId] = useState("");

  const handleAdd = () => {
    const userIdForTask = assignedToId || assignedUserId || currentUser?.id;
    if (!title || !dueDate || !userIdForTask) return;
    createMutation.mutate(
      {
        entityType: taskEntityType,
        entityId,
        userId: userIdForTask,
        title,
        dueDate: new Date(`${dueDate}T${dueTime || "09:00"}`),
        completed: false,
        notified: false,
      } as any,
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle("");
          setDueDate("");
          setDueTime("09:00");
          setAssignedToId("");
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
      },
    );
  };

  const canSubmit = !!title && !!dueDate;

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Create Task"
      description="Set a task with a due date and time."
      data-testid="holiday-dialog-add-task"
    >
      <div className="space-y-5 px-7 pb-6 pt-6">
        <DrawerField label="Task" className="max-w-[420px]">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a task…"
            className={drawerInputClass}
            data-testid="holiday-input-task-title"
          />
        </DrawerField>
        <DrawerField label="Assign To" className="max-w-[420px]">
          <UserReassignSelect
            value={assignedToId || assignedUserId || currentUser?.id || ""}
            onValueChange={setAssignedToId}
            className={drawerControlClass}
            data-testid="holiday-select-task-assign-to"
          />
        </DrawerField>
      </div>
      <FormDrawerSection title="Schedule" data-testid="drawer-section-task-schedule">
        <div className="flex flex-wrap gap-x-6 gap-y-4">
          <DrawerField label="Due Date" className="w-[170px]">
            <DatePicker
              value={dueDate}
              onChange={(v) => setDueDate(v)}
              placeholder="Pick a date"
              className={drawerControlClass}
              data-testid="holiday-input-task-due-date"
            />
          </DrawerField>
          <DrawerField label="Due Time" className="w-[140px]">
            <Input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className={drawerInputClass}
              data-testid="holiday-input-task-due-time"
            />
          </DrawerField>
        </div>
      </FormDrawerSection>
      <FormDrawerFooter
        submitLabel="Create Task"
        isLoading={createMutation.isPending}
        disabled={!canSubmit}
        hint={canSubmit ? undefined : "Enter a task and a due date to save."}
        onSubmit={handleAdd}
        data-testid="drawer-footer"
      />
    </FormDrawer>
  );
}

function HolidayTasksTab({ entityId, entityType }: { entityId: string; entityType: "enquiry" | "quote" | "booking" }) {
  // Booking tasks are stored under the "quote" entity type — same mapping
  // QuoteTasksSection applies.
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: tasksData, isLoading } = useTasks(taskEntityType, entityId);
  const { data: users = [] } = useUsers();
  const toggleMutation = useToggleTask(taskEntityType, entityId);
  const deleteMutation = useDeleteTask(taskEntityType, entityId);
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);

  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name || u.email || ""])), [users]);
  const tasks = useMemo(
    () => [...(tasksData || [])].sort((a, b) => Number(a.completed) - Number(b.completed)),
    [tasksData],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (tasks.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40">No tasks yet.</p>;
  }

  return (
    <>
      <div className="divide-y divide-black/[0.04]" data-testid="holiday-detail-tasks">
        {tasks.map((task) => {
          const due = task.dueDate ? new Date(task.dueDate) : null;
          const time = due && !isNaN(due.getTime()) ? due.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
          const chip = due && !isNaN(due.getTime()) && !task.completed ? taskDueChip(due) : null;
          const assigneeName = task.userId ? userNameById.get(task.userId) || "" : "";
          return (
            <div key={task.id} className="flex items-start gap-3 px-2 py-4" data-testid={`holiday-task-${task.id}`}>
              <button
                type="button"
                onClick={() => toggleMutation.mutate(task.id)}
                title={task.completed ? "Mark as pending" : "Mark as done"}
                className={cn(
                  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition",
                  task.completed
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-black/20 hover:border-emerald-500",
                )}
                data-testid={`holiday-task-toggle-${task.id}`}
              >
                {task.completed && <Check className="h-3 w-3" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 text-[13px] 3xl:text-[15px]">
                  {time && (
                    <>
                      <span className="shrink-0 font-bold text-orange-500">{time}</span>
                      <span className="text-black/30" aria-hidden>
                        –
                      </span>
                    </>
                  )}
                  <span className={cn("truncate font-semibold", task.completed ? "text-black/40 line-through" : "text-black/85")}>
                    {task.title}
                  </span>
                </div>
                {task.createdAt && (
                  <div className="mt-0.5 text-xs text-black/45">
                    Created {new Date(task.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {chip && (
                  <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", chip.className)} data-testid={`holiday-task-due-${task.id}`}>
                    {chip.label}
                  </span>
                )}
                {assigneeName && (
                  <span
                    className="grid h-7 w-7 place-items-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700"
                    title={assigneeName}
                    data-testid={`holiday-task-assignee-${task.id}`}
                  >
                    {taskInitials(assigneeName)}
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid h-7 w-7 place-items-center rounded-md text-black/40 transition hover:bg-black/5 hover:text-black"
                      title="More"
                      data-testid={`holiday-task-menu-${task.id}`}
                    >
                      <Ellipsis className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem onClick={() => setEditingTask(task)} className="gap-2 rounded-lg text-sm">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(task.id)}
                      className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType={taskEntityType}
        entityId={entityId}
      />
    </>
  );
}

// ─── Tabs card: Notes | Inbox | Tasks | Tickets ────────────────────────────

type DetailTab = "notes" | "inbox" | "tasks" | "tickets";

const DETAIL_TABS: Array<{ value: DetailTab; label: string }> = [
  { value: "notes", label: "Notes" },
  { value: "inbox", label: "Inbox" },
  { value: "tasks", label: "Tasks" },
  { value: "tickets", label: "Tickets" },
];

function DetailTabsCard({
  transactionId,
  entityId,
  entityType,
  clientId,
}: {
  transactionId: string;
  entityId: string;
  entityType: "enquiry" | "quote" | "booking";
  clientId: string;
}) {
  const [tab, setTab] = useState<DetailTab>("notes");
  return (
    <Card className="mt-6 rounded-2xl border border-black/10 bg-white p-3 shadow-sm" data-testid="holiday-detail-tabs-card">
      <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
        <TabsList className="h-8 rounded-[6px] border border-black/10 bg-black/[0.02] p-0.5">
          {DETAIL_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="rounded-[4px] px-4 py-0.5 text-[13px] font-semibold data-[state=active]:font-bold 3xl:text-sm" data-testid={`holiday-detail-tab-${t.value}`}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="notes" className="mt-3" data-testid="holiday-detail-tab-panel-notes">
          <HolidayNotesTab transactionId={transactionId} />
        </TabsContent>

        {/* Conversations are tracked against the client's linked contact, not
            individual holidays — same source the dashboard's Chats tab uses. */}
        <TabsContent value="inbox" className="mt-3" data-testid="holiday-detail-tab-panel-inbox">
          <ClientConversationBox clientId={clientId} />
        </TabsContent>

        <TabsContent value="tasks" className="mt-3" data-testid="holiday-detail-tab-panel-tasks">
          <HolidayTasksTab entityId={entityId} entityType={entityType} />
        </TabsContent>

        <TabsContent value="tickets" className="mt-3" data-testid="holiday-detail-tab-panel-tickets">
          <HolidayTicketsTab clientId={clientId} entityId={entityId} entityType={entityType} transactionId={transactionId} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

// ─── Bottom message composer ────────────────────────────────────────────────
// Posts a transaction note — the same store the Notes tab reads from — so a
// message sent here shows up immediately regardless of which tab is active.
// Styled to match the inbox's message box: bordered card, auto-growing
// textarea (Enter sends), emoji picker, and the "Send | ⌄" outline button.

const COMPOSER_MAX_HEIGHT_PX = 120;

// Notes store HTML — escape the plain text and keep line breaks.
function noteHtmlFromText(text: string): string {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br />")}</p>`;
}

function HolidayComposer({ transactionId }: { transactionId: string }) {
  const createMutation = useCreateNote(transactionId);
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || createMutation.isPending) return;
    createMutation.mutate(
      { transaction_id: transactionId, content: noteHtmlFromText(trimmed) },
      {
        onSuccess: () => {
          setText("");
          toast({ title: "Message sent" });
        },
        onError: () => toast({ title: "Failed to send message", variant: "destructive" }),
      },
    );
  };

  // Insert at the caret rather than appending, and hand focus back so typing
  // continues where the emoji landed — same pattern as the inbox Composer.
  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el?.focus();
      const caret = start + emoji.length;
      el?.setSelectionRange(caret, caret);
    });
  };

  // Auto-grow driven off `text` so the box shrinks back after send clears it.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT_PX)}px`;
  }, [text]);

  return (
    <div className="mt-4" data-testid="holiday-detail-composer">
      <div className="rounded-xl border border-black/10 bg-white px-4 pt-3 pb-2.5 dark:border-white/10 dark:bg-white/[0.03]">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Send a message about this holiday…"
          rows={2}
          spellCheck
          lang="en-GB"
          className="min-h-[56px] w-full resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
          data-testid="holiday-composer-input"
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1 text-black/45 dark:text-white/45">
            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
                  title="Insert emoji"
                  data-testid="holiday-composer-emoji"
                >
                  <Smile className="h-4.5 w-4.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" side="top" className="w-72 p-2">
                <div className="max-h-[240px] space-y-2 overflow-y-auto" data-testid="holiday-composer-emoji-picker">
                  {EMOJI_CATEGORIES.map((cat) => (
                    <div key={cat.name}>
                      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                        {cat.name}
                      </div>
                      <div className="grid grid-cols-8 gap-0.5">
                        {cat.emojis.map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => insertEmoji(emoji)}
                            className="rounded-lg p-1 text-lg leading-none transition hover:bg-black/5 dark:hover:bg-white/10"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button
              type="button"
              disabled
              title="Attachments aren't supported on notes"
              className="grid h-8 w-8 place-items-center rounded-sm transition hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
              data-testid="holiday-composer-attach"
            >
              <Paperclip className="h-4.5 w-4.5" />
            </button>
          </div>

          <Button
            type="button"
            onClick={submit}
            disabled={!text.trim() || createMutation.isPending}
            variant="outline"
            className="h-10 shrink-0 gap-2 rounded-md border-black/10 bg-black/[0.02] px-4 text-sm font-medium text-black/60 hover:bg-black/5 hover:text-black disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:text-white/70"
            data-testid="holiday-composer-send"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
            <span className="h-4 w-px bg-black/15 dark:bg-white/15" aria-hidden />
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Loading / error shells ─────────────────────────────────────────────────

function DetailLoading({ clientName, onBack }: { clientName: string; onBack: () => void }) {
  return (
    <>
      <Breadcrumbs clientName={clientName} itemTitle="Loading…" onClientClick={onBack} />
      <div className="mt-10 flex justify-center py-16" data-testid="holiday-detail-loading">
        <Spinner className="h-8 w-8" />
      </div>
    </>
  );
}

function DetailError({ clientName, onBack }: { clientName: string; onBack: () => void }) {
  return (
    <>
      <Breadcrumbs clientName={clientName} itemTitle="Not found" onClientClick={onBack} />
      <p className="mt-10 text-center text-sm text-black/50" data-testid="holiday-detail-error">
        Unable to load this holiday.
      </p>
    </>
  );
}

// ─── Shared icon-button style ───────────────────────────────────────────────
// Squared, bordered buttons for the client page's header actions cluster
// (pin / link / share). The "···" trigger sits in the same row but is
// borderless per the design, so it gets its own class.

export const HEADER_ICON_BUTTON_CLASS =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[4px] border border-black/15 bg-white text-black/60 transition hover:bg-black/[0.03] hover:text-black dark:border-white/15 dark:bg-white/[0.04] dark:text-white/60 dark:hover:text-white";

export const HEADER_ELLIPSIS_BUTTON_CLASS =
  "inline-flex h-[30px] w-[30px] items-center justify-center rounded-[4px] text-black/60 transition hover:bg-black/[0.04] hover:text-black dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white";

// ─── Quote actions menu ─────────────────────────────────────────────────────
// Mirrors the standalone quote page's QuoteActionsRow. "Export" is left out —
// it's a no-op on the standalone page too (onExport={() => {}}), so there's
// nothing real to wire. `trigger="icon"` renders the "···" ellipsis button used
// by the client page's header actions cluster instead of the outline "Actions"
// button used in the hero card.

export function QuoteActionsMenu({
  quoteId,
  quoteData,
  quote,
  quoteImageUrls,
  clientId,
  clientName,
  onDeleted,
  trigger = "button",
}: {
  quoteId: string;
  quoteData: any;
  quote: QuoteDisplay;
  quoteImageUrls: string[];
  clientId: string;
  clientName: string;
  onDeleted: () => void;
  trigger?: "button" | "icon";
}) {
  const [, setLocation] = useLocation();
  const { role } = useRole();
  const isAdmin = role === "Admin";
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const { data: usersData } = useUsers();

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);

  const {
    showConvertDialog, setShowConvertDialog,
    convertHaysRef, setConvertHaysRef,
    convertTourRef, setConvertTourRef,
    convertToBookingMutation, confirmConvert,
  } = useQuoteConvert(quoteId, clientId);

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteQuoteMutation, openDeleteDialog, confirmDelete,
  } = useQuoteDelete(quoteId, clientId, "Quote");

  const quoteToFormValues = useQuoteToFormValues(quoteData);
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id, { transactionId: quoteData?.transaction_id ?? null });

  // useQuoteDelete already navigates away on success — the dashboard's
  // selection state is separate, so it also needs clearing here or the center
  // column stays pointed at the now-deleted quote.
  useEffect(() => {
    if (adminDeleteQuoteMutation.isSuccess) onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminDeleteQuoteMutation.isSuccess]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger === "icon" ? (
            <button
              type="button"
              className={HEADER_ELLIPSIS_BUTTON_CLASS}
              aria-label="More actions"
              data-testid="client-header-actions"
            >
              <Ellipsis className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-md border-black/10 bg-white"
              data-testid="holiday-detail-actions"
            >
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="gap-2 rounded-lg text-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit Quote
          </DropdownMenuItem>
          {quote.status !== "accepted" && (
            <DropdownMenuItem onClick={() => setShowConvertDialog(true)} className="gap-2 rounded-lg text-sm">
              <RefreshCw className="h-3.5 w-3.5" /> Convert to Booking
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => setShowCopyDialog(true)} className="gap-2 rounded-lg text-sm">
            <Copy className="h-3.5 w-3.5" /> Duplicate Quote
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => ticketCreate.setShowTicketDialog(true)} className="gap-2 rounded-lg text-sm">
            <TicketIcon className="h-3.5 w-3.5" /> Ticket
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowAddTaskDialog(true)} className="gap-2 rounded-lg text-sm">
            <CheckSquare className="h-3.5 w-3.5" /> Add Task
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openDeleteDialog} className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete Quote
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <QuoteEditDialog
        presentation="drawer"
        quoteId={quoteId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ["quotes"] })}
      />

      {quoteData && (
        <QuoteCreateDialog
          transactionId={quoteData.transaction_id}
          clientId={clientId}
          userId={currentUser?.id}
          open={showCopyDialog}
          onOpenChange={setShowCopyDialog}
          markAsCopy
          duplicateFromQuoteId={quoteData.id}
          initialValues={{ ...quoteToFormValues, discount: 0, serviceCharge: 0, pricePerPerson: 0 }}
          initialImages={quoteImageUrls}
          onSuccess={(newQuoteId) => {
            setShowCopyDialog(false);
            queryClient.invalidateQueries({ queryKey: ["quotes"] });
            toast({ title: "Quote copied successfully" });
            setLocation(`/clients/${clientId}/quotes/${newQuoteId}`);
          }}
        />
      )}

      <QuoteConvertDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        haysRef={convertHaysRef}
        onHaysRefChange={setConvertHaysRef}
        tourRef={convertTourRef}
        onTourRefChange={setConvertTourRef}
        isPending={convertToBookingMutation.isPending}
        onConfirm={confirmConvert}
      />

      <QuoteDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        pageLabel="Quote"
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isPending={adminDeleteQuoteMutation.isPending}
        onConfirm={confirmDelete}
      />

      <HolidayAddTaskDialog
        open={showAddTaskDialog}
        onOpenChange={setShowAddTaskDialog}
        entityId={quoteId}
        entityType="quote"
        assignedUserId={quoteData?.user_id}
      />

      <CreateTicketDialog
        presentation="drawer"
        open={ticketCreate.showTicketDialog}
        onOpenChange={ticketCreate.setShowTicketDialog}
        clientName={clientName || quote.quoteTitle || "this client"}
        ticketForm={ticketCreate.ticketForm}
        setTicketForm={ticketCreate.setTicketForm}
        ticketPendingFiles={ticketCreate.ticketPendingFiles}
        ticketFileInputRef={ticketCreate.ticketFileInputRef}
        isUploading={ticketCreate.isTicketUploading}
        isPending={ticketCreate.createTicketMutation.isPending}
        users={usersData ?? []}
        onFileSelect={ticketCreate.handleTicketFileSelect}
        removePendingFile={ticketCreate.removeTicketPendingFile}
        formatFileSize={ticketCreate.formatTicketFileSize}
        onConfirm={ticketCreate.handleCreateTicket}
        onReset={ticketCreate.resetTicketForm}
      />
    </>
  );
}

// ─── Quote ──────────────────────────────────────────────────────────────────

function QuoteHolidayDetail({ id, clientId, clientName, onBack }: HolidayDetailContentProps) {
  const { data: quoteData, isLoading, error } = useQuote(id);
  const { primaryImage, galleryImages, quoteImageUrls } = useQuoteImages(quoteData);

  const quote = useMemo(() => (quoteData ? transformQuoteData(quoteData) : null), [quoteData]);

  if (isLoading) return <DetailLoading clientName={clientName} onBack={onBack} />;
  if (error || !quote) return <DetailError clientName={clientName} onBack={onBack} />;

  const fields = buildQuoteLikeFields(quote);
  const title = quote.quoteTitle || "Untitled quote";

  return (
    <>
      <Breadcrumbs clientName={clientName} itemTitle={title} onClientClick={onBack} />
      <Card className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="holiday-detail-hero">
        <HeroGallery primaryImage={primaryImage} galleryImages={galleryImages} />
        {/* Text content gets its own inset beyond the card's padding — the
            gallery spans wider than the copy per the design. */}
        <div className="px-2 pb-2 3xl:px-4">
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-3">
              <h1 className="truncate text-sm font-semibold leading-tight text-black/90 3xl:text-base" data-testid="holiday-detail-title">
                {title}
              </h1>
              <span className="text-base font-semibold leading-tight text-[#f97316] 3xl:text-lg" data-testid="holiday-detail-price">
                {currency.format(quote.commissions.price)}
              </span>
              {quote.pricePerPerson > 0 && (
                <span className="text-base font-semibold ">{currency.format(quote.pricePerPerson)}pp</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ViewsPill quoteId={id} />
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-black/55" data-testid="holiday-detail-meta">
            <span>
              {quote.destinationName || quote.destination}
              {quote.countryName ? `, ${quote.countryName}` : ""}
            </span>
            <span className="text-black/25">•</span>
            <span>
              {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
            </span>
            <span className="text-black/25">•</span>
            <span>Created {formatUKDate(quote.createdAt)}</span>
          </div>
          <FieldsGrid left={fields.left} right={fields.right} />
        </div>
      </Card>
      <DetailTabsCard transactionId={quote.transaction_id} entityId={id} entityType="quote" clientId={clientId} />
      <HolidayComposer transactionId={quote.transaction_id} />
    </>
  );
}

// ─── Booking actions menu ───────────────────────────────────────────────────
// Mirrors the standalone booking page's "···" ellipsis menu: Pin, Edit,
// Manage Upsells, and (Admin only) Delete. `trigger="icon"` renders the same
// "···" ellipsis button used by the client page's header actions cluster.

export function BookingActionsMenu({
  bookingId,
  clientId,
  booking,
  onDeleted,
  trigger = "button",
}: {
  bookingId: string;
  clientId: string;
  booking: QuoteDisplay;
  onDeleted: () => void;
  trigger?: "button" | "icon";
}) {
  const { role } = useRole();
  const isAdmin = role === "Admin";

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showUpsellsDialog, setShowUpsellsDialog] = useState(false);

  const { isFavorited, togglePin } = useBookingPin(bookingId, {
    label: booking.quoteTitle ?? "",
    subtitle: `${booking.destinationName || booking.destination || ""}`,
  });

  const {
    showDeleteDialog, setShowDeleteDialog,
    deleteReason, setDeleteReason,
    adminDeleteBookingMutation, openDeleteDialog, confirmDelete,
  } = useBookingDelete(bookingId, clientId);

  useEffect(() => {
    if (adminDeleteBookingMutation.isSuccess) onDeleted();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminDeleteBookingMutation.isSuccess]);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger === "icon" ? (
            <button
              type="button"
              className={HEADER_ELLIPSIS_BUTTON_CLASS}
              aria-label="More actions"
              data-testid="client-header-actions"
            >
              <Ellipsis className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-md border-black/10 bg-white"
              data-testid="holiday-detail-actions"
            >
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem onClick={togglePin} className="gap-2 rounded-lg text-sm">
            {isFavorited ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isFavorited ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEditDialog(true)} className="gap-2 rounded-lg text-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit Booking
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowUpsellsDialog(true)} className="gap-2 rounded-lg text-sm">
            <PackagePlus className="h-3.5 w-3.5" /> Manage Upsells
          </DropdownMenuItem>
          {isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openDeleteDialog} className="gap-2 rounded-lg text-sm text-rose-600 focus:text-rose-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete Booking
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <BookingEditDialog
        presentation="drawer"
        bookingId={bookingId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
      />
      <BookingUpsellsDialog bookingId={bookingId} open={showUpsellsDialog} onOpenChange={setShowUpsellsDialog} />
      <QuoteDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        pageLabel="Booking"
        reason={deleteReason}
        onReasonChange={setDeleteReason}
        isPending={adminDeleteBookingMutation.isPending}
        onConfirm={confirmDelete}
      />
    </>
  );
}

// ─── Booking ────────────────────────────────────────────────────────────────

function BookingHolidayDetail({ id, clientId, clientName, onBack }: HolidayDetailContentProps) {
  const { data: bookingData, isLoading, error } = useBooking(id);
  const { primaryImage, galleryImages } = useQuoteImages(bookingData);

  const booking = useMemo(() => (bookingData ? transformQuoteData(bookingData) : null), [bookingData]);
  const totalPrice = useMemo(
    () => (booking ? booking.commissions.price + sumUpsells(bookingData?.upsells).price : 0),
    [booking, bookingData],
  );

  if (isLoading) return <DetailLoading clientName={clientName} onBack={onBack} />;
  if (error || !booking) return <DetailError clientName={clientName} onBack={onBack} />;

  const fields = buildQuoteLikeFields(booking);
  const title = booking.quoteTitle || "Untitled booking";

  return (
    <>
      <Breadcrumbs clientName={clientName} itemTitle={title} onClientClick={onBack} />
      <Card className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="holiday-detail-hero">
        <HeroGallery primaryImage={primaryImage} galleryImages={galleryImages} />
        <div className="px-2 pb-2 3xl:px-4">
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-baseline gap-3">
              <h1 className="truncate text-sm font-semibold leading-tight text-black/90 3xl:text-base" data-testid="holiday-detail-title">
                {title}
              </h1>
              <span className="text-base font-semibold leading-tight text-[#f97316] 3xl:text-lg" data-testid="holiday-detail-price">
                {currency.format(totalPrice)}
              </span>
              {booking.pricePerPerson > 0 && (
                <span className="text-sm font-semibold text-black/50">{currency.format(booking.pricePerPerson)}pp</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700"
                data-testid="holiday-detail-booking-badge"
              >
                Booked
              </span>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-black/55" data-testid="holiday-detail-meta">
            <span>{booking.destinationName || booking.destination}</span>
            <span className="text-black/25">•</span>
            <span>
              {formatUKDate(booking.travelDate)} → {formatUKDate(booking.returnDate)}
            </span>
            <span className="text-black/25">•</span>
            <span>Created {formatUKDate(booking.createdAt)}</span>
          </div>
          <FieldsGrid left={fields.left} right={fields.right} />
        </div>
      </Card>
      <DetailTabsCard transactionId={booking.transaction_id} entityId={id} entityType="booking" clientId={clientId} />
      <HolidayComposer transactionId={booking.transaction_id} />
    </>
  );
}

// ─── Enquiry actions menu ───────────────────────────────────────────────────
// Mirrors the standalone enquiry page's "···" ellipsis menu: Pin, Edit, and
// (when not already converted) Convert to Quote. No delete item exists there.
// `trigger="icon"` renders the same "···" ellipsis button used by the client
// page's header actions cluster.

export function EnquiryActionsMenu({
  enquiryId,
  clientId,
  clientName,
  enquiry,
  destinationName,
  trigger = "button",
}: {
  enquiryId: string;
  clientId: string;
  clientName: string;
  enquiry: EnquiryTable;
  destinationName: string | null;
  trigger?: "button" | "icon";
}) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const updateEnquiryMutation = useUpdateEnquiry();
  const createQuoteMutation = useCreateQuote();
  const { data: packageTypesData } = usePackageTypes();

  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const isEnquiryPinned = useMemo(
    () => userFavorites?.some((f: Favorite) => f.itemType === "enquiry" && f.itemId === enquiryId) ?? false,
    [userFavorites, enquiryId],
  );

  const convertDefaultValues = useMemo<Partial<QuoteFormValues>>(
    () => buildQuoteInitialValuesFromEnquiry(enquiry),
    [enquiry],
  );

  // useUpdateEnquiry's `data` param type is narrower than EnquiryTable — the
  // standalone enquiry page also widens this to `any` for the same reason.
  const handleEditSubmit = (data: any) => {
    updateEnquiryMutation.mutate(
      { id: enquiryId, data },
      {
        onSuccess: () => {
          setShowEditWizard(false);
          toast({ title: "Enquiry updated" });
        },
        onError: () => toast({ title: "Failed to update enquiry", variant: "destructive" }),
      },
    );
  };

  const handleConvertSubmit = (values: QuoteFormValues, images?: { files: File[]; urls: string[] }) => {
    if (!enquiry.transaction_id) {
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }

    const quotePayload = buildQuotePayload(values, packageTypesData);
    const imageUrls = images?.urls || [];
    const convertPayload: CreateQuoteData = {
      ...quotePayload,
      transaction_id: enquiry.transaction_id,
      ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
    } as CreateQuoteData;

    createQuoteMutation.mutate(convertPayload, {
      onSuccess: (newQuote: { id: string }) => {
        updateEnquiryMutation.mutate({ id: enquiryId, data: { status: "Converted" } });
        setShowConvertModal(false);
        toast({ title: "Enquiry converted to quote!" });
        navigate(`/clients/${clientId}/quotes/${newQuote.id}`);
      },
      onError: () => toast({ title: "Failed to convert enquiry to quote", variant: "destructive" }),
    });
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger === "icon" ? (
            <button
              type="button"
              className={HEADER_ELLIPSIS_BUTTON_CLASS}
              aria-label="More actions"
              data-testid="client-header-actions"
            >
              <Ellipsis className="h-3.5 w-3.5" />
            </button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-md border-black/10 bg-white"
              data-testid="holiday-detail-actions"
            >
              Actions
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 rounded-xl">
          <DropdownMenuItem
            onClick={() =>
              toggleFavoriteMutation.mutate(
                {
                  itemType: "enquiry",
                  itemId: enquiryId,
                  label: enquiry.title || "Enquiry",
                  subtitle: `${clientName || ""}${destinationName ? " · " + destinationName : ""}`,
                },
                {
                  onSuccess: (data: { favorited?: boolean }) =>
                    toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }),
                },
              )
            }
            className="gap-2 rounded-lg text-sm"
          >
            {isEnquiryPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isEnquiryPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowEditWizard(true)} className="gap-2 rounded-lg text-sm">
            <Pencil className="h-3.5 w-3.5" /> Edit Enquiry
          </DropdownMenuItem>
          {enquiry.status !== "Converted" && (
            <DropdownMenuItem onClick={() => setShowConvertModal(true)} className="gap-2 rounded-lg text-sm">
              <ArrowRight className="h-3.5 w-3.5" /> Convert to Quote
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EnquiryWizard
        presentation="drawer"
        open={showEditWizard}
        onOpenChange={setShowEditWizard}
        enquiry={enquiry as any}
        onSubmit={handleEditSubmit}
        isSaving={updateEnquiryMutation.isPending}
      />

      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-h-[90vh] max-w-4xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-sm font-semibold">Convert Enquiry to Quote</DialogTitle>
            <DialogDescription className="text-sm text-black/55">
              Review and adjust the details from the enquiry, then create the quote.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[calc(90vh-100px)]">
            <div className="px-6 pb-6">
              <QuoteRHFForm
                key={enquiryId + showConvertModal}
                defaultValues={convertDefaultValues}
                onSubmit={handleConvertSubmit}
                isLoading={createQuoteMutation.isPending}
                submitLabel="Convert to Quote"
                onCancel={() => setShowConvertModal(false)}
              />
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Enquiry ────────────────────────────────────────────────────────────────

function formatBudgetType(budgetType?: string | null): string {
  if (!budgetType) return "";
  return budgetType === "PER_PERSON" ? "pp" : ` ${budgetType.toLowerCase()}`;
}

function EnquiryHolidayDetail({ id, clientId, clientName, onBack }: HolidayDetailContentProps) {
  const { data: enquiry, isLoading, error } = useEnquiry(id);

  if (isLoading) return <DetailLoading clientName={clientName} onBack={onBack} />;
  if (error || !enquiry) return <DetailError clientName={clientName} onBack={onBack} />;

  const fields = buildEnquiryFields(enquiry);
  const title = enquiry.title || "Untitled enquiry";
  const destinationName = enquiry.destinations?.[0]?.name ?? null;

  return (
    <>
      <Breadcrumbs clientName={clientName} itemTitle={title} onClientClick={onBack} />
      <Card className="mt-3 rounded-2xl border border-black/10 bg-white p-5 shadow-sm" data-testid="holiday-detail-hero">
        {/* Enquiries aren't paired with uploaded images — no gallery block. */}
        <div className="px-2 pb-2 3xl:px-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-3">
            <h1 className="truncate text-sm font-semibold leading-tight text-black/90 3xl:text-base" data-testid="holiday-detail-title">
              {title}
            </h1>
            {enquiry.budget && (
              <span className="text-base font-semibold leading-tight text-[#f97316] 3xl:text-lg" data-testid="holiday-detail-price">
                {currency.format(parseFloat(enquiry.budget))}
                {formatBudgetType(enquiry.budget_type)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {enquiry.status && (
              <span
                className="inline-flex items-center rounded-full border border-blue-500/25 bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-700"
                data-testid="holiday-detail-enquiry-status"
              >
                {enquiry.status}
              </span>
            )}
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-black/55" data-testid="holiday-detail-meta">
          {destinationName && (
            <>
              <span>{destinationName}</span>
              <span className="text-black/25">•</span>
            </>
          )}
          {enquiry.travel_date && (
            <>
              <span>
                {formatUKDate(enquiry.travel_date)}
                {enquiry.no_of_nights ? ` · ${enquiry.no_of_nights} nights` : ""}
              </span>
              <span className="text-black/25">•</span>
            </>
          )}
          <span>Created {enquiry.date_created ? formatUKDate(enquiry.date_created) : "—"}</span>
        </div>
        <FieldsGrid left={fields.left} right={fields.right} />
        </div>
      </Card>
      <DetailTabsCard transactionId={enquiry.transaction_id} entityId={id} entityType="enquiry" clientId={clientId} />
      <HolidayComposer transactionId={enquiry.transaction_id} />
    </>
  );
}

// ─── Entry point ────────────────────────────────────────────────────────────

interface HolidayDetailContentProps {
  id: string;
  clientId: string;
  clientName: string;
  onBack: () => void;
}

export interface HolidayDetailViewProps {
  clientId: string;
  clientName: string;
  selection: HolidaySelection;
  onBack: () => void;
}

export function HolidayDetailView({ clientId, clientName, selection, onBack }: HolidayDetailViewProps) {
  return (
    <div data-testid="holiday-detail-view">
      {selection.type === "quote" && (
        <QuoteHolidayDetail key={selection.id} id={selection.id} clientId={clientId} clientName={clientName} onBack={onBack} />
      )}
      {selection.type === "booking" && (
        <BookingHolidayDetail key={selection.id} id={selection.id} clientId={clientId} clientName={clientName} onBack={onBack} />
      )}
      {selection.type === "enquiry" && (
        <EnquiryHolidayDetail key={selection.id} id={selection.id} clientId={clientId} clientName={clientName} onBack={onBack} />
      )}
    </div>
  );
}
