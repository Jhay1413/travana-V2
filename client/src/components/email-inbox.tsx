import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Send,
  FileText,
  Trash2,
  Star,
  Archive,
  Search,
  Plus,
  Reply,
  ReplyAll,
  Forward,
  Paperclip,
  MoreHorizontal,
  ChevronLeft,
  Clock,
  AlertCircle,
  CheckCheck,
  X,
  Bold,
  Italic,
  Underline,
  Link2,
  Image,
  List,
  ListOrdered,
  Inbox,
  Tag,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type EmailFolder = "inbox" | "sent" | "drafts" | "starred" | "archive" | "trash";

interface EmailMessage {
  id: string;
  from: { name: string; email: string; avatar?: string };
  to: { name: string; email: string }[];
  cc?: { name: string; email: string }[];
  subject: string;
  preview: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder: EmailFolder;
  labels?: string[];
  attachments?: { name: string; size: string; type: string }[];
  replies?: {
    id: string;
    from: { name: string; email: string };
    body: string;
    date: string;
  }[];
}

const MOCK_EMAILS: EmailMessage[] = [
  {
    id: "1",
    from: { name: "Sarah Thompson", email: "sarah.t@travelcorp.com" },
    to: [{ name: "You", email: "agent@tinastraveldeals.co.uk" }],
    subject: "Quote Request - Maldives Honeymoon Package",
    preview: "Hi, I'm looking for a luxury honeymoon package to the Maldives for 2 adults...",
    body: `<p>Hi,</p><p>I'm looking for a luxury honeymoon package to the Maldives for 2 adults. We're planning to travel in June 2026 for approximately 10 nights.</p><p>Our budget is around £8,000 per person and we'd prefer an overwater villa if possible. We've been looking at the Soneva Fushi and Anantara Veli — could you provide quotes for both?</p><p>We'd also like to arrange a seaplane transfer from Male airport.</p><p>Looking forward to hearing from you.</p><p>Best regards,<br/>Sarah Thompson</p>`,
    date: "2026-02-25T09:30:00",
    read: false,
    starred: true,
    folder: "inbox",
    labels: ["enquiry", "high-value"],
    attachments: [
      { name: "honeymoon-preferences.pdf", size: "245 KB", type: "pdf" },
    ],
  },
  {
    id: "2",
    from: { name: "TUI Partner Portal", email: "partners@tui.co.uk" },
    to: [{ name: "You", email: "agent@tinastraveldeals.co.uk" }],
    subject: "New Commission Rates - Summer 2026 Update",
    preview: "Dear Partner, We're pleased to announce updated commission rates for the summer 2026 season...",
    body: `<p>Dear Partner,</p><p>We're pleased to announce updated commission rates for the summer 2026 season. Key changes include:</p><ul><li>Package holidays: 12% → 14% commission</li><li>Premium resorts: 15% → 16% commission</li><li>Long-haul destinations: Additional 2% bonus</li></ul><p>These rates are effective from 1st March 2026. Please update your systems accordingly.</p><p>Best regards,<br/>TUI Partner Team</p>`,
    date: "2026-02-25T08:15:00",
    read: false,
    starred: false,
    folder: "inbox",
    labels: ["commission"],
  },
  {
    id: "3",
    from: { name: "James Love", email: "james@tinastraveldeals.co.uk" },
    to: [{ name: "You", email: "agent@tinastraveldeals.co.uk" }],
    subject: "RE: Client Follow-Up - Mr & Mrs Henderson",
    preview: "Just spoken to the Hendersons, they're happy with the revised quote. Can you process the booking?",
    body: `<p>Hi,</p><p>Just spoken to the Hendersons, they're happy with the revised quote for the Canary Islands package. Can you process the booking today?</p><p>Details:</p><ul><li>Resort: H10 Rubicon Palace, Lanzarote</li><li>Dates: 15th-22nd July 2026</li><li>2 adults, 1 child (age 8)</li><li>All Inclusive</li><li>Total: £3,240</li></ul><p>They want to pay the deposit today (£150pp) and the balance by 1st May.</p><p>Cheers,<br/>James</p>`,
    date: "2026-02-24T16:42:00",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["booking"],
    replies: [
      {
        id: "3r1",
        from: { name: "You", email: "agent@tinastraveldeals.co.uk" },
        body: "Great news! I'll get the booking processed this afternoon. Will send confirmation to the Hendersons by EOD.",
        date: "2026-02-24T17:10:00",
      },
    ],
  },
  {
    id: "4",
    from: { name: "Casey Ashman", email: "casey@tinastraveldeals.co.uk" },
    to: [{ name: "You", email: "agent@tinastraveldeals.co.uk" }],
    subject: "Social Media Post Approval - Turkey Deals",
    preview: "Can you review the Turkey deals post before I schedule it for tomorrow morning?",
    body: `<p>Hi,</p><p>Can you review the Turkey deals post before I schedule it for tomorrow morning? I've attached the images we discussed.</p><p>Copy: "🌞 Last-minute Turkey deals from just £399pp! 5* All Inclusive in Antalya, flying from Newcastle. Limited availability — DM us to book!"</p><p>Let me know if any changes needed.</p><p>Thanks,<br/>Casey</p>`,
    date: "2026-02-24T14:20:00",
    read: true,
    starred: false,
    folder: "inbox",
    labels: ["social"],
    attachments: [
      { name: "turkey-deal-1.jpg", size: "1.2 MB", type: "image" },
      { name: "turkey-deal-2.jpg", size: "980 KB", type: "image" },
    ],
  },
  {
    id: "5",
    from: { name: "Mr David Wilson", email: "david.wilson@gmail.com" },
    to: [{ name: "You", email: "agent@tinastraveldeals.co.uk" }],
    subject: "Complaint - Airport Transfer Issue",
    preview: "I need to raise a formal complaint about the airport transfer that was arranged for our recent trip...",
    body: `<p>Dear Travel Team,</p><p>I need to raise a formal complaint about the airport transfer that was arranged for our recent trip to Tenerife (Booking Ref: TTD-2026-1847).</p><p>The transfer was 45 minutes late arriving at the airport, and the driver took us to the wrong hotel initially. This caused significant stress at the start of our holiday.</p><p>I would appreciate a response within 48 hours with details of how you plan to resolve this matter.</p><p>Regards,<br/>David Wilson</p>`,
    date: "2026-02-24T11:05:00",
    read: false,
    starred: true,
    folder: "inbox",
    labels: ["complaint", "urgent"],
  },
  {
    id: "6",
    from: { name: "You", email: "agent@tinastraveldeals.co.uk" },
    to: [{ name: "Mrs Patricia Green", email: "pat.green@outlook.com" }],
    subject: "Your Cruise Quote - Mediterranean 14 Nights",
    preview: "Dear Mrs Green, Thank you for your enquiry. Please find attached the quote for your Mediterranean cruise...",
    body: `<p>Dear Mrs Green,</p><p>Thank you for your enquiry regarding a Mediterranean cruise. Please find attached the detailed quote for a 14-night cruise departing from Southampton on 5th September 2026.</p><p><strong>Package Summary:</strong></p><ul><li>Ship: MSC Virtuosa</li><li>Cabin: Balcony Fantastica</li><li>Itinerary: Southampton → Barcelona → Marseille → Genoa → Naples → Valletta → Southampton</li><li>Price: £2,890 per person (based on 2 sharing)</li><li>Includes: All meals, entertainment, port charges</li></ul><p>This price is valid until 1st March. Would you like to proceed with a deposit?</p><p>Kind regards</p>`,
    date: "2026-02-24T09:30:00",
    read: true,
    starred: false,
    folder: "sent",
    labels: ["quote"],
    attachments: [
      { name: "cruise-quote-PG-2026.pdf", size: "512 KB", type: "pdf" },
    ],
  },
  {
    id: "7",
    from: { name: "You", email: "agent@tinastraveldeals.co.uk" },
    to: [{ name: "Mr & Mrs Henderson", email: "henderson.family@gmail.com" }],
    subject: "Booking Confirmation - Lanzarote July 2026",
    preview: "Dear Mr & Mrs Henderson, I'm pleased to confirm your booking for the H10 Rubicon Palace...",
    body: `<p>Dear Mr & Mrs Henderson,</p><p>I'm pleased to confirm your booking for the H10 Rubicon Palace, Lanzarote.</p><p><strong>Booking Reference:</strong> TTD-2026-2103</p><p><strong>Details:</strong></p><ul><li>Dates: 15th - 22nd July 2026 (7 nights)</li><li>Hotel: H10 Rubicon Palace ★★★★★</li><li>Room: Family Suite, All Inclusive</li><li>Passengers: 2 Adults, 1 Child (age 8)</li><li>Flights: Newcastle → Arrecife (TUI)</li><li>Total: £3,240</li></ul><p>Deposit of £450 has been received. Balance of £2,790 due by 1st May 2026.</p><p>Kind regards</p>`,
    date: "2026-02-24T17:30:00",
    read: true,
    starred: false,
    folder: "sent",
    labels: ["booking"],
  },
  {
    id: "8",
    from: { name: "You", email: "agent@tinastraveldeals.co.uk" },
    to: [{ name: "Sarah Thompson", email: "sarah.t@travelcorp.com" }],
    subject: "Draft: Maldives Quote Options",
    preview: "Hi Sarah, Thank you for your enquiry about the Maldives honeymoon package. I've put together...",
    body: `<p>Hi Sarah,</p><p>Thank you for your enquiry about the Maldives honeymoon package. I've put together two options for you:</p><p><strong>Option A - Soneva Fushi</strong></p><ul><li>10 nights in a Water Villa</li><li>Half Board Plus</li><li>Seaplane transfers</li><li>Price: £7,650pp</li></ul><p><strong>Option B - Anantara Veli</strong></p><ul><li>10 nights in an Overwater Bungalow</li><li>All Inclusive</li><li>Speedboat transfer</li><li>Price: £6,890pp</li></ul>`,
    date: "2026-02-25T10:00:00",
    read: true,
    starred: false,
    folder: "drafts",
    labels: ["quote"],
  },
];

const LABEL_COLORS: Record<string, string> = {
  enquiry: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "high-value": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  commission: "bg-green-500/15 text-green-600 dark:text-green-400",
  booking: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  social: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  complaint: "bg-red-500/15 text-red-600 dark:text-red-400",
  urgent: "bg-red-500/15 text-red-600 dark:text-red-400",
  quote: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
};

function formatEmailDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHrs = diffMs / (1000 * 60 * 60);

  if (diffHrs < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
  if (diffHrs < 24) return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (diffHrs < 48) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatFullDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAttachmentIcon(type: string) {
  if (type === "image") return <Image className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export default function EmailInbox() {
  const [folder, setFolder] = useState<EmailFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [emails, setEmails] = useState<EmailMessage[]>(MOCK_EMAILS);
  const [composeData, setComposeData] = useState({ to: "", cc: "", subject: "", body: "" });
  const [replying, setReplying] = useState<"reply" | "reply-all" | "forward" | null>(null);
  const [replyBody, setReplyBody] = useState("");

  const folderCounts = useMemo(() => {
    const counts: Record<EmailFolder, number> = { inbox: 0, sent: 0, drafts: 0, starred: 0, archive: 0, trash: 0 };
    emails.forEach((e) => {
      counts[e.folder]++;
      if (e.starred) counts.starred++;
    });
    return counts;
  }, [emails]);

  const unreadCount = useMemo(() => emails.filter((e) => e.folder === "inbox" && !e.read).length, [emails]);

  const filteredEmails = useMemo(() => {
    let list = folder === "starred" ? emails.filter((e) => e.starred) : emails.filter((e) => e.folder === folder);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.name.toLowerCase().includes(q) ||
          e.from.email.toLowerCase().includes(q) ||
          e.preview.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [emails, folder, search]);

  const selectedEmail = useMemo(() => emails.find((e) => e.id === selectedId) || null, [emails, selectedId]);

  const toggleStar = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, starred: !e.starred } : e)));
  };

  const markAsRead = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, read: true } : e)));
  };

  const moveToTrash = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, folder: "trash" as EmailFolder } : e)));
    if (selectedId === id) setSelectedId(null);
  };

  const archiveEmail = (id: string) => {
    setEmails((prev) => prev.map((e) => (e.id === id ? { ...e, folder: "archive" as EmailFolder } : e)));
    if (selectedId === id) setSelectedId(null);
  };

  const openEmail = (email: EmailMessage) => {
    setSelectedId(email.id);
    markAsRead(email.id);
    setReplying(null);
    setReplyBody("");
  };

  const folders: { key: EmailFolder; label: string; icon: React.ReactNode }[] = [
    { key: "inbox", label: "Inbox", icon: <Inbox className="h-4 w-4" /> },
    { key: "sent", label: "Sent", icon: <Send className="h-4 w-4" /> },
    { key: "drafts", label: "Drafts", icon: <FileText className="h-4 w-4" /> },
    { key: "starred", label: "Starred", icon: <Star className="h-4 w-4" /> },
    { key: "archive", label: "Archive", icon: <Archive className="h-4 w-4" /> },
    { key: "trash", label: "Trash", icon: <Trash2 className="h-4 w-4" /> },
  ];

  return (
    <section className="grid h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[220px_340px_1fr]" data-testid="section-email">
      {/* Folder sidebar */}
      <Card className="glass ringed grain flex flex-col rounded-3xl p-3 overflow-hidden">
        <Button
          onClick={() => { setComposing(true); setSelectedId(null); setComposeData({ to: "", cc: "", subject: "", body: "" }); }}
          className="mb-3 h-10 w-full rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-2"
          data-testid="button-compose"
        >
          <Plus className="h-4 w-4" />
          Compose
        </Button>

        <div className="space-y-0.5 flex-1">
          {folders.map((f) => {
            const isActive = folder === f.key;
            const count = f.key === "inbox" ? unreadCount : f.key === "starred" ? folderCounts.starred : folderCounts[f.key];
            return (
              <button
                key={f.key}
                onClick={() => { setFolder(f.key); setSelectedId(null); setComposing(false); }}
                className={
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm transition " +
                  (isActive
                    ? "bg-black/8 text-black font-medium dark:bg-white/10 dark:text-white"
                    : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white")
                }
                data-testid={`email-folder-${f.key}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className={isActive ? "text-[#3b82f6]" : ""}>{f.icon}</span>
                  {f.label}
                </div>
                {count > 0 && (
                  <span className={
                    "text-xs rounded-full px-1.5 py-0.5 min-w-[20px] text-center " +
                    (f.key === "inbox" && unreadCount > 0
                      ? "bg-[#3b82f6] text-white font-medium"
                      : "bg-black/10 text-black/50 dark:bg-white/10 dark:text-white/50")
                  }>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Separator className="my-2 bg-black/10 dark:bg-white/10" />
        <div className="space-y-0.5">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">Labels</div>
          {["enquiry", "booking", "quote", "complaint", "commission"].map((label) => (
            <div key={label} className="flex items-center gap-2 px-3 py-1.5 text-xs text-black/60 dark:text-white/60">
              <Tag className="h-3 w-3" />
              <span className="capitalize">{label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Email list */}
      <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
        <div className="border-b border-black/10 px-4 py-3 dark:border-white/10">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold capitalize">{folder === "starred" ? "Starred" : folder}</div>
            <span className="text-xs text-black/50 dark:text-white/50">{filteredEmails.length} emails</span>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/40 dark:text-white/40" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search emails..."
              className="h-8 pl-9 text-xs rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
              data-testid="input-email-search"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredEmails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-black/40 dark:text-white/40 gap-2 py-12">
              <Mail className="h-10 w-10" />
              <span className="text-sm">No emails in {folder}</span>
            </div>
          ) : (
            filteredEmails.map((email) => (
              <div
                key={email.id}
                role="button"
                tabIndex={0}
                onClick={() => openEmail(email)}
                onKeyDown={(e) => { if (e.key === "Enter") openEmail(email); }}
                className={
                  "w-full text-left border-b border-black/5 px-4 py-3 transition cursor-pointer dark:border-white/5 " +
                  (selectedId === email.id
                    ? "bg-[#3b82f6]/8 dark:bg-[#3b82f6]/15"
                    : email.read
                      ? "hover:bg-black/3 dark:hover:bg-white/3"
                      : "bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-500/5 dark:hover:bg-blue-500/10")
                }
                data-testid={`email-item-${email.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex flex-col items-center gap-1 pt-0.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleStar(email.id); }}
                      className="hover:scale-110 transition"
                      data-testid={`email-star-${email.id}`}
                    >
                      <Star className={`h-3.5 w-3.5 ${email.starred ? "fill-amber-400 text-amber-400" : "text-black/20 dark:text-white/20"}`} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs truncate ${!email.read ? "font-semibold text-black dark:text-white" : "font-medium text-black/70 dark:text-white/70"}`}>
                        {folder === "sent" || folder === "drafts" ? `To: ${email.to[0]?.name}` : email.from.name}
                      </span>
                      <span className="text-[10px] text-black/40 dark:text-white/40 whitespace-nowrap flex items-center gap-1">
                        {email.attachments && <Paperclip className="h-2.5 w-2.5" />}
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                    <div className={`text-xs mt-0.5 truncate ${!email.read ? "font-medium text-black/90 dark:text-white/90" : "text-black/60 dark:text-white/60"}`}>
                      {email.subject}
                    </div>
                    <div className="text-[11px] mt-0.5 text-black/40 dark:text-white/40 truncate">
                      {email.preview}
                    </div>
                    {email.labels && email.labels.length > 0 && (
                      <div className="flex gap-1 mt-1.5">
                        {email.labels.map((l) => (
                          <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[l] || "bg-gray-500/15 text-gray-600"}`}>
                            {l}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {!email.read && (
                    <div className="h-2 w-2 rounded-full bg-[#3b82f6] mt-1.5 flex-shrink-0" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {/* Email detail / Compose */}
      <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {composing ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-3 dark:border-white/10">
                <div className="text-sm font-semibold">New Message</div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setComposing(false)}
                  className="rounded-xl h-8 w-8 p-0"
                  data-testid="button-close-compose"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 flex flex-col px-5 py-3 gap-2 overflow-y-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/50 dark:text-white/50 w-8">To</span>
                  <Input
                    value={composeData.to}
                    onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                    placeholder="recipient@example.com"
                    className="h-8 text-xs rounded-xl border-black/10 bg-transparent dark:border-white/10 flex-1"
                    data-testid="compose-to"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-black/50 dark:text-white/50 w-8">Cc</span>
                  <Input
                    value={composeData.cc}
                    onChange={(e) => setComposeData({ ...composeData, cc: e.target.value })}
                    placeholder="cc@example.com"
                    className="h-8 text-xs rounded-xl border-black/10 bg-transparent dark:border-white/10 flex-1"
                    data-testid="compose-cc"
                  />
                </div>
                <Separator className="bg-black/10 dark:bg-white/10" />
                <Input
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  placeholder="Subject"
                  className="h-9 text-sm font-medium rounded-xl border-0 bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                  data-testid="compose-subject"
                />
                <Separator className="bg-black/10 dark:bg-white/10" />
                <div className="flex gap-1 py-1 border-b border-black/5 dark:border-white/5">
                  {[Bold, Italic, Underline].map((Icon, i) => (
                    <button key={i} className="h-7 w-7 rounded-lg flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition">
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                  <div className="w-px bg-black/10 dark:bg-white/10 mx-1" />
                  {[List, ListOrdered, Link2].map((Icon, i) => (
                    <button key={i} className="h-7 w-7 rounded-lg flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition">
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
                <textarea
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  placeholder="Write your message..."
                  className="flex-1 min-h-[200px] text-sm resize-none bg-transparent outline-none text-black/80 dark:text-white/80 placeholder:text-black/30 dark:placeholder:text-white/30"
                  data-testid="compose-body"
                />
              </div>
              <div className="border-t border-black/10 px-5 py-3 dark:border-white/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <Button className="h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-2 text-sm" data-testid="button-send-email">
                    <Send className="h-3.5 w-3.5" />
                    Send
                  </Button>
                  <Button variant="outline" className="h-9 rounded-xl border-black/10 dark:border-white/10 text-sm" data-testid="button-save-draft">
                    <FileText className="h-3.5 w-3.5 mr-1.5" />
                    Save Draft
                  </Button>
                </div>
                <div className="flex gap-1">
                  <button className="h-8 w-8 rounded-lg flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition">
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button className="h-8 w-8 rounded-lg flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition">
                    <Image className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setComposing(false); setComposeData({ to: "", cc: "", subject: "", body: "" }); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedEmail ? (
            <motion.div
              key={`email-${selectedEmail.id}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col h-full"
            >
              <div className="flex items-center justify-between border-b border-black/10 px-5 py-3 dark:border-white/10">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { setSelectedId(null); setReplying(null); }}
                    className="lg:hidden h-8 w-8 rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition"
                    data-testid="button-back-list"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-semibold truncate max-w-[300px]">{selectedEmail.subject}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => archiveEmail(selectedEmail.id)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition"
                    data-testid="button-archive-email"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveToTrash(selectedEmail.id)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-black/40 hover:text-red-500 hover:bg-red-50 dark:text-white/40 dark:hover:text-red-400 dark:hover:bg-red-500/10 transition"
                    data-testid="button-trash-email"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="h-8 w-8 rounded-xl flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 rounded-xl">
                      <DropdownMenuItem className="rounded-lg text-xs gap-2">
                        <CheckCheck className="h-3.5 w-3.5" /> Mark as unread
                      </DropdownMenuItem>
                      <DropdownMenuItem className="rounded-lg text-xs gap-2">
                        <Tag className="h-3.5 w-3.5" /> Add label
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="rounded-lg text-xs gap-2">
                        <AlertCircle className="h-3.5 w-3.5" /> Report spam
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                      {selectedEmail.from.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{selectedEmail.from.name}</span>
                        {selectedEmail.labels?.map((l) => (
                          <span key={l} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${LABEL_COLORS[l] || "bg-gray-500/15 text-gray-600"}`}>
                            {l}
                          </span>
                        ))}
                      </div>
                      <div className="text-xs text-black/50 dark:text-white/50">{selectedEmail.from.email}</div>
                      <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                        To: {selectedEmail.to.map((t) => t.name || t.email).join(", ")}
                        {selectedEmail.cc && selectedEmail.cc.length > 0 && ` | Cc: ${selectedEmail.cc.map((c) => c.name || c.email).join(", ")}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40 whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {formatFullDate(selectedEmail.date)}
                  </div>
                </div>

                <div
                  className="prose prose-sm dark:prose-invert max-w-none text-black/80 dark:text-white/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body }}
                />

                {selectedEmail.attachments && selectedEmail.attachments.length > 0 && (
                  <div className="mt-6">
                    <div className="text-xs font-semibold text-black/50 dark:text-white/50 mb-2 flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3" />
                      {selectedEmail.attachments.length} Attachment{selectedEmail.attachments.length > 1 ? "s" : ""}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedEmail.attachments.map((att, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 rounded-xl border border-black/10 bg-black/3 px-3 py-2 dark:border-white/10 dark:bg-white/3 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
                        >
                          {getAttachmentIcon(att.type)}
                          <div>
                            <div className="text-xs font-medium truncate max-w-[150px]">{att.name}</div>
                            <div className="text-[10px] text-black/40 dark:text-white/40">{att.size}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEmail.replies && selectedEmail.replies.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <Separator className="bg-black/10 dark:bg-white/10" />
                    {selectedEmail.replies.map((reply) => (
                      <div key={reply.id} className="rounded-2xl border border-black/8 bg-black/2 p-4 dark:border-white/8 dark:bg-white/2">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[10px] font-medium">
                              {reply.from.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="text-xs font-semibold">{reply.from.name}</span>
                              <span className="text-[10px] text-black/40 dark:text-white/40 ml-2">{reply.from.email}</span>
                            </div>
                          </div>
                          <span className="text-[10px] text-black/40 dark:text-white/40">{formatFullDate(reply.date)}</span>
                        </div>
                        <div className="text-sm text-black/70 dark:text-white/70 pl-9">{reply.body}</div>
                      </div>
                    ))}
                  </div>
                )}

                <AnimatePresence>
                  {replying && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <Separator className="my-4 bg-black/10 dark:bg-white/10" />
                      <div className="rounded-2xl border border-black/10 bg-black/2 p-4 dark:border-white/10 dark:bg-white/2">
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-xs font-semibold text-black/60 dark:text-white/60 flex items-center gap-1.5">
                            {replying === "reply" && <><Reply className="h-3.5 w-3.5" /> Reply to {selectedEmail.from.name}</>}
                            {replying === "reply-all" && <><ReplyAll className="h-3.5 w-3.5" /> Reply All</>}
                            {replying === "forward" && <><Forward className="h-3.5 w-3.5" /> Forward</>}
                          </div>
                          <button
                            onClick={() => { setReplying(null); setReplyBody(""); }}
                            className="h-6 w-6 rounded-lg flex items-center justify-center text-black/30 hover:text-black dark:text-white/30 dark:hover:text-white transition"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {replying === "forward" && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-black/50 dark:text-white/50">To</span>
                            <Input
                              placeholder="recipient@example.com"
                              className="h-7 text-xs rounded-lg border-black/10 bg-white/50 dark:border-white/10 dark:bg-black/20"
                              data-testid="forward-to"
                            />
                          </div>
                        )}
                        <textarea
                          value={replyBody}
                          onChange={(e) => setReplyBody(e.target.value)}
                          placeholder="Write your reply..."
                          className="w-full min-h-[120px] text-sm resize-none bg-transparent outline-none text-black/80 dark:text-white/80 placeholder:text-black/30 dark:placeholder:text-white/30"
                          data-testid="reply-body"
                        />
                        <div className="flex items-center justify-between mt-2">
                          <Button className="h-8 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-1.5 text-xs" data-testid="button-send-reply">
                            <Send className="h-3 w-3" />
                            Send
                          </Button>
                          <button className="h-7 w-7 rounded-lg flex items-center justify-center text-black/30 hover:text-black hover:bg-black/5 dark:text-white/30 dark:hover:text-white dark:hover:bg-white/5 transition">
                            <Paperclip className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {!replying && (
                <div className="border-t border-black/10 px-5 py-3 dark:border-white/10 flex gap-2">
                  <Button
                    onClick={() => setReplying("reply")}
                    variant="outline"
                    className="h-9 rounded-xl border-black/10 dark:border-white/10 gap-1.5 text-xs"
                    data-testid="button-reply"
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Reply
                  </Button>
                  <Button
                    onClick={() => setReplying("reply-all")}
                    variant="outline"
                    className="h-9 rounded-xl border-black/10 dark:border-white/10 gap-1.5 text-xs"
                    data-testid="button-reply-all"
                  >
                    <ReplyAll className="h-3.5 w-3.5" />
                    Reply All
                  </Button>
                  <Button
                    onClick={() => setReplying("forward")}
                    variant="outline"
                    className="h-9 rounded-xl border-black/10 dark:border-white/10 gap-1.5 text-xs"
                    data-testid="button-forward"
                  >
                    <Forward className="h-3.5 w-3.5" />
                    Forward
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-black/30 dark:text-white/30 gap-3"
            >
              <div className="h-16 w-16 rounded-3xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                <Mail className="h-8 w-8" />
              </div>
              <div className="text-sm font-medium">Select an email to read</div>
              <div className="text-xs">Or compose a new message</div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </section>
  );
}
