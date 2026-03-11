import { useCallback, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Anchor,
  ArrowRight,
  Bold,
  Calendar,
  CheckSquare,
  ChevronLeft,
  Circle,
  Dog,
  Globe,
  Home,
  Hotel,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MapPin,
  MessageSquare,
  Pencil,
  Plane,
  Plus,
  Redo,
  Reply,
  Send,
  Ship,
  SmilePlus,
  Sparkles,
  Star,
  Trash2,
  Undo,
  Users,
  Wallet,
  X,
  Pin,
  PawPrint,
  PinOff,
} from "lucide-react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useEnquiry, useClient, useTasks, useNotes, noteKeys, usePackageTypes, enquiryKeys } from "@/hooks/queries";
import { useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/mutations/use-note-mutations";
import { useCreateQuote, useUpdateEnquiry, useCreateTask, useToggleTask, useDeleteTask, useUpdateTransaction } from "@/hooks/mutations";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { useCurrentUser } from "@/hooks/queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useQueryClient } from "@tanstack/react-query";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import type { CreateQuoteData } from "@/types/quote";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EnquiryWizard } from "@/components/enquiry-wizard";
import { QuoteRHFForm } from "@/components/quote-rhf-form";
import { buildQuotePayload } from "@/components/quote-create-dialog";
import type { QuoteFormValues } from "@/types/quote";
import { defaultQuoteFormValues } from "@/types/quote";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Enquiry } from "@/types/enquiry";
import type { TransactionNote } from "@/types/quote";
import type { CreateNoteData } from "@/api/endpoints/note.api";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatUKDate(input: string | null) {
  if (!input) return "—";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

const EMOJI_CATEGORIES = [
  { label: "Travel", emojis: ["✈️","🏖️","🌴","🏨","🚢","🗺️","🧳","🌍","🏔️","🎿","🏝️","🌅","🚂","🚗","⛱️","🏕️","🗼","🎡","🚤","🌊"] },
  { label: "Faces", emojis: ["😀","😊","😍","🥳","😎","🤔","👍","👏","🎉","❤️","⭐","🔥","✅","❌","⚠️","💡","📌","🎯","💪","🙏"] },
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  return (
    <div className="absolute bottom-full left-0 z-50 mb-2 w-[260px] rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl" data-testid="emoji-picker">
      <div className="flex gap-1 border-b border-black/10 px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button key={cat.label} type="button" onClick={() => setActiveTab(i)} className={cn("rounded-lg px-2 py-1 text-[10px] font-semibold transition", activeTab === i ? "bg-black/10 text-black" : "text-black/50 hover:text-black/70")} data-testid={`emoji-tab-${cat.label}`}>{cat.label}</button>
        ))}
      </div>
      <div className="grid grid-cols-8 sm:grid-cols-10 gap-0.5 p-2">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
          <button key={emoji} type="button" onClick={() => { onSelect(emoji); onClose(); }} className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition hover:bg-black/5" data-testid={`emoji-${emoji}`}>{emoji}</button>
        ))}
      </div>
    </div>
  );
}

function NoteEditor({ initialContent, placeholder, onSubmit, onCancel, submitLabel, isLoading, compact }: {
  initialContent?: string; placeholder?: string; onSubmit: (html: string) => void; onCancel?: () => void; submitLabel?: string; isLoading?: boolean; compact?: boolean;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: placeholder || "Write a note..." }), TiptapLink.configure({ openOnClick: false })],
    content: initialContent || "",
    editorProps: { attributes: { class: cn("prose prose-sm max-w-none outline-none", compact ? "min-h-[36px] p-1.5" : "min-h-[44px] p-2") } },
  });
  const handleSubmit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, onSubmit]);
  const insertEmoji = useCallback((emoji: string) => { editor?.chain().focus().insertContent(emoji).run(); }, [editor]);
  if (!editor) return null;
  return (
    <div className={cn("rounded-xl border border-black/10 bg-white/80 overflow-hidden", compact && "rounded-lg")}>
      <div className="flex items-center gap-0.5 border-b border-black/5 bg-black/[0.02] px-1.5 py-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-6 w-6 p-0", editor.isActive("bold") && "bg-black/10")}><Bold className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-6 w-6 p-0", editor.isActive("italic") && "bg-black/10")}><Italic className="h-3 w-3" /></Button>
        <div className="mx-0.5 h-3 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-6 w-6 p-0", editor.isActive("bulletList") && "bg-black/10")}><List className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-6 w-6 p-0", editor.isActive("orderedList") && "bg-black/10")}><ListOrdered className="h-3 w-3" /></Button>
        <div className="mx-0.5 h-3 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => { const url = window.prompt("Enter URL:"); if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }} className={cn("h-6 w-6 p-0", editor.isActive("link") && "bg-black/10")}><LinkIcon className="h-3 w-3" /></Button>
        <div className="mx-0.5 h-3 w-px bg-black/10" />
        <div className="relative">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowEmoji(!showEmoji)} className="h-6 w-6 p-0"><SmilePlus className="h-3 w-3" /></Button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-6 w-6 p-0"><Undo className="h-3 w-3" /></Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-6 w-6 p-0"><Redo className="h-3 w-3" /></Button>
      </div>
      <EditorContent editor={editor} className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:text-xs [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/35 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
      <div className="flex items-center justify-end gap-1.5 border-t border-black/5 bg-black/[0.01] px-1.5 py-1">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-6 rounded-md px-2 text-[10px]">Cancel</Button>}
        <Button type="button" size="sm" onClick={handleSubmit} disabled={isLoading} className="h-6 rounded-md bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90">
          {isLoading ? <Spinner className="h-2.5 w-2.5" /> : <Send className="mr-1 h-2.5 w-2.5" />}
          {submitLabel || "Post"}
        </Button>
      </div>
    </div>
  );
}

function EnquiryNoteCard({ note, replies, transactionId, currentUserName }: { note: TransactionNote; replies: TransactionNote[]; transactionId: string; currentUserName: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(transactionId);
  const deleteMutation = useDeleteNote(transactionId);
  const createMutation = useCreateNote(transactionId);

  const handleEdit = (html: string) => {
    updateMutation.mutate({ id: note.id, content: html }, {
      onSuccess: () => { setIsEditing(false); toast({ title: "Note updated" }); },
      onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
    });
  };
  const handleDelete = () => {
    deleteMutation.mutate(note.id, {
      onSuccess: () => toast({ title: "Note deleted" }),
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };
  const handleReply = (html: string) => {
    createMutation.mutate({ transaction_id: transactionId, content: html } as CreateNoteData, {
      onSuccess: () => { setIsReplying(false); toast({ title: "Reply added" }); },
      onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="group" data-testid={`note-card-${note.id}`}>
      <div className="rounded-xl border border-black/10 bg-white/60 p-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[8px] font-bold text-[#3b82f6]">{(currentUserName || "A").charAt(0).toUpperCase()}</div>
            <div>
              <span className="text-[11px] font-semibold text-black/80">{currentUserName || "Agent"}</span>
              <span className="ml-1.5 text-[9px] text-black/40">{formatRelativeTime(note.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => setIsReplying(!isReplying)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Reply"><Reply className="h-2.5 w-2.5" /></button>
            <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Edit"><Pencil className="h-2.5 w-2.5" /></button>
            <button type="button" onClick={handleDelete} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-rose-50 hover:text-rose-500" title="Delete"><Trash2 className="h-2.5 w-2.5" /></button>
          </div>
        </div>
        {isEditing ? (
          <div className="mt-1.5"><NoteEditor initialContent={note.content || ""} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact /></div>
        ) : (
          <div className="mt-1 prose prose-sm max-w-none text-[11px] leading-relaxed text-black/70 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: note.content || "" }} data-testid={`note-content-${note.id}`} />
        )}
        {replies.length > 0 && (
          <div className="mt-1.5">
            <button type="button" onClick={() => setShowReplies(!showReplies)} className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#3b82f6] transition hover:text-[#3b82f6]/80">
              <MessageSquare className="h-2.5 w-2.5" />{showReplies ? "Hide" : "Show"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>
            <AnimatePresence>
              {showReplies && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="mt-1.5 space-y-1 overflow-hidden border-l-2 border-[#3b82f6]/20 pl-2">
                  {replies.map((reply) => (
                    <EnquiryReplyCard key={reply.id} reply={reply} transactionId={transactionId} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
        {isReplying && (
          <div className="mt-1.5"><NoteEditor placeholder="Write a reply..." onSubmit={handleReply} onCancel={() => setIsReplying(false)} submitLabel="Reply" isLoading={createMutation.isPending} compact /></div>
        )}
      </div>
    </motion.div>
  );
}

function EnquiryReplyCard({ reply, transactionId }: { reply: TransactionNote; transactionId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(transactionId);
  const deleteMutation = useDeleteNote(transactionId);
  const handleEdit = (html: string) => {
    updateMutation.mutate({ id: reply.id, content: html }, {
      onSuccess: () => { setIsEditing(false); toast({ title: "Reply updated" }); },
      onError: () => toast({ title: "Failed to update reply", variant: "destructive" }),
    });
  };
  return (
    <div className="group/reply rounded-xl border border-black/5 bg-white/50 p-2" data-testid={`reply-card-${reply.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-600">A</div>
          <span className="text-[10px] font-semibold text-black/70">Agent</span>
          <span className="text-[9px] text-black/35">{formatRelativeTime(reply.createdAt)}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover/reply:opacity-100">
          <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-black/5 hover:text-black/60"><Pencil className="h-2.5 w-2.5" /></button>
          <button type="button" onClick={() => deleteMutation.mutate(reply.id)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-1.5"><NoteEditor initialContent={reply.content || ""} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact /></div>
      ) : (
        <div className="mt-1 prose prose-sm max-w-none text-[11px] text-black/60 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: reply.content || "" }} />
      )}
    </div>
  );
}

function EnquiryNotesSection({ transactionId }: { transactionId: string }) {
  const { data: notesData, isLoading } = useNotes(transactionId);
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateNote(transactionId);
  const { toast } = useToast();
  const authorName = currentUser?.name || "Agent";

  const topLevelNotes = useMemo(() => {
    if (!notesData) return [];
    return notesData.filter((n) => !n.parent_id);
  }, [notesData]);

  const repliesByParent = useMemo(() => {
    if (!notesData) return new Map<string, TransactionNote[]>();
    const map = new Map<string, TransactionNote[]>();
    notesData.filter((n) => n.parent_id).forEach((n) => {
      const existing = map.get(n.parent_id!) || [];
      existing.push(n);
      map.set(n.parent_id!, existing);
    });
    return map;
  }, [notesData]);

  const handleCreate = (html: string) => {
    createMutation.mutate({ transaction_id: transactionId, content: html }, {
      onSuccess: () => toast({ title: "Note added" }),
      onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
    });
  };

  return (
    <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-enquiry-notes">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-black/50" />
          <div className="text-sm font-semibold">Notes</div>
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/50">{topLevelNotes.length}</span>
      </div>
      <div className="mt-3 space-y-2" data-testid="list-enquiry-notes">
        {isLoading ? (
          <div className="flex items-center justify-center py-6"><Spinner className="h-5 w-5" /></div>
        ) : topLevelNotes.length === 0 ? (
          <div className="py-6 text-center text-xs text-black/40" data-testid="text-notes-empty">No notes yet. Add one below.</div>
        ) : (
          <AnimatePresence>
            {topLevelNotes.map((note) => (
              <EnquiryNoteCard key={note.id} note={note} replies={repliesByParent.get(note.id) || []} transactionId={transactionId} currentUserName={authorName} />
            ))}
          </AnimatePresence>
        )}
      </div>
      <div className="mt-3">
        <NoteEditor placeholder="Add a note about this enquiry..." onSubmit={handleCreate} isLoading={createMutation.isPending} />
      </div>
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2" data-testid={`info-row-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-black/[0.04]">
        <Icon className="h-3.5 w-3.5 text-black/50" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium text-black/45">{label}</div>
        <div className="text-sm font-semibold text-black/80">{value}</div>
      </div>
    </div>
  );
}

const TASK_PRESETS_BY_ENTITY: Record<string, string[]> = {
  general: [
    "Follow up",
    "Phone call",
    "Send email",
    "Research",
    "Admin",
  ],
  enquiry: [
    "New Enquiry",
    "Start Quote",
  ],
  quote: [
    "Quote Call",
    "Start Quote",
    "Call Supplier",
    "Quote In Progress",
    "Re-Quote",
    "Quote Follow-Up",
    "Book or Ditch!!!",
  ],
  booking: [
    "Booking confirmation call",
    "Send booking confirmation",
    "Request passport details",
    "Online Visa",
    "Final payment",
    "Send travel documents",
    "Online check-in",
    "Holiday change",
    "Amend booking",
    "Cancellation",
  ],
};

const TASK_CATEGORIES = [
  { value: "general", label: "General Task" },
  { value: "enquiry", label: "Enquiry" },
  { value: "quote", label: "Quote" },
  { value: "booking", label: "Booking" },
];

function formatTaskDue(date: Date | string) {
  const d = new Date(date);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 0) return "Overdue";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function EnquiryTasksSection({ enquiryId, assignedUserId }: { enquiryId: string; assignedUserId?: string }) {
  const { data: tasksData, isLoading } = useTasks("enquiry", enquiryId);
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateTask("enquiry", enquiryId);
  const toggleMutation = useToggleTask("enquiry", enquiryId);
  const deleteMutation = useDeleteTask("enquiry", enquiryId);
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [taskCategory, setTaskCategory] = useState<string>("enquiry");
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("09:00");

  const presets = TASK_PRESETS_BY_ENTITY[taskCategory] || TASK_PRESETS_BY_ENTITY.enquiry;

  const handleAdd = () => {
    const userIdForTask = assignedUserId || currentUser?.id;
    if (!newTitle || !newDueDate || !userIdForTask) return;
    const dueDate = new Date(`${newDueDate}T${newDueTime || "09:00"}`);
    createMutation.mutate(
      {
        entityType: "enquiry",
        entityId: enquiryId,
        userId: userIdForTask,
        title: newTitle,
        dueDate: dueDate,
        completed: false,
        notified: false,
      } as any,
      {
        onSuccess: () => {
          setShowAddDialog(false);
          setNewTitle("");
          setNewDueDate("");
          setNewDueTime("09:00");
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
      }
    );
  };

  const pendingTasks = useMemo(() => (tasksData || []).filter((t) => !t.completed), [tasksData]);
  const completedTasks = useMemo(() => (tasksData || []).filter((t) => t.completed), [tasksData]);

  return (
    <>
      <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-enquiry-tasks">
        <div className="flex items-center justify-between" data-testid="row-tasks-header">
          <div>
            <div className="text-sm font-semibold" data-testid="text-tasks-title">Tasks</div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-tasks-subtitle">Track to-dos for this enquiry.</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50" data-testid="text-tasks-count">
              {pendingTasks.length}
            </span>
            <CheckSquare className="h-4 w-4 text-black/35" aria-hidden />
          </div>
        </div>

        <div className="mt-3 grid gap-1.5" data-testid="list-tasks">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="h-4 w-4" />
            </div>
          ) : pendingTasks.length === 0 && completedTasks.length === 0 ? (
            <div className="py-4 text-center text-xs text-black/40" data-testid="text-tasks-empty">
              No tasks yet.
            </div>
          ) : (
            <>
              {pendingTasks.map((task) => {
                const isOverdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
                return (
                  <div
                    key={task.id}
                    className="group flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.02]"
                    data-testid={`row-task-${task.id}`}
                  >
                    <button type="button" onClick={() => toggleMutation.mutate(task.id)} className="shrink-0" data-testid={`button-toggle-task-${task.id}`}>
                      <Circle className="h-3.5 w-3.5 text-black/30" />
                    </button>
                    <span className="flex-1 text-xs font-medium text-black/75" data-testid={`text-task-label-${task.id}`}>
                      {task.title}
                    </span>
                    <span className={`shrink-0 text-[10px] font-semibold ${isOverdue ? "text-rose-500" : "text-black/40"}`} data-testid={`text-task-due-${task.id}`}>
                      {task.dueDate ? formatTaskDue(task.dueDate) : "—"}
                    </span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100"
                      data-testid={`button-remove-task-${task.id}`}
                      onClick={() => deleteMutation.mutate(task.id)}
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                );
              })}
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="group flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-left transition hover:bg-black/[0.02]"
                  data-testid={`row-task-${task.id}`}
                >
                  <button type="button" onClick={() => toggleMutation.mutate(task.id)} className="shrink-0" data-testid={`button-toggle-task-${task.id}`}>
                    <CheckSquare className="h-3.5 w-3.5 text-emerald-500" />
                  </button>
                  <span className="flex-1 text-xs font-medium text-black/40 line-through" data-testid={`text-task-label-${task.id}`}>
                    {task.title}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-black/25 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100"
                    data-testid={`button-remove-task-${task.id}`}
                    onClick={() => deleteMutation.mutate(task.id)}
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="mt-3">
          <Button
            size="sm"
            className="w-full h-9 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            data-testid="button-add-task"
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>
      </Card>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-add-task">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add Task</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Set a task with a due date and time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Category</Label>
              <Select value={taskCategory} onValueChange={(v) => { setTaskCategory(v); setNewTitle(""); }}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-task-category">
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
              <Select value={newTitle} onValueChange={setNewTitle}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-task-title">
                  <SelectValue placeholder="Choose a task…" />
                </SelectTrigger>
                <SelectContent>
                  {presets.map((preset) => (
                    <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Date</Label>
                <DatePicker
                  value={newDueDate}
                  onChange={(v) => setNewDueDate(v)}
                  placeholder="Pick a date"
                  data-testid="input-task-due-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Time</Label>
                <Input
                  type="time"
                  value={newDueTime}
                  onChange={(e) => setNewDueTime(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-task-due-time"
                />
              </div>
            </div>

            <Button
              className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-confirm-add-task"
              onClick={handleAdd}
              disabled={!newTitle || !newDueDate || createMutation.isPending}
            >
              {createMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Add Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function EnquiryPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId/enquiries/:enquiryId");
  const [, freeParams] = useRoute("/enquiries/:enquiryId");
  const resolvedParams = params ?? freeParams;
  const clientId = resolvedParams?.clientId || "";
  const enquiryId = resolvedParams?.enquiryId || "";
  const { role, setRole } = useRole();

  const { data: enquiry, isLoading } = useEnquiry(enquiryId);
  const { data: clientData } = useClient(clientId);
  const { data: currentUser } = useCurrentUser();
  const createQuoteMutation = useCreateQuote();
  const updateEnquiryMutation = useUpdateEnquiry();
  const updateTransactionMutation = useUpdateTransaction();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const queryClient = useQueryClient();
  const isEnquiryPinned = useMemo(() => {
    if (!userFavorites || !enquiryId) return false;
    return userFavorites.some((f: any) => f.itemType === "enquiry" && f.itemId === enquiryId);
  }, [userFavorites, enquiryId]);

  const [showEditWizard, setShowEditWizard] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);

  const { data: packageTypesData } = usePackageTypes();

  const convertDefaultValues = useMemo<Partial<QuoteFormValues>>(() => {
    if (!enquiry) return {};
    const firstDestination = enquiry.destinations?.[0];
    const firstResort = enquiry.resorts?.[0];
    const firstAirport = enquiry.airports?.[0];
    const firstBoardBasis = enquiry.boardBases?.[0];

    return {
      ...defaultQuoteFormValues,
      packageType: enquiry.holiday_type_id || "",
      quoteTitle: enquiry.title || "",
      travelDate: enquiry.travel_date || "",
      passengersAdults: enquiry.adults || 2,
      passengersChildren: enquiry.children || 0,
      passengersInfants: enquiry.infants || 0,
      nights: enquiry.no_of_nights || 7,
      country: (firstDestination as any)?.country_id || "",
      destination: firstDestination?.destination_id || "",
      resort: firstResort?.resort_id || (firstResort as unknown as { resorts_id?: string })?.resorts_id || "",
      boardBasisId: firstBoardBasis?.board_basis_id || "",
      outboundDepartAirportId: firstAirport?.airport_id || "",
      cabinType: enquiry.cabin_type || "",
      pets: !!(enquiry.no_of_pets && enquiry.no_of_pets > 0),
      status: "QUOTE_IN_PROGRESS",
    };
  }, [enquiry]);

  const handleConvertToQuote = () => {
    if (!enquiry) return;
    setShowConvertModal(true);
  };

  const handleConvertSubmit = async (values: QuoteFormValues, images?: { files: File[]; urls: string[] }) => {
    if (!enquiry) return;
    
    if (!enquiry.transaction_id) {
      console.error("❌ Enquiry missing transaction_id:", enquiry);
      toast({
        title: "Conversion Error",
        description: "This enquiry is missing a transaction ID and cannot be converted.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("✅ Converting enquiry to quote - Transaction ID:", enquiry.transaction_id);
    const quotePayload = buildQuotePayload(values, packageTypesData);
    const imageUrls = images?.urls || [];

    const convertPayload: CreateQuoteData = {
      ...quotePayload,
      transaction_id: enquiry.transaction_id,
    } as CreateQuoteData;

    if (imageUrls.length > 0) {
      (convertPayload as any).images = imageUrls;
    }

    createQuoteMutation.mutate(
      convertPayload,
      {
        onSuccess: (newQuote: { id: string }) => {
          updateEnquiryMutation.mutate({ id: enquiry.id, data: { status: "Converted" } });
          setShowConvertModal(false);
          toast({ title: "Enquiry converted to quote!" });
          navigate(`/clients/${clientId}/quotes/${newQuote.id}`);
        },
        onError: () => {
          toast({ title: "Failed to convert enquiry to quote", variant: "destructive" });
        },
      }
    );
  };

  const handleEditSubmit = (data: any) => {
    updateEnquiryMutation.mutate({ id: enquiryId, data }, {
      onSuccess: () => {
        setShowEditWizard(false);
        toast({ title: "Enquiry updated" });
      },
      onError: () => toast({ title: "Failed to update enquiry", variant: "destructive" }),
    });
  };

  if (isLoading) {
    return (
      <CommandCenterShell title="Enquiry" role={role} onRoleChange={setRole} theme="light" onToggleTheme={() => {}}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (!enquiry) {
    return (
      <CommandCenterShell title="Enquiry" role={role} onRoleChange={setRole} theme="light" onToggleTheme={() => {}}>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <div className="text-sm text-black/50">Enquiry not found</div>
          <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => navigate(`/clients/${clientId}`)}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Back to client
          </Button>
        </div>
      </CommandCenterShell>
    );
  }

  const statusColor = enquiry.status === "Open" ? "border-blue-500/25 bg-blue-500/10 text-blue-700"
    : enquiry.status === "Converted" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
    : "border-black/10 bg-black/5 text-black/60";

  const adultsCount = enquiry.adults || 0;
  const childrenCount = enquiry.children || 0;
  const infantsCount = enquiry.infants || 0;
  const totalPassengers = adultsCount + childrenCount + infantsCount;
  const passengerBreakdown = [
    `${adultsCount} Adult${adultsCount !== 1 ? "s" : ""}`,
    childrenCount > 0 ? `${childrenCount} Child${childrenCount !== 1 ? "ren" : ""}` : null,
    infantsCount > 0 ? `${infantsCount} Infant${infantsCount !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

  const holidayTypeName = (enquiry as any).holiday_type_name || "";
  const isHotTub = holidayTypeName.toLowerCase().includes("hot tub");
  const isCruise = holidayTypeName.toLowerCase().includes("cruise");

  const destinationNames = enquiry.destinations?.map((d: any) => d.destination_name || d.name || null).filter(Boolean).join(", ") || null;
  const resortNames = enquiry.resorts?.map((r: any) => r.resort_name || r.name || null).filter(Boolean).join(", ") || null;
  const airportNames = enquiry.airports?.map((a: any) => a.airport_name || a.name || null).filter(Boolean).join(", ") || null;
  const boardBaseNames = enquiry.boardBases?.map((b: any) => b.board_basis_name || b.name || null).filter(Boolean).join(", ") || null;
  const portNames = (enquiry as any).ports?.map((p: any) => p.port_name || p.name || null).filter(Boolean).join(", ") || null;
  const cruiseLineNames = (enquiry as any).cruiseLines?.map((c: any) => c.cruise_line_name || c.name || null).filter(Boolean).join(", ") || null;
  const cruiseDestinationNames = (enquiry as any).cruiseDestinations?.map((c: any) => c.cruise_destination_name || c.name || null).filter(Boolean).join(", ") || null;

  return (
    <CommandCenterShell title="Enquiry" role={role} onRoleChange={setRole} theme="light" onToggleTheme={() => {}}>
      <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <div className="mb-6 flex items-center gap-3">
            <button type="button" onClick={() => navigate(`/clients/${clientId}`)} className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.04]" data-testid="button-back">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-bold text-black/90" data-testid="text-enquiry-title">{enquiry.title || "Untitled Enquiry"}</h1>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor}`} data-testid="badge-enquiry-status">{enquiry.status}</span>
              </div>
              <div className="mt-0.5 text-xs text-black/50">
                Created {formatUKDate(enquiry.date_created)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  toggleFavoriteMutation.mutate(
                    { itemType: "enquiry", itemId: enquiryId, label: enquiry.title || "Enquiry", subtitle: `${clientData?.name || ""}${destinationNames ? " · " + destinationNames : enquiry.holiday_type_id ? " · " + (enquiry as any).holiday_type_name || "—" : ""}` },
                    { onSuccess: (data: any) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                  )
                }
                className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${isEnquiryPinned ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
                data-testid="button-pin-enquiry"
              >
                {isEnquiryPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {isEnquiryPinned ? "Unpin" : "Pin"}
              </button>
              <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/10 px-3" onClick={() => setShowEditWizard(true)} data-testid="button-edit-enquiry">
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </Button>
              {enquiry.status !== "Converted" && (
                <Button size="sm" className="h-9 rounded-2xl bg-black px-4 text-white hover:bg-black/90" onClick={handleConvertToQuote} data-testid="button-convert-to-quote">
                  <ArrowRight className="mr-2 h-3.5 w-3.5" />
                  Convert to Quote
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
            <div className="space-y-5">
              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-holiday-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm font-bold">Holiday Details</div>
                </div>
                <div className="divide-y divide-black/5">
                  <InfoRow icon={Globe} label="Holiday Type" value={holidayTypeName || "—"} />
                  <InfoRow icon={MapPin} label="Destination" value={destinationNames} />
                  {!isCruise && <InfoRow icon={MapPin} label="Resort" value={resortNames} />}
                  {isCruise && <InfoRow icon={Ship} label="Cruise Destinations" value={cruiseDestinationNames} />}
                  {isCruise && <InfoRow icon={Anchor} label="Cruise Lines" value={cruiseLineNames} />}
                </div>
              </Card>

              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-travel-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                    {isCruise ? <Ship className="h-4 w-4 text-emerald-600" /> : isHotTub ? <Home className="h-4 w-4 text-emerald-600" /> : <Plane className="h-4 w-4 text-emerald-600" />}
                  </div>
                  <div className="text-sm font-bold">{isCruise ? "Cruise & Passengers" : isHotTub ? "Stay & Guests" : "Travel & Passengers"}</div>
                </div>
                <div className="divide-y divide-black/5">
                  {!isHotTub && !isCruise && <InfoRow icon={Plane} label="Departure Airport" value={airportNames} />}
                  {isCruise && <InfoRow icon={Anchor} label="Departure Port" value={portNames} />}
                  {isHotTub && <InfoRow icon={Home} label="Weekend Lodge" value={enquiry.weekend_lodge} />}
                  <InfoRow icon={Calendar} label={isCruise ? "Cruise Date" : "Travel Date"} value={formatUKDate(enquiry.travel_date)} />
                  <InfoRow icon={Calendar} label="Flexibility" value={enquiry.flexibility_date || enquiry.flexible_date} />
                  {isHotTub ? (
                    <>
                      <InfoRow icon={Users} label="Guests" value={enquiry.no_of_guests ? `${enquiry.no_of_guests} guest${enquiry.no_of_guests !== 1 ? "s" : ""}` : null} />
                      <InfoRow icon={Dog} label="Pets" value={enquiry.no_of_pets != null ? `${enquiry.no_of_pets} pet${enquiry.no_of_pets !== 1 ? "s" : ""}` : null} />
                    </>
                  ) : (
                    <InfoRow icon={Users} label="Passengers" value={totalPassengers > 0 ? `${totalPassengers} total — ${passengerBreakdown}` : null} />
                  )}
                </div>
              </Card>

              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-accommodation-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                    {isCruise ? <Ship className="h-4 w-4 text-amber-600" /> : <Hotel className="h-4 w-4 text-amber-600" />}
                  </div>
                  <div className="text-sm font-bold">{isCruise ? "Cabin & Budget" : isHotTub ? "Lodge & Budget" : "Accommodation & Budget"}</div>
                </div>
                <div className="divide-y divide-black/5">
                  <InfoRow icon={Calendar} label="Nights" value={enquiry.no_of_nights ? `${enquiry.no_of_nights} nights` : null} />
                  {isCruise && <InfoRow icon={Ship} label="Cabin Type" value={enquiry.cabin_type} />}
                  {isCruise && <InfoRow icon={Calendar} label="Pre-Cruise Stay" value={enquiry.pre_cruise_stay != null ? `${enquiry.pre_cruise_stay} nights` : null} />}
                  {isCruise && <InfoRow icon={Calendar} label="Post-Cruise Stay" value={enquiry.post_cruise_stay != null ? `${enquiry.post_cruise_stay} nights` : null} />}
                  {!isCruise && !isHotTub && <InfoRow icon={Star} label="Star Rating" value={enquiry.accom_min_star_rating} />}
                  {!isCruise && !isHotTub && <InfoRow icon={Hotel} label="Board Basis" value={boardBaseNames} />}
                  <InfoRow icon={Wallet} label="Budget" value={enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))} ${enquiry.budget_type?.toLowerCase() || ""}` : null} />
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-enquiry-summary">
                <div className="text-sm font-bold mb-3">Quick Summary</div>
                <div className="space-y-2">
                  {[
                    { label: "Type", value: holidayTypeName || "—", color: "bg-blue-500/10 text-blue-700" },
                    { label: "Destination", value: isCruise ? (cruiseDestinationNames || destinationNames || "—") : (destinationNames || "—") },
                    { label: isCruise ? "Cruise Date" : "Travel Date", value: formatUKDate(enquiry.travel_date) },
                    isHotTub
                      ? { label: "Guests", value: enquiry.no_of_guests ? `${enquiry.no_of_guests} guest${enquiry.no_of_guests !== 1 ? "s" : ""}` : "—" }
                      : { label: "Passengers", value: passengerBreakdown || "—" },
                    { label: "Duration", value: enquiry.no_of_nights ? `${enquiry.no_of_nights} nights` : "—" },
                    isHotTub && enquiry.no_of_pets != null
                      ? { label: "Pets", value: `${enquiry.no_of_pets} pet${enquiry.no_of_pets !== 1 ? "s" : ""}` }
                      : null,
                    isCruise
                      ? { label: "Cruise Line", value: cruiseLineNames || "—" }
                      : null,
                    isCruise && enquiry.cabin_type
                      ? { label: "Cabin", value: enquiry.cabin_type }
                      : null,
                    { label: "Budget", value: enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))} ${enquiry.budget_type?.toLowerCase() || ""}` : "—" },
                  ].filter(Boolean).map((item: any) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-2">
                      <span className="text-[11px] font-medium text-black/50">{item.label}</span>
                      <span className={cn("text-xs font-semibold text-black/80", item.color)}>{item.value}</span>
                    </div>
                  ))}
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-2">
                    <span className="text-[11px] font-medium text-black/50">Assigned To</span>
                    <UserReassignSelect
                      value={enquiry?.user_id || currentUser?.id || ""}
                      onValueChange={(userId) => {
                        updateTransactionMutation.mutate(
                          { id: enquiry.transaction_id, data: { user_id: userId } },
                          {
                            onSuccess: () => {
                              toast({ title: "Enquiry reassigned successfully" });
                              queryClient.invalidateQueries({ queryKey: enquiryKeys.detail(enquiryId) });
                            },
                            onError: () => {
                              toast({ title: "Failed to reassign enquiry", variant: "destructive" });
                            },
                          }
                        );
                      }}
                      className="max-w-[200px]"
                      data-testid="select-enquiry-reassign"
                    />
                  </div>
                </div>
              </Card>

              <EnquiryTasksSection enquiryId={enquiryId} assignedUserId={enquiry.user_id} />

              {enquiry.transaction_id && <EnquiryNotesSection transactionId={enquiry.transaction_id} />}
            </div>
          </div>
        </motion.div>
      </div>

      <EnquiryWizard
        open={showEditWizard}
        onOpenChange={setShowEditWizard}
        enquiry={enquiry as any}
        onSubmit={handleEditSubmit}
        isSaving={updateEnquiryMutation.isPending}
      />

      <Dialog open={showConvertModal} onOpenChange={setShowConvertModal}>
        <DialogContent className="max-h-[90vh] max-w-4xl rounded-3xl border-black/10 bg-white/95 p-0 backdrop-blur-xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="text-lg font-semibold">Convert Enquiry to Quote</DialogTitle>
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
    </CommandCenterShell>
  );
}
