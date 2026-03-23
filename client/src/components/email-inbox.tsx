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
  Loader2,
  Settings,
  WifiOff,
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
import { useAuth } from "@/hooks/use-auth";
import { useEmailAccounts, useEmailMessages, useEmailMessage } from "@/hooks/queries";
import { useCreateEmailAccount, useDeleteEmailAccount, useSendEmail } from "@/hooks/mutations";
import type { ImapMessage } from "@/api/endpoints/email.api";

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
}

// Maps UI folder names to IMAP folder paths
const IMAP_FOLDER: Record<EmailFolder, string> = {
  inbox: "INBOX",
  sent: "Sent",
  drafts: "Drafts",
  trash: "Trash",
  archive: "Archive",
  starred: "INBOX", // fetch inbox and filter by flagged
};

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

function mapImapToEmail(msg: ImapMessage, folder: EmailFolder): EmailMessage {
  const from = msg.from[0] ?? { name: "", address: "" };
  const flags = Array.isArray(msg.flags) ? msg.flags : [];
  return {
    id: String(msg.uid),
    from: { name: from.name || from.address, email: from.address },
    to: (msg.to ?? []).map((a) => ({ name: a.name || a.address, email: a.address })),
    subject: msg.subject ?? "(no subject)",
    preview: "",
    body: "",
    date: msg.date ? new Date(msg.date).toISOString() : new Date().toISOString(),
    read: flags.includes("\\Seen"),
    starred: flags.includes("\\Flagged"),
    folder,
  };
}

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

// ─── Connect Email Form ───────────────────────────────────────────────────────

interface ConnectEmailFormProps {
  userId: string;
  onCancel?: () => void;
}

function ConnectEmailForm({ userId, onCancel }: ConnectEmailFormProps) {
  const createAccount = useCreateEmailAccount();
  const [form, setForm] = useState({
    label: "My Email",
    emailAddress: "",
    imapHost: "mail.privateemail.com",
    imapPort: 993,
    smtpHost: "mail.privateemail.com",
    smtpPort: 465,
    secure: true,
    username: "",
    password: "",
  });

  const set = (key: string, value: string | number | boolean) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAccount.mutateAsync({ ...form, userId });
  };

  return (
    <section className="flex items-center justify-center h-[calc(100vh-12rem)]" data-testid="section-email-setup">
      <Card className="glass ringed grain rounded-3xl p-8 w-full max-w-md">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <Mail className="h-6 w-6 text-blue-500" />
          </div>
          <div>
            <h2 className="text-base font-bold">Connect Your Email</h2>
            <p className="text-xs text-black/50 dark:text-white/50">Enter your Namecheap email credentials</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">Label</label>
            <Input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. My Business Email"
              className="h-9 text-sm rounded-xl border-black/10 dark:border-white/10"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">Email Address</label>
            <Input
              type="email"
              value={form.emailAddress}
              onChange={(e) => { set("emailAddress", e.target.value); set("username", e.target.value); }}
              placeholder="you@yourdomain.com"
              className="h-9 text-sm rounded-xl border-black/10 dark:border-white/10"
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">Password</label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder="Your email password"
              className="h-9 text-sm rounded-xl border-black/10 dark:border-white/10"
              required
            />
          </div>

          <Separator className="bg-black/8 dark:bg-white/8" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">IMAP Host</label>
              <Input
                value={form.imapHost}
                onChange={(e) => set("imapHost", e.target.value)}
                className="h-9 text-xs rounded-xl border-black/10 dark:border-white/10"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">IMAP Port</label>
              <Input
                type="number"
                value={form.imapPort}
                onChange={(e) => set("imapPort", parseInt(e.target.value))}
                className="h-9 text-xs rounded-xl border-black/10 dark:border-white/10"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">SMTP Host</label>
              <Input
                value={form.smtpHost}
                onChange={(e) => set("smtpHost", e.target.value)}
                className="h-9 text-xs rounded-xl border-black/10 dark:border-white/10"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-black/60 dark:text-white/60 block mb-1">SMTP Port</label>
              <Input
                type="number"
                value={form.smtpPort}
                onChange={(e) => set("smtpPort", parseInt(e.target.value))}
                className="h-9 text-xs rounded-xl border-black/10 dark:border-white/10"
                required
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={createAccount.isPending}
              className="flex-1 h-10 rounded-xl bg-blue-500 hover:bg-blue-600 text-white gap-2"
            >
              {createAccount.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Connect Account
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} className="h-10 rounded-xl border-black/10 dark:border-white/10">
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>
    </section>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmailInbox() {
  const { user } = useAuth();
  const { data: accounts = [], isLoading: accountsLoading } = useEmailAccounts(user?.id ?? "");
  const account = accounts[0] ?? null;

  const [showSetup, setShowSetup] = useState(false);
  const [folder, setFolder] = useState<EmailFolder>("inbox");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composing, setComposing] = useState(false);
  const [composeData, setComposeData] = useState({ to: "", cc: "", subject: "", body: "" });
  const [replying, setReplying] = useState<"reply" | "reply-all" | "forward" | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [localStarred, setLocalStarred] = useState<Record<string, boolean>>({});
  const [localRead, setLocalRead] = useState<Record<string, boolean>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());

  const deleteAccount = useDeleteEmailAccount(user?.id ?? "");
  const sendEmail = useSendEmail();

  const imapFolder = IMAP_FOLDER[folder];
  const { data: imapMessages = [], isLoading: messagesLoading } = useEmailMessages(
    account?.id ?? "",
    imapFolder,
    !!account && !showSetup,
  );

  const selectedUid = selectedId ? parseInt(selectedId, 10) : 0;
  const { data: fullMessage, isLoading: bodyLoading } = useEmailMessage(
    account?.id ?? "",
    selectedUid,
    imapFolder,
    !!selectedId && !!account,
  );

  const emails = useMemo(
    () => imapMessages.filter((m) => !removed.has(String(m.uid))).map((msg) => mapImapToEmail(msg, folder)),
    [imapMessages, folder, removed],
  );

  const filteredEmails = useMemo(() => {
    let list = emails.map((e) => ({
      ...e,
      starred: localStarred[e.id] ?? e.starred,
      read: localRead[e.id] ?? e.read,
    }));
    if (folder === "starred") list = list.filter((e) => e.starred);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.name.toLowerCase().includes(q) ||
          e.from.email.toLowerCase().includes(q),
      );
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [emails, folder, search, localStarred, localRead]);

  const selectedEmail = useMemo(
    () => filteredEmails.find((e) => e.id === selectedId) ?? null,
    [filteredEmails, selectedId],
  );

  const selectedEmailWithBody = useMemo(() => {
    if (!selectedEmail) return null;
    if (!fullMessage) return selectedEmail;
    return { ...selectedEmail, body: fullMessage.html ?? fullMessage.text ?? "" };
  }, [selectedEmail, fullMessage]);

  const unreadCount = useMemo(
    () => emails.filter((e) => !(localRead[e.id] ?? e.read)).length,
    [emails, localRead],
  );

  const starredCount = useMemo(
    () => emails.filter((e) => localStarred[e.id] ?? e.starred).length,
    [emails, localStarred],
  );

  const toggleStar = (id: string) => {
    setLocalStarred((prev) => {
      const current = prev[id] ?? emails.find((e) => e.id === id)?.starred ?? false;
      return { ...prev, [id]: !current };
    });
  };

  const markAsRead = (id: string) => setLocalRead((prev) => ({ ...prev, [id]: true }));

  const moveToTrash = (id: string) => {
    setRemoved((prev) => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
  };

  const archiveEmail = (id: string) => {
    setRemoved((prev) => new Set(prev).add(id));
    if (selectedId === id) setSelectedId(null);
  };

  const openEmail = (email: EmailMessage) => {
    setSelectedId(email.id);
    markAsRead(email.id);
    setReplying(null);
    setReplyBody("");
  };

  const handleSend = async () => {
    if (!account || !composeData.to || !composeData.subject) return;
    await sendEmail.mutateAsync({
      accountId: account.id,
      payload: {
        to: composeData.to,
        cc: composeData.cc || undefined,
        subject: composeData.subject,
        html: composeData.body || undefined,
      },
    });
    setComposing(false);
    setComposeData({ to: "", cc: "", subject: "", body: "" });
  };

  const handleReply = async () => {
    if (!account || !selectedEmail || !replyBody) return;
    await sendEmail.mutateAsync({
      accountId: account.id,
      payload: {
        to: selectedEmail.from.email,
        subject: `Re: ${selectedEmail.subject}`,
        text: replyBody,
      },
    });
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

  // Loading state
  if (accountsLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-12rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-black/30 dark:text-white/30" />
      </div>
    );
  }

  // Setup form
  if (!account || showSetup) {
    return (
      <ConnectEmailForm
        userId={user?.id ?? ""}
        onCancel={account ? () => setShowSetup(false) : undefined}
      />
    );
  }

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
            const count = f.key === "inbox" ? unreadCount : f.key === "starred" ? starredCount : 0;
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

        {/* Account info */}
        <div className="px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40 mb-0.5">Connected</div>
              <div className="text-xs text-black/70 dark:text-white/70 truncate">{account.emailAddress}</div>
            </div>
            <button
              onClick={() => setShowSetup(true)}
              className="h-7 w-7 rounded-lg flex items-center justify-center text-black/30 hover:text-black hover:bg-black/5 dark:text-white/30 dark:hover:text-white dark:hover:bg-white/5 transition flex-shrink-0"
              title="Account settings"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>
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
          {messagesLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 py-12 text-black/30 dark:text-white/30">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-xs">Loading emails…</span>
            </div>
          ) : filteredEmails.length === 0 ? (
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
                      <Star className={`h-3.5 w-3.5 ${(localStarred[email.id] ?? email.starred) ? "fill-amber-400 text-amber-400" : "text-black/20 dark:text-white/20"}`} />
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-xs truncate ${!(localRead[email.id] ?? email.read) ? "font-semibold text-black dark:text-white" : "font-medium text-black/70 dark:text-white/70"}`}>
                        {folder === "sent" || folder === "drafts" ? `To: ${email.to[0]?.name || email.to[0]?.email}` : email.from.name || email.from.email}
                      </span>
                      <span className="text-[10px] text-black/40 dark:text-white/40 whitespace-nowrap">
                        {formatEmailDate(email.date)}
                      </span>
                    </div>
                    <div className={`text-xs mt-0.5 truncate ${!(localRead[email.id] ?? email.read) ? "font-medium text-black/90 dark:text-white/90" : "text-black/60 dark:text-white/60"}`}>
                      {email.subject}
                    </div>
                  </div>
                  {!(localRead[email.id] ?? email.read) && (
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
                  <Button
                    onClick={handleSend}
                    disabled={sendEmail.isPending || !composeData.to || !composeData.subject}
                    className="h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-2 text-sm"
                    data-testid="button-send-email"
                  >
                    {sendEmail.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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
                  <button
                    onClick={() => { setComposing(false); setComposeData({ to: "", cc: "", subject: "", body: "" }); }}
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ) : selectedEmailWithBody ? (
            <motion.div
              key={`email-${selectedEmailWithBody.id}`}
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
                  <div className="text-sm font-semibold truncate max-w-[300px]">{selectedEmailWithBody.subject}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => archiveEmail(selectedEmailWithBody.id)}
                    className="h-8 w-8 rounded-xl flex items-center justify-center text-black/40 hover:text-black hover:bg-black/5 dark:text-white/40 dark:hover:text-white dark:hover:bg-white/5 transition"
                    data-testid="button-archive-email"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => moveToTrash(selectedEmailWithBody.id)}
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
                      {(selectedEmailWithBody.from.name || selectedEmailWithBody.from.email).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{selectedEmailWithBody.from.name || selectedEmailWithBody.from.email}</div>
                      <div className="text-xs text-black/50 dark:text-white/50">{selectedEmailWithBody.from.email}</div>
                      <div className="text-xs text-black/40 dark:text-white/40 mt-0.5">
                        To: {selectedEmailWithBody.to.map((t) => t.name || t.email).join(", ")}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-black/40 dark:text-white/40 whitespace-nowrap">
                    <Clock className="h-3 w-3" />
                    {formatFullDate(selectedEmailWithBody.date)}
                  </div>
                </div>

                {bodyLoading ? (
                  <div className="flex items-center gap-2 text-black/30 dark:text-white/30 py-8">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading message…</span>
                  </div>
                ) : selectedEmailWithBody.body ? (
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none text-black/80 dark:text-white/80 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: selectedEmailWithBody.body }}
                  />
                ) : (
                  <div className="text-sm text-black/40 dark:text-white/40 italic">No message content</div>
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
                            {replying === "reply" && <><Reply className="h-3.5 w-3.5" /> Reply to {selectedEmailWithBody.from.name}</>}
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
                          <Button
                            onClick={handleReply}
                            disabled={sendEmail.isPending || !replyBody}
                            className="h-8 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-1.5 text-xs"
                            data-testid="button-send-reply"
                          >
                            {sendEmail.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
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
