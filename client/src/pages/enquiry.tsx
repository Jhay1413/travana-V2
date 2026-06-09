import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowRight,
  Bold,
  CheckSquare,
  ChevronLeft,
  Circle,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Redo,
  Reply,
  Send,
  SmilePlus,
  Trash2,
  Undo,
  X,
} from "lucide-react";
import stockHolidayImage from "@assets/Luxury-Coco-Beach-Resort_1769950332124.jpg";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useEnquiry, useClient, useTasks, useNotes, noteKeys, usePackageTypes, enquiryKeys } from "@/hooks/queries";
import { useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/mutations/use-note-mutations";
import { useCreateQuote, useUpdateEnquiry, useCreateTask, useToggleTask, useDeleteTask, useUpdateTransaction } from "@/hooks/mutations";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { EditTaskDialog, type EditableTask } from "@/components/tasks/EditTaskDialog";
import { useCurrentUser } from "@/hooks/queries";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
import { QuoteRHFForm } from "@/components/quote/quote-rhf-form";
import { buildQuotePayload } from "@/components/quote/quote-create-dialog";
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

function formatBudgetType(budgetType?: string | null) {
  if (!budgetType) return "";
  return budgetType === "PER_PERSON" ? "pp" : ` ${budgetType.toLowerCase()}`;
}

function formatRelativeTime(date: string | Date) {
  const now = new Date();
  const d = typeof date === "string"
    ? new Date(/Z|[+-]\d{2}:?\d{2}$/.test(date) ? date : date.replace(" ", "T") + "Z")
    : date;
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
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[8px] font-bold text-[#3b82f6]">{(note.author_name || "A").charAt(0).toUpperCase()}</div>
            <div>
              <span className="text-[11px] font-semibold text-black/80">{note.author_name || "Agent"}</span>
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
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-600">{(reply.author_name || "A").charAt(0).toUpperCase()}</div>
          <span className="text-[10px] font-semibold text-black/70">{reply.author_name || "Agent"}</span>
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
    <Card className="rounded-3xl border-black/10 bg-white/70 p-4 mt-[20px] mb-[20px]" data-testid="card-enquiry-notes">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-black/50" />
          <div className="text-sm font-semibold">Notes</div>
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-semibold text-black/50">{topLevelNotes.length}</span>
      </div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1" data-testid="list-enquiry-notes">
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

function SpecRow({ testId, label, value }: { testId: string; label: string; value: React.ReactNode }) {
  const display = value || "—";
  const valueEl = (
    <div
      className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-black"
      data-testid={`text-enquiry-spec-${testId}-value`}
    >
      {display}
    </div>
  );

  return (
    <div
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
      data-testid={`row-enquiry-spec-${testId}`}
    >
      <div className="shrink-0 text-xs font-semibold text-black/65" data-testid={`text-enquiry-spec-${testId}-label`}>
        {label}
      </div>
      {typeof display === "string" && display !== "—" ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>{valueEl}</TooltipTrigger>
            <TooltipContent className="max-w-[280px] break-words">{display}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        valueEl
      )}
    </div>
  );
}

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
  const [assignedToId, setAssignedToId] = useState("");
  const [editingTask, setEditingTask] = useState<EditableTask | null>(null);

  const handleAdd = () => {
    const userIdForTask = assignedToId || assignedUserId || currentUser?.id;
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
          setAssignedToId("");
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
                      data-testid={`button-edit-task-${task.id}`}
                      onClick={() => setEditingTask(task)}
                    >
                      <Pencil className="h-3 w-3" aria-hidden />
                    </button>
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
              <Select value={taskCategory} onValueChange={setTaskCategory}>
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
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Enter a task…"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-task-title"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Assign To</Label>
              <UserReassignSelect
                value={assignedToId || assignedUserId || currentUser?.id || ""}
                onValueChange={setAssignedToId}
                data-testid="select-task-assign-to"
              />
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

      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(open) => !open && setEditingTask(null)}
        task={editingTask}
        entityType="enquiry"
        entityId={enquiryId}
      />
    </>
  );
}

export default function EnquiryPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId/enquiries/:enquiryId");
  const [, freeParams] = useRoute("/enquiries/:enquiryId");
  const resolvedParams = params ?? freeParams;
  const urlClientId = resolvedParams?.clientId || "";
  const enquiryId = resolvedParams?.enquiryId || "";
  const { role } = useRole();

  const { data: enquiry, isLoading } = useEnquiry(enquiryId);
  const clientId = (urlClientId && urlClientId !== "_") ? urlClientId : ((enquiry as any)?.client_id || "");
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
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showEllipsisMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(event.target as Node)) {
        setShowEllipsisMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showEllipsisMenu]);

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
      pets: enquiry.no_of_pets ?? 0,
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!enquiry) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="text-sm text-black/50">Enquiry not found</div>
        <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => navigate(clientId ? `/clients/${clientId}?tab=enquiries` : "/")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Enquiries
        </Button>
      </div>
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
    <>
      <div className="px-5 " data-testid="page-enquiry">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-enquiry-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back"
              onClick={() => navigate(clientId ? `/clients/${clientId}?tab=enquiries` : "/")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Enquiries
            </Button>
          </div>

          <div className="flex items-center gap-2" data-testid="row-enquiry-actions">
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
              data-testid="select-enquiry-itinerary-owner"
            />

            <div className="relative" ref={ellipsisRef}>
              <button
                type="button"
                onClick={() => setShowEllipsisMenu((v) => !v)}
                className="grid h-9 w-9 place-items-center rounded-2xl border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                data-testid="button-enquiry-ellipsis"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {showEllipsisMenu && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-enquiry-ellipsis">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                    data-testid="button-pin-enquiry"
                    onClick={() => {
                      setShowEllipsisMenu(false);
                      toggleFavoriteMutation.mutate(
                        { itemType: "enquiry", itemId: enquiryId, label: enquiry.title || "Enquiry", subtitle: `${clientData?.name || ""}${destinationNames ? " · " + destinationNames : enquiry.holiday_type_id ? " · " + (enquiry as any).holiday_type_name || "—" : ""}` },
                        { onSuccess: (data: any) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                      );
                    }}
                  >
                    {isEnquiryPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    {isEnquiryPinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                    data-testid="button-enquiry-edit"
                    onClick={() => {
                      setShowEllipsisMenu(false);
                      setShowEditWizard(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Edit Enquiry
                  </button>
                  {enquiry.status !== "Converted" && (
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                      data-testid="button-enquiry-convert"
                      onClick={() => {
                        setShowEllipsisMenu(false);
                        handleConvertToQuote();
                      }}
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Convert to Quote
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-enquiry-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_280px] xl:grid-cols-[1fr_340px]" data-testid="grid-enquiry-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-enquiry-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid content-start gap-1.5" data-testid="col-enquiry-media">
                  <div className="relative overflow-hidden rounded-2xl border border-black/10 bg-black/[0.04]" data-testid="img-enquiry-stock-wrapper">
                    <img
                      src={stockHolidayImage}
                      alt="Stock holiday photo"
                      className="aspect-square w-full object-cover"
                      data-testid="img-enquiry-stock"
                    />
                  </div>
                </div>

                <div className="min-w-0" data-testid="section-enquiry-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-enquiry-itinerary-top">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3" data-testid="row-enquiry-itinerary-title">
                        <div className="min-w-0" data-testid="col-enquiry-itinerary-title-left">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-base font-semibold" data-testid="text-enquiry-title">
                                {enquiry.title || "Untitled Enquiry"}
                                {enquiry.budget ? (
                                  <>
                                    , <span className="text-sm font-semibold text-[#000000]">
                                      {currency.format(parseFloat(enquiry.budget))}
                                      {formatBudgetType(enquiry.budget_type)}
                                    </span>
                                  </>
                                ) : null}
                              </div>
                              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor}`} data-testid="badge-enquiry-status">{enquiry.status}</span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-enquiry-meta">
                              {(isCruise ? (cruiseDestinationNames || destinationNames) : destinationNames) && (
                                <>
                                  <span data-testid="text-enquiry-meta-destination">{isCruise ? (cruiseDestinationNames || destinationNames) : destinationNames}</span>
                                  <span className="text-black/25">•</span>
                                </>
                              )}
                              {enquiry.travel_date && (
                                <>
                                  <span data-testid="text-enquiry-meta-dates">
                                    {formatUKDate(enquiry.travel_date)}{enquiry.no_of_nights ? ` · ${enquiry.no_of_nights} nights` : ""}
                                  </span>
                                  <span className="text-black/25">•</span>
                                </>
                              )}
                              <span data-testid="text-enquiry-meta-created">Created {formatUKDate(enquiry.date_created)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-enquiry-specs">
                    <div className="grid content-start gap-2" data-testid="col-enquiry-spec-left">
                      <SpecRow testId="holiday-type" label="Holiday Type" value={holidayTypeName} />
                      <SpecRow testId="travel-date" label={isCruise ? "Cruise Date" : "Travel Date"} value={formatUKDate(enquiry.travel_date)} />
                      {!isHotTub && !isCruise && (
                        <SpecRow testId="departure-airport" label="Departure Airport" value={airportNames} />
                      )}
                      {isCruise && (
                        <SpecRow testId="departure-port" label="Departure Port" value={portNames} />
                      )}
                      {isHotTub && (
                        <SpecRow testId="weekend-lodge" label="Weekend Lodge" value={enquiry.weekend_lodge} />
                      )}
                      {!isCruise && (
                        <SpecRow testId="resort" label="Resort" value={resortNames} />
                      )}
                      {isCruise && (
                        <SpecRow testId="cruise-line" label="Cruise Line" value={cruiseLineNames} />
                      )}
                      {isHotTub ? (
                        <SpecRow
                          testId="guests"
                          label="Guests"
                          value={enquiry.no_of_guests ? `${enquiry.no_of_guests} guest${enquiry.no_of_guests !== 1 ? "s" : ""}` : null}
                        />
                      ) : (
                        <SpecRow
                          testId="passengers"
                          label="Passengers"
                          value={totalPassengers > 0 ? passengerBreakdown : null}
                        />
                      )}
                      {!isCruise && !isHotTub && (
                        <SpecRow testId="board-basis" label="Board Basis" value={boardBaseNames} />
                      )}
                      {isCruise && enquiry.cabin_type && (
                        <SpecRow testId="cabin-type" label="Cabin Type" value={enquiry.cabin_type} />
                      )}
                    </div>
                    <div className="grid content-start gap-2" data-testid="col-enquiry-spec-right">
                      <SpecRow
                        testId="budget"
                        label="Budget"
                        value={enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))}${formatBudgetType(enquiry.budget_type)}` : null}
                      />
                      <SpecRow testId="flexibility" label="Flexibility" value={enquiry.flexibility_date || enquiry.flexible_date} />
                      {!isCruise && (
                        <SpecRow testId="destination" label="Destination" value={destinationNames} />
                      )}
                      {isCruise && (
                        <SpecRow testId="cruise-destinations" label="Cruise Destinations" value={cruiseDestinationNames} />
                      )}
                      <SpecRow
                        testId="nights"
                        label="Nights"
                        value={
                          Array.isArray(enquiry.flexible_nights) && enquiry.flexible_nights.length > 0
                            ? `${enquiry.flexible_nights.join(", ")} nights`
                            : enquiry.no_of_nights ? `${enquiry.no_of_nights} nights` : null
                        }
                      />
                      {isHotTub && enquiry.no_of_pets != null && (
                        <SpecRow testId="pets" label="Pets" value={`${enquiry.no_of_pets} pet${enquiry.no_of_pets !== 1 ? "s" : ""}`} />
                      )}
                      {isCruise && enquiry.pre_cruise_stay != null && (
                        <SpecRow testId="pre-cruise" label="Pre-Cruise Stay" value={`${enquiry.pre_cruise_stay} nights`} />
                      )}
                      {isCruise && enquiry.post_cruise_stay != null && (
                        <SpecRow testId="post-cruise" label="Post-Cruise Stay" value={`${enquiry.post_cruise_stay} nights`} />
                      )}
                      {!isCruise && !isHotTub && (
                        <SpecRow testId="star-rating" label="Min Star Rating" value={enquiry.accom_min_star_rating || null} />
                      )}
                    </div>
                  </div>

                  {enquiry.transaction_id && (
                    <EnquiryNotesSection transactionId={enquiry.transaction_id} />
                  )}
                </div>
              </div>
            </Card>

            <div className="grid gap-3 text-sm xl:text-base" data-testid="col-enquiry-right">
              <EnquiryTasksSection enquiryId={enquiryId} assignedUserId={enquiry.user_id} />
            </div>
          </div>
        </div>
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
    </>
  );
}
