import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, MoreHorizontal, Pencil, Plane, RefreshCw, Star, Tag, X, Hotel, Bus, Clock, MapPin, Calendar, Send, Reply, Trash2, Check, SmilePlus, Bold, Italic, List, ListOrdered, Link as LinkIcon, Undo, Redo, MessageSquare, Pin, PinOff, CheckSquare, Circle, Plus, Anchor, PawPrint } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useQuote, useBooking, useNotes, useTasks, useClient, useNeonClient, useAirports, useTourOperators, useBoardBasis, useAllAccommodations } from "@/hooks/queries";
import { useUpdateQuote, useConvertToBooking, useCreateNote, useUpdateNote, useDeleteNote, useCreateTask, useToggleTask, useDeleteTask } from "@/hooks/mutations";
import { useCurrentUser } from "@/hooks/queries";
import type { Task } from "@shared/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Quote as ApiQuote, TransactionNote } from "@/types/quote";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatUKDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type QuoteDisplay = {
  id: string;
  transaction_id: string;
  status: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  travelDate: string;
  returnDate: string;
  destination: string;
  country: string;
  resort: string;
  createdAt: string;
  passengersInfants: number;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  leadSource: string;
  passengers: {
    adults: number;
    children: number;
    childAges: number[];
  };
  accommodation: {
    property: string;
    board: string;
    roomType: string;
    notes: string;
  };
  flights: {
    outbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
    inbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
  };
  owner: {
    name: string;
    role: "Agent" | "Manager" | "Homeworker";
  };
  commissions: {
    tourOperator: string;
    price: number;
    commissionPercent: number;
    commissionValue: number;
    agentSplitPercent: number;
    agentSplitValue: number;
    netToAgency: number;
  };
  tags: string[];
  notes: string[];
};

const EMOJI_CATEGORIES = [
  { label: "Smileys", emojis: ["😀","😂","🥹","😊","😍","🤩","😎","🤔","😢","😤","🥳","😴","🤗","😇","🙃","😏","🤭","😬","🫡","👋"] },
  { label: "Travel", emojis: ["✈️","🏖️","🏝️","🌍","🗺️","🧳","🚗","🚢","🏨","🌅","🌴","⛱️","🎡","🗼","🏔️","🌊","☀️","🌙","⭐","🎒"] },
  { label: "Gestures", emojis: ["👍","👎","👏","🙌","🤝","✌️","🤞","💪","👊","✋","🫶","❤️","🔥","💯","⚡","🎉","🎊","✅","❌","⭕"] },
  { label: "Objects", emojis: ["📞","📧","💼","📋","📝","📌","📎","🔗","💰","💳","🎫","🛎️","🔑","📅","⏰","🎁","📱","💻","🖨️","📊"] },
];

function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div ref={ref} className="absolute bottom-full left-0 z-50 mb-2 w-[280px] rounded-2xl border border-black/10 bg-white/95 shadow-xl backdrop-blur-xl" data-testid="emoji-picker">
      <div className="flex gap-1 border-b border-black/10 px-2 pt-2">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.label}
            type="button"
            onClick={() => setActiveTab(i)}
            className={cn(
              "rounded-lg px-2 py-1 text-[10px] font-semibold transition",
              activeTab === i ? "bg-black/10 text-black" : "text-black/50 hover:text-black/70"
            )}
            data-testid={`emoji-tab-${cat.label}`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-10 gap-0.5 p-2">
        {EMOJI_CATEGORIES[activeTab].emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => { onSelect(emoji); onClose(); }}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-base transition hover:bg-black/5"
            data-testid={`emoji-${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteEditor({
  initialContent,
  placeholder,
  onSubmit,
  onCancel,
  submitLabel,
  isLoading,
  compact,
}: {
  initialContent?: string;
  placeholder?: string;
  onSubmit: (html: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  isLoading?: boolean;
  compact?: boolean;
}) {
  const [showEmoji, setShowEmoji] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder || "Write a note..." }),
      TiptapLink.configure({ openOnClick: false }),
    ],
    content: initialContent || "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none outline-none",
          compact ? "min-h-[36px] p-1.5" : "min-h-[44px] p-2"
        ),
      },
    },
  });

  const handleSubmit = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();
    if (!html || html === "<p></p>") return;
    onSubmit(html);
    editor.commands.clearContent();
  }, [editor, onSubmit]);

  const insertEmoji = useCallback((emoji: string) => {
    editor?.chain().focus().insertContent(emoji).run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className={cn("rounded-xl border border-black/10 bg-white/80 overflow-hidden", compact && "rounded-lg")}>
      <div className="flex items-center gap-px border-b border-black/5 bg-black/[0.02] px-1 py-0.5">
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBold().run()} className={cn("h-5 w-5 p-0", editor.isActive("bold") && "bg-black/10")} data-testid="note-toolbar-bold">
          <Bold className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleItalic().run()} className={cn("h-5 w-5 p-0", editor.isActive("italic") && "bg-black/10")} data-testid="note-toolbar-italic">
          <Italic className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cn("h-5 w-5 p-0", editor.isActive("bulletList") && "bg-black/10")} data-testid="note-toolbar-ul">
          <List className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cn("h-5 w-5 p-0", editor.isActive("orderedList") && "bg-black/10")} data-testid="note-toolbar-ol">
          <ListOrdered className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <Button type="button" variant="ghost" size="sm" onClick={() => { const url = window.prompt("Enter URL:"); if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run(); }} className={cn("h-5 w-5 p-0", editor.isActive("link") && "bg-black/10")} data-testid="note-toolbar-link">
          <LinkIcon className="h-2.5 w-2.5" />
        </Button>
        <div className="mx-px h-2.5 w-px bg-black/10" />
        <div className="relative">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowEmoji(!showEmoji)} className="h-5 w-5 p-0" data-testid="note-toolbar-emoji">
            <SmilePlus className="h-2.5 w-2.5" />
          </Button>
          {showEmoji && <EmojiPicker onSelect={insertEmoji} onClose={() => setShowEmoji(false)} />}
        </div>
        <div className="flex-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="h-5 w-5 p-0" data-testid="note-toolbar-undo">
          <Undo className="h-2.5 w-2.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="h-5 w-5 p-0" data-testid="note-toolbar-redo">
          <Redo className="h-2.5 w-2.5" />
        </Button>
      </div>
      <EditorContent editor={editor} className="[&_.ProseMirror]:outline-none [&_.ProseMirror]:text-xs [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-black/35 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none" />
      <div className="flex items-center justify-end gap-1.5 border-t border-black/5 bg-black/[0.01] px-1.5 py-1">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-6 rounded-md px-2 text-[10px]" data-testid="note-btn-cancel">
            Cancel
          </Button>
        )}
        <Button type="button" size="sm" onClick={handleSubmit} disabled={isLoading} className="h-6 rounded-md bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90" data-testid="note-btn-submit">
          {isLoading ? <Spinner className="h-2.5 w-2.5" /> : <Send className="mr-1 h-2.5 w-2.5" />}
          {submitLabel || "Post"}
        </Button>
      </div>
    </div>
  );
}

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

function NoteCard({
  note,
  replies,
  quoteId,
  currentUserName,
}: {
  note: TransactionNote;
  replies: TransactionNote[];
  quoteId: string;
  currentUserName: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(quoteId);
  const deleteMutation = useDeleteNote(quoteId);
  const createMutation = useCreateNote(quoteId);
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const isNotePinned = useMemo(() => {
    if (!userFavorites) return false;
    return userFavorites.some((f: any) => f.itemType === "note" && f.itemId === note.id);
  }, [userFavorites, note.id]);

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: note.id, content: html },
      {
        onSuccess: () => { setIsEditing(false); toast({ title: "Note updated" }); },
        onError: () => toast({ title: "Failed to update note", variant: "destructive" }),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(note.id, {
      onSuccess: () => toast({ title: "Note deleted" }),
      onError: () => toast({ title: "Failed to delete note", variant: "destructive" }),
    });
  };

  const handleReply = (html: string) => {
    createMutation.mutate(
      { transaction_id: quoteId, content: html },
      {
        onSuccess: () => { setIsReplying(false); toast({ title: "Reply added" }); },
        onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="group"
      data-testid={`note-card-${note.id}`}
    >
      <div className="rounded-xl border border-black/10 bg-white/60 p-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[8px] font-bold text-[#3b82f6]" data-testid={`note-avatar-${note.id}`}>
              {(note.agent_id || "A").charAt(0).toUpperCase()}
            </div>
            <div>
              <span className="text-[11px] font-semibold text-black/80" data-testid={`note-author-${note.id}`}>{note.agent_id || "Agent"}</span>
              <span className="ml-1.5 text-[9px] text-black/40" data-testid={`note-time-${note.id}`}>
                {formatRelativeTime(note.createdAt)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={() => toggleFavoriteMutation.mutate(
                { itemType: "note", itemId: note.id, label: `Note by ${note.agent_id || "Agent"}`, subtitle: `quoteId:${quoteId}|${(note.content || "").replace(/<[^>]*>/g, "").slice(0, 40)}` },
                { onSuccess: (data: any) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
              )}
              className={`inline-flex h-5 w-5 items-center justify-center rounded transition ${isNotePinned ? "text-amber-600 hover:bg-amber-50" : "text-black/40 hover:bg-black/5 hover:text-black/70"}`}
              title={isNotePinned ? "Unpin" : "Pin to dashboard"}
              data-testid={`note-btn-pin-${note.id}`}
            >
              <Pin className="h-2.5 w-2.5" />
            </button>
            <button type="button" onClick={() => setIsReplying(!isReplying)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Reply" data-testid={`note-btn-reply-${note.id}`}>
              <Reply className="h-2.5 w-2.5" />
            </button>
            <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Edit" data-testid={`note-btn-edit-${note.id}`}>
              <Pencil className="h-2.5 w-2.5" />
            </button>
            <button type="button" onClick={handleDelete} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-rose-50 hover:text-rose-500" title="Delete" data-testid={`note-btn-delete-${note.id}`}>
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="mt-1.5">
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
            className="mt-1 prose prose-sm max-w-none text-[11px] leading-relaxed text-black/70 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3"
            dangerouslySetInnerHTML={{ __html: note.content || "" }}
            data-testid={`note-content-${note.id}`}
          />
        )}

        {replies.length > 0 && (
          <div className="mt-1.5">
            <button
              type="button"
              onClick={() => setShowReplies(!showReplies)}
              className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#3b82f6] transition hover:text-[#3b82f6]/80"
              data-testid={`note-toggle-replies-${note.id}`}
            >
              <MessageSquare className="h-2.5 w-2.5" />
              {showReplies ? "Hide" : "Show"} {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </button>

            <AnimatePresence>
              {showReplies && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-1.5 space-y-1 overflow-hidden border-l-2 border-[#3b82f6]/20 pl-2"
                >
                  {replies.map((reply) => (
                    <ReplyCard key={reply.id} reply={reply} quoteId={quoteId} />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {isReplying && (
          <div className="mt-1.5">
            <NoteEditor
              placeholder="Write a reply..."
              onSubmit={handleReply}
              onCancel={() => setIsReplying(false)}
              submitLabel="Reply"
              isLoading={createMutation.isPending}
              compact
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ReplyCard({ reply, quoteId }: { reply: TransactionNote; quoteId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateNote(quoteId);
  const deleteMutation = useDeleteNote(quoteId);

  const handleEdit = (html: string) => {
    updateMutation.mutate(
      { id: reply.id, content: html },
      {
        onSuccess: () => { setIsEditing(false); toast({ title: "Reply updated" }); },
        onError: () => toast({ title: "Failed to update reply", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="group/reply rounded-xl border border-black/5 bg-white/50 p-2" data-testid={`reply-card-${reply.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-600">
            {(reply.agent_id || "A").charAt(0).toUpperCase()}
          </div>
          <span className="text-[10px] font-semibold text-black/70">{reply.agent_id || "Agent"}</span>
          <span className="text-[9px] text-black/35">
            {formatRelativeTime(reply.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover/reply:opacity-100">
          <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-black/5 hover:text-black/60" data-testid={`reply-btn-edit-${reply.id}`}>
            <Pencil className="h-2.5 w-2.5" />
          </button>
          <button type="button" onClick={() => deleteMutation.mutate(reply.id)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-rose-50 hover:text-rose-500" data-testid={`reply-btn-delete-${reply.id}`}>
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-1.5">
          <NoteEditor initialContent={reply.content ?? undefined} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact />
        </div>
      ) : (
        <div className="mt-1 prose prose-sm max-w-none text-[11px] text-black/60 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: reply.content || "" }} data-testid={`reply-content-${reply.id}`} />
      )}
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

function QuoteTasksSection({ quoteId, entityType = "quote" }: { quoteId: string; entityType?: "enquiry" | "quote" | "booking" }) {
  const taskEntityType = entityType === "booking" ? "quote" : entityType;
  const { data: tasksData, isLoading } = useTasks(taskEntityType, quoteId);
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateTask(taskEntityType, quoteId);
  const toggleMutation = useToggleTask(taskEntityType, quoteId);
  const deleteMutation = useDeleteTask(taskEntityType, quoteId);
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [taskCategory, setTaskCategory] = useState<string>(entityType);
  const [newTitle, setNewTitle] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("09:00");

  const presets = TASK_PRESETS_BY_ENTITY[taskCategory] || TASK_PRESETS_BY_ENTITY.quote;

  const handleAdd = () => {
    if (!newTitle || !newDueDate || !currentUser?.id) return;
    const dueDate = new Date(`${newDueDate}T${newDueTime || "09:00"}`);
    createMutation.mutate(
      {
        transaction_id: quoteId,
        user_id: currentUser.id,
        title: newTitle,
        due_date: dueDate,
        status: "pending",
      },
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

  const pendingTasks = useMemo(() => (tasksData || []).filter((t) => t.status !== 'completed'), [tasksData]);
  const completedTasks = useMemo(() => (tasksData || []).filter((t) => t.status === 'completed'), [tasksData]);

  return (
    <>
      <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-tasks">
        <div className="flex items-center justify-between" data-testid="row-tasks-header">
          <div>
            <div className="text-sm font-semibold" data-testid="text-tasks-title">Tasks</div>
            <div className="mt-1 text-xs text-black/55" data-testid="text-tasks-subtitle">Track to-dos for this {entityType}.</div>
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
                const isOverdue = new Date(task.due_date!) < new Date();
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
                      {formatTaskDue(task.due_date!)}
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

function QuoteNotesSection({ transactionId }: { transactionId: string }) {
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
    notesData
      .filter((n) => n.parent_id)
      .forEach((n) => {
        const existing = map.get(n.parent_id!) || [];
        existing.push(n);
        map.set(n.parent_id!, existing);
      });
    return map;
  }, [notesData]);

  const handleCreate = (html: string) => {
    createMutation.mutate(
      { transaction_id: transactionId, content: html },
      {
        onSuccess: () => toast({ title: "Note added" }),
        onError: () => toast({ title: "Failed to add note", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="mt-3 rounded-2xl border border-black/10 bg-white/70 p-3" data-testid="card-quote-notes">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold" data-testid="text-notes-title">
          Notes
        </div>
        <span className="rounded-full bg-black/5 px-1.5 py-0.5 text-[9px] font-semibold text-black/50" data-testid="text-notes-count">
          {topLevelNotes.length}
        </span>
      </div>

      <div className="mt-2 space-y-1.5" data-testid="list-notes">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner className="h-5 w-5" />
          </div>
        ) : topLevelNotes.length === 0 ? (
          <div className="py-6 text-center text-xs text-black/40" data-testid="text-notes-empty">
            No notes yet. Add one below.
          </div>
        ) : (
          <AnimatePresence>
            {topLevelNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                replies={repliesByParent.get(note.id) || []}
                quoteId={transactionId}
                currentUserName={authorName}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="mt-2">
        <NoteEditor
          placeholder="Add a note…"
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      </div>
    </div>
  );
}

function splitIsoDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split("T");
    return { date: parts[0] || "", time: (parts[1] || "").slice(0, 5) };
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function formatTimelineDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime24(timeStr: string) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function QuoteSummaryTimeline({ quote }: { quote: QuoteDisplay }) {
  const timelineItems: { type: string; sortKey: string; content: React.ReactNode }[] = [];

  if (quote.flights.outbound.from) {
    const sortKey = quote.flights.outbound.departDate + "T" + (quote.flights.outbound.departTime || "00:00");
    timelineItems.push({
      type: "outbound",
      sortKey,
      content: (
        <div className="flex gap-2.5" data-testid="timeline-outbound">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <Plane className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Outbound Flight</div>
            <div className="mt-0.5 text-xs font-semibold">{quote.flights.outbound.from} → {quote.flights.outbound.to}</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatTimelineDate(quote.flights.outbound.departDate)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Clock className="h-3 w-3 shrink-0" />
                <span>Depart {formatTime24(quote.flights.outbound.departTime)}{quote.flights.outbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.outbound.arriveTime)}` : ""}</span>
              </div>
              {(quote.flights.outbound.carrier || quote.flights.outbound.flightNo) && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Plane className="h-3 w-3 shrink-0" />
                  <span>{[quote.flights.outbound.carrier, quote.flights.outbound.flightNo].filter(Boolean).join(" ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    });
  }

  if (quote.accommodation.property) {
    const checkIn = quote.checkInDate || quote.travelDate;
    const checkInTime = quote.checkInTime || "14:00";
    const sortKey = checkIn + "T" + checkInTime;
    timelineItems.push({
      type: "hotel",
      sortKey,
      content: (
        <div className="flex gap-2.5" data-testid="timeline-hotel">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Hotel className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Hotel Check-in</div>
            <div className="mt-0.5 text-xs font-semibold">{quote.accommodation.property}</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatTimelineDate(checkIn)}</span>
                {checkInTime && <span>at {formatTime24(checkInTime)}</span>}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{[quote.resort, quote.country].filter(Boolean).join(", ") || quote.destination}</span>
              </div>
              {quote.nights > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{quote.nights} nights</span>
                </div>
              )}
              <div className="mt-0.5 flex flex-wrap gap-1.5">
                {quote.accommodation.roomType && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{quote.accommodation.roomType}</span>
                )}
                {quote.accommodation.board && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{quote.accommodation.board}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  if (quote.transferType) {
    const transferDate = quote.checkInDate || quote.travelDate;
    const sortKey = transferDate + "T" + (quote.flights.outbound.arriveTime || "12:00");
    timelineItems.push({
      type: "transfer",
      sortKey,
      content: (
        <div className="flex gap-2.5" data-testid="timeline-transfer">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
              <Bus className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Transfer</div>
            <div className="mt-0.5 text-xs font-semibold">{quote.transferType}</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <MapPin className="h-3 w-3 shrink-0" />
                <span>{quote.flights.outbound.to || "Airport"} → {quote.accommodation.property || quote.destination}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  const hasInbound = quote.flights.inbound.from || quote.flights.inbound.to || quote.flights.inbound.departDate || quote.returnDate;
  if (hasInbound) {
    const ibDate = quote.flights.inbound.departDate || quote.returnDate;
    const sortKey = ibDate + "T" + (quote.flights.inbound.departTime || "23:59");
    const ibFrom = quote.flights.inbound.from || quote.flights.outbound.to || "";
    const ibTo = quote.flights.inbound.to || quote.flights.outbound.from || "";
    timelineItems.push({
      type: "inbound",
      sortKey,
      content: (
        <div className="flex gap-2.5" data-testid="timeline-inbound">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
              <Plane className="h-3.5 w-3.5 rotate-180" />
            </div>
          </div>
          <div className="flex-1 pb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">Inbound Flight</div>
            <div className="mt-0.5 text-xs font-semibold">{ibFrom} → {ibTo}</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatTimelineDate(ibDate)}</span>
              </div>
              {quote.flights.inbound.departTime && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Depart {formatTime24(quote.flights.inbound.departTime)}{quote.flights.inbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.inbound.arriveTime)}` : ""}</span>
                </div>
              )}
              {(quote.flights.inbound.carrier || quote.flights.inbound.flightNo) && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Plane className="h-3 w-3 shrink-0" />
                  <span>{[quote.flights.inbound.carrier, quote.flights.inbound.flightNo].filter(Boolean).join(" ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    });
  }

  timelineItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div data-testid="card-quote-summary-timeline">
      <div className="mb-3">
        <div className="text-xs font-semibold" data-testid="text-timeline-title">Travel Summary</div>
        <div className="mt-0.5 text-[11px] text-black/55" data-testid="text-timeline-subtitle">
          {formatTimelineDate(quote.travelDate)} — {formatTimelineDate(quote.returnDate)} · {quote.destination}
        </div>
      </div>

      {timelineItems.length > 0 ? (
        <div data-testid="list-timeline-items">
          {timelineItems.map((item, idx) => (
            <div key={idx}>{item.content}</div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center text-sm text-black/55" data-testid="empty-timeline">
          No travel details added yet. Edit the quote to add flight and accommodation details.
        </div>
      )}
    </div>
  );
}

function transformQuoteData(apiData: ApiQuote): QuoteDisplay {
  const flights = apiData.flights || [];
  const outboundFlight = flights.find(f => f.flight_type === "outbound") || flights[0];
  const inboundFlight = flights.find(f => f.flight_type === "inbound") || flights[1];

  const obDepart = splitIsoDateTime(outboundFlight?.departure_date_time || "");
  const obArrive = splitIsoDateTime(outboundFlight?.arrival_date_time || "");
  const ibDepart = splitIsoDateTime(inboundFlight?.departure_date_time || "");
  const ibArrive = splitIsoDateTime(inboundFlight?.arrival_date_time || "");

  const accommodations = apiData.accommodations || [];
  const primaryAccom = accommodations.find(a => a.is_primary) || accommodations[0];

  const travelDate = apiData.travel_date || "";
  const numNights = apiData.num_of_nights || 0;
  const returnDate = travelDate ? (() => {
    const d = new Date(travelDate);
    d.setDate(d.getDate() + numNights);
    return d.toISOString().split("T")[0];
  })() : "";

  const salesPrice = parseFloat(apiData.sales_price || "0");
  const packageCommission = parseFloat(apiData.package_commission || "0");

  const childPassengers = (apiData.passengers || []).filter(p => p.type === "child");

  return {
    id: apiData.id,
    transaction_id: apiData.transaction_id,
    status: apiData.quote_status || (apiData as any).booking_status || "draft",
    packageType: (apiData as any).holiday_type_name || apiData.quote_type || "",
    quoteTitle: apiData.title || "",
    quoteLink: "",
    travelDate,
    returnDate,
    destination: "",
    country: "",
    resort: "",
    createdAt: apiData.date_created || "",
    passengersInfants: apiData.infant || 0,
    checkInDate: primaryAccom?.check_in_date_time?.split("T")[0] || "",
    checkInTime: primaryAccom?.check_in_date_time ? splitIsoDateTime(primaryAccom.check_in_date_time).time : "",
    nights: numNights,
    transferType: apiData.transfer_type || "",
    preBookedSeats: apiData.pre_booked_seats || "",
    flightMeals: apiData.flight_meals ? "Yes" : "",
    leadSource: "",
    tags: [],
    passengers: {
      adults: apiData.adult || 0,
      children: apiData.child || 0,
      childAges: childPassengers.map(p => p.age || 0),
    },
    accommodation: {
      property: (primaryAccom as any)?.accomodation_name || "",
      board: (primaryAccom as any)?.board_basis_name || "",
      roomType: primaryAccom?.room_type || "",
      notes: "",
    },
    flights: {
      outbound: {
        from: (outboundFlight as any)?.departing_airport_name || "",
        to: (outboundFlight as any)?.arrival_airport_name || "",
        carrier: "",
        flightNo: outboundFlight?.flight_number || "",
        depart: outboundFlight?.departure_date_time || "",
        arrive: outboundFlight?.arrival_date_time || "",
        departDate: obDepart.date,
        departTime: obDepart.time,
        arriveDate: obArrive.date,
        arriveTime: obArrive.time,
      },
      inbound: {
        from: (inboundFlight as any)?.departing_airport_name || "",
        to: (inboundFlight as any)?.arrival_airport_name || "",
        carrier: "",
        flightNo: inboundFlight?.flight_number || "",
        depart: inboundFlight?.departure_date_time || "",
        arrive: inboundFlight?.arrival_date_time || "",
        departDate: ibDepart.date,
        departTime: ibDepart.time,
        arriveDate: ibArrive.date,
        arriveTime: ibArrive.time,
      },
    },
    owner: {
      name: "Agent",
      role: "Agent",
    },
    commissions: {
      tourOperator: (apiData as any).main_tour_operator_name || "",
      price: salesPrice,
      commissionPercent: salesPrice > 0 ? (packageCommission / salesPrice) * 100 : 0,
      commissionValue: packageCommission,
      agentSplitPercent: 0,
      agentSplitValue: 0,
      netToAgency: packageCommission,
    },
    notes: [],
  };
}

function StatusPill({ status }: { status: QuoteDisplay["status"] }) {
  const styles =
    status === "accepted"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-900"
      : status === "rejected" || status === "expired"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-900"
        : "border-indigo-500/20 bg-indigo-500/10 text-indigo-900";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`} data-testid={`pill-quote-status-${status}`}>
      {status}
    </span>
  );
}

function KeyValue({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={testid}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45" data-testid={`${testid}-label`}>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-black/85" data-testid={`${testid}-value`}>
        {value}
      </div>
    </div>
  );
}

function formatTagLabel(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export default function QuotePage({ isBooking = false }: { isBooking?: boolean } = {}) {
  const [, setLocation] = useLocation();
  const [, quoteParams] = useRoute("/clients/:clientId/quotes/:quoteId");
  const [, bookingParams] = useRoute("/clients/:clientId/bookings/:quoteId");
  const params = isBooking ? bookingParams : quoteParams;

  const { role } = useRole();
  const clientId = params?.clientId ?? "";
  const quoteId = params?.quoteId ?? "";

  const quoteQuery = useQuote(isBooking ? "" : quoteId);
  const bookingQuery = useBooking(isBooking ? quoteId : "");
  const { data: quoteData, isLoading, error } = isBooking ? bookingQuery : quoteQuery;
  const clientQuery = useClient(isBooking ? "" : clientId);
  const neonClientQuery = useNeonClient(isBooking ? clientId : "");
  const clientData = isBooking
    ? (neonClientQuery.data ? { name: `${neonClientQuery.data.firstName || ""} ${neonClientQuery.data.surename || ""}`.trim() } : undefined)
    : clientQuery.data;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: userFavorites } = useFavorites();
  const toggleFavoriteMutation = useToggleFavorite();
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const updateQuoteMutation = useUpdateQuote();
  const convertToBookingMutation = useConvertToBooking();
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertHaysRef, setConvertHaysRef] = useState("");
  const [convertTourRef, setConvertTourRef] = useState("");
  const [newTag, setNewTag] = useState("");
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagSuggestionsRef = useRef<HTMLDivElement>(null);
  const allTags: string[] = [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
      if (tagSuggestionsRef.current && !tagSuggestionsRef.current.contains(e.target as Node) &&
          tagInputRef.current && !tagInputRef.current.contains(e.target as Node)) {
        setShowTagSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const images = useMemo(() => {
    const imgs = quoteData?.images || [];
    return imgs.map(img => ({ id: img.id, url: img.image_url || "", isPrimary: img.isPrimary }));
  }, [quoteData]);
  const primaryImage = useMemo(() => images.find((img) => img.isPrimary) || images[0], [images]);
  const galleryImages = useMemo(() => images.filter((img) => img.id !== primaryImage?.id), [images, primaryImage]);

  const quote = useMemo(() => {
    if (!quoteData) return null;
    return transformQuoteData(quoteData);
  }, [quoteData]);

  const pageLabel = isBooking || quoteData?.quote_status === "accepted" ? "Booking" : "Quote";

  if (isLoading) {
    return (
      <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => {}}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-quote">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (error || !quote) {
    return (
      <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => {}}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-quote">
          <div className="text-center">
            <p className="text-sm text-black/70">Failed to load {pageLabel.toLowerCase()}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setLocation("/clients")}
            >
              Back to Clients
            </Button>
          </div>
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title={pageLabel} theme="light" onRoleChange={() => {}}>
      <div className="px-5 pb-8 pt-5" data-testid="page-quote">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-quote-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => setLocation(`/clients/${clientId}`)}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Client
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-quote-title">
                  {quote.quoteTitle}, <span className="text-sm font-semibold text-[#000000]">{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                </div>
                <StatusPill status={quote.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-quote-meta">
                <span data-testid="text-quote-meta-destination">{quote.destination}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-dates">
                  {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                </span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-created">Created {formatUKDate(quote.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
            <button
              type="button"
              onClick={() =>
                toggleFavoriteMutation.mutate(
                  { itemType: "quote", itemId: quoteId, label: quote.quoteTitle, subtitle: `${clientData?.name || ""}${quote.destination ? " · " + quote.destination : ""}` },
                  { onSuccess: (data: any) => { toast({ title: data?.favorited ? "Pinned to dashboard" : "Unpinned from dashboard" }); } }
                )
              }
              className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${userFavorites?.some((f: any) => f.itemType === "quote" && f.itemId === quoteId) ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15" : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"}`}
              data-testid="button-pin-quote"
            >
              {userFavorites?.some((f: any) => f.itemType === "quote" && f.itemId === quoteId) ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {userFavorites?.some((f: any) => f.itemType === "quote" && f.itemId === quoteId) ? "Unpin" : "Pin"}
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-copy-quote"
              onClick={() => navigator.clipboard.writeText(`${quote.quoteTitle} (${quote.id})`)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button size="sm" className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90" data-testid="button-export-quote" onClick={() => {}}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid content-start gap-1.5" data-testid="col-itinerary-media">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]" data-testid="img-itinerary-hero">
                    {primaryImage ? (
                      <>
                        <img
                          src={primaryImage.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          data-testid="img-itinerary-hero-photo"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" aria-hidden />
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white" data-testid="badge-main-image">
                          <Star className="h-3 w-3 fill-current" /> Main
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-black/40" data-testid="placeholder-no-hero">
                        No images
                      </div>
                    )}
                  </div>

                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5" data-testid="grid-itinerary-gallery">
                      {galleryImages.map((img, idx) => (
                        <button
                          key={img.id}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] active:scale-[0.99]"
                          data-testid={`button-gallery-image-${idx}`}
                          onClick={() => {}}
                          title="Click to set as main image"
                        >
                          <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid={`img-gallery-${idx}`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100" aria-hidden />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[8px] font-semibold text-white opacity-0 transition group-hover:opacity-100" data-testid={`label-set-main-${idx}`}>
                            <Star className="h-2.5 w-2.5" /> Set as main
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 rounded-2xl border border-black/10 bg-white/60 p-2.5" data-testid="card-quote-tags-inline">
                    <div className="flex items-center justify-between">
                      <div className="text-[11px] font-semibold" data-testid="text-tags-title-inline">Tags</div>
                      <Tag className="h-3 w-3 text-black/35" aria-hidden />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="list-tags-inline">
                      {quote.tags.map((t) => (
                        <span
                          key={t}
                          className="group inline-flex items-center gap-1 rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/70"
                          data-testid={`pill-tag-inline-${t}`}
                        >
                          {t}
                          <button
                            type="button"
                            className="ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-black/35 transition hover:bg-black/[0.06] hover:text-black/60"
                            data-testid={`button-remove-tag-inline-${t}`}
                            onClick={() => {
                              const updated = quote.tags.filter((tag) => tag !== t);
                              updateQuoteMutation.mutate(
                                { id: quoteId, data: { tags: updated } },
                                { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }) }
                              );
                            }}
                          >
                            <X className="h-2.5 w-2.5" aria-hidden />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="relative mt-2 flex items-center gap-1.5" data-testid="row-add-tag-inline">
                      <div className="relative flex-1">
                        <Input
                          ref={tagInputRef}
                          placeholder="Add tag…"
                          className="h-7 rounded-xl border-black/10 bg-white/70 text-[10px]"
                          data-testid="input-add-tag-inline"
                          value={newTag}
                          onChange={(e) => {
                            setNewTag(e.target.value);
                            setShowTagSuggestions(true);
                          }}
                          onFocus={() => {
                            setShowTagSuggestions(true);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newTag.trim()) {
                              const updated = [...quote.tags, newTag.trim()];
                              updateQuoteMutation.mutate(
                                { id: quoteId, data: { tags: updated } },
                                { onSuccess: () => { setNewTag(""); setShowTagSuggestions(false); queryClient.invalidateQueries({ queryKey: ["quotes"] }); queryClient.invalidateQueries({ queryKey: ["quote-tags"] }); } }
                              );
                            }
                            if (e.key === "Escape") setShowTagSuggestions(false);
                          }}
                        />
                        {showTagSuggestions && (() => {
                          const filtered = allTags.filter(
                            (t) => (!newTag.trim() || t.toLowerCase().includes(newTag.trim().toLowerCase())) && !quote.tags.includes(t)
                          );
                          if (filtered.length === 0) return null;
                          return (
                            <div
                              ref={tagSuggestionsRef}
                              className="absolute left-0 top-full z-50 mt-1 max-h-32 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg"
                              data-testid="list-tag-suggestions"
                            >
                              {filtered.map((t) => (
                                <button
                                  key={t}
                                  type="button"
                                  className="w-full px-2.5 py-1.5 text-left text-[11px] text-black/70 transition hover:bg-black/[0.04]"
                                  data-testid={`button-tag-suggestion-${t}`}
                                  onClick={() => {
                                    const updated = [...quote.tags, t];
                                    updateQuoteMutation.mutate(
                                      { id: quoteId, data: { tags: updated } },
                                      { onSuccess: () => { setNewTag(""); setShowTagSuggestions(false); queryClient.invalidateQueries({ queryKey: ["quotes"] }); queryClient.invalidateQueries({ queryKey: ["quote-tags"] }); } }
                                    );
                                  }}
                                >
                                  {t}
                                </button>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                      <Button
                        size="sm"
                        className="h-7 rounded-xl bg-[#3b82f6] px-2.5 text-[10px] text-white hover:bg-[#3b82f6]/90"
                        data-testid="button-add-tag-inline"
                        disabled={!newTag.trim()}
                        onClick={() => {
                          if (!newTag.trim()) return;
                          const updated = [...quote.tags, newTag.trim()];
                          updateQuoteMutation.mutate(
                            { id: quoteId, data: { tags: updated } },
                            { onSuccess: () => { setNewTag(""); setShowTagSuggestions(false); queryClient.invalidateQueries({ queryKey: ["quotes"] }); queryClient.invalidateQueries({ queryKey: ["quote-tags"] }); } }
                          );
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="min-w-0" data-testid="section-itinerary-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-itinerary-top">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3" data-testid="row-itinerary-title">
                        <div className="min-w-0" data-testid="col-itinerary-title-left">
                          <div className="flex items-center gap-2" data-testid="text-itinerary-quote-title">
                            <span className="truncate text-base font-semibold">{quote.quoteTitle},</span>
                            <span className="flex items-center gap-1.5 font-semibold text-[14px] text-[#000000]" data-testid="text-itinerary-quote-summary">
                              <span>{(() => {
                                const start = new Date(quote.travelDate);
                                const end = new Date(quote.returnDate);
                                const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                                return `${nights} nights`;
                              })()}</span>
                              <span className="text-black/25">•</span>
                              <span>{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                            </span>
                          </div>
                          {quote.quoteLink && quote.quoteLink !== "#" && (
                            <a
                              href={quote.quoteLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[#3b82f6] transition hover:text-[#3b82f6]/80"
                              data-testid="link-quote-link"
                            >
                              <LinkIcon className="h-3 w-3" />
                              View Quote Link
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex flex-row-reverse items-center justify-end gap-2 rounded-full border border-black/10 bg-white/70 px-1.5 py-1 text-[11px] font-semibold text-black/70"
                            data-testid="pill-itinerary-owner"
                          >
                            <span
                              className="relative grid h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10 bg-white/70 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.35)]"
                              data-testid="avatar-itinerary-owner"
                              aria-hidden
                            >
                              <img
                                src="/attached_assets/Avatar3_1769960371403.png"
                                alt=""
                                className="h-full w-full object-cover"
                                data-testid="img-itinerary-owner-avatar"
                              />
                              <span className="pointer-events-none absolute inset-0 ring-1 ring-white/40" aria-hidden />
                            </span>

                            <span className="flex flex-col items-end leading-tight" data-testid="col-itinerary-owner">
                              <span className="whitespace-nowrap" data-testid="text-itinerary-owner-name">{quote.owner.name}</span>
                              <span className="whitespace-nowrap text-[10px] font-semibold text-black/50" data-testid="text-itinerary-owner-role">{quote.owner.role}</span>
                            </span>
                          </span>

                          <div className="relative" ref={ellipsisRef}>
                            <button
                              type="button"
                              onClick={() => setShowEllipsisMenu((v) => !v)}
                              className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                              data-testid="button-quote-ellipsis"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showEllipsisMenu && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-quote-ellipsis">
                                {[
                                  { label: `Edit ${pageLabel}`, icon: Pencil, id: "edit" },
                                  ...(quote.status !== "accepted" ? [{ label: "Convert to Booking", icon: RefreshCw, id: "convert" }] : []),
                                  { label: `Duplicate ${pageLabel}`, icon: Copy, id: "duplicate" },
                                ].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                                    data-testid={`button-quote-${item.id}`}
                                    onClick={() => {
                                      setShowEllipsisMenu(false);
                                      if (item.id === "edit") {
                                        setShowEditModal(true);
                                      } else if (item.id === "convert") {
                                        setShowConvertDialog(true);
                                      } else {
                                        toast({ title: `${item.label} — coming soon` });
                                      }
                                    }}
                                  >
                                    <item.icon className="h-3.5 w-3.5" />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        <span className="text-sm text-black/55" data-testid="text-itinerary-location">{quote.destination}</span>
                        {quote.tags.length > 0 && (
                          <div className="flex flex-wrap items-center gap-2" data-testid="list-itinerary-tags-inline">
                            {quote.tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-black/70"
                                data-testid={`pill-itinerary-tag-${t}`}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
                    <div className="grid content-start gap-2" data-testid="col-itinerary-left">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-hotel">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-hotel-label">Hotel</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-hotel-value">{quote.accommodation.property}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-room">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-room-label">Room Type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-room-value">{quote.accommodation.roomType}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-board">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-board-label">Board Basis</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-board-value">{quote.accommodation.board}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-transfer">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-transfer-label">Transfer Type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-transfer-value">{quote.transferType || "Private Transfer"}</div>
                      </div>
                    </div>

                    <div className="grid content-start gap-2" data-testid="col-itinerary-right">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-operator-label">Tour Operator</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-departure-airport">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-departure-airport-label">Departure Airport</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-departure-airport-value">{quote.flights.outbound.from}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-passengers-label">Passengers</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-passengers-value">
                          {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children (${[12, 7].join(", ")})` : ""}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-nights">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-nights-label">Number of Nights</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-nights-value">{quote.nights}</div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-lead-source">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-itinerary-lead-source-label">Lead Source</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-lead-source-value">{quote.leadSource || "—"}</div>
                      </div>
                    </div>
                  </div>

                  {quote.status === "accepted" && (
                    <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3" data-testid="card-booking-references">
                      <div className="text-xs font-semibold text-emerald-800 mb-2">Booking References</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-hays-reference">
                          <div className="text-xs font-semibold text-black/65">HAYS Reference</div>
                          <div className="text-xs font-semibold text-black/85" data-testid="text-hays-reference-value">—</div>
                        </div>
                        <div className="flex items-center justify-between rounded-xl border border-emerald-500/15 bg-white/70 px-3 py-2" data-testid="row-tour-reference">
                          <div className="text-xs font-semibold text-black/65">Tour Reference</div>
                          <div className="text-xs font-semibold text-black/85" data-testid="text-tour-reference-value">—</div>
                        </div>
                      </div>
                    </div>
                  )}

                  <QuoteNotesSection transactionId={quote.transaction_id} />
                </div>
              </div>
            </Card>

            <div className="grid gap-3" data-testid="col-quote-right">
              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-summary-right">
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
                    <TabsTrigger value="summary" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-summary">Quote Summary</TabsTrigger>
                    <TabsTrigger value="costings" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-costings">Quote Costings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-0">
                    <QuoteSummaryTimeline quote={quote} />
                  </TabsContent>

                  <TabsContent value="costings" className="mt-0">
                    <div className="flex items-center justify-between" data-testid="row-quote-summary-header">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-quote-summary-title">
                          Financial Summary
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-quote-summary-subtitle">
                          Commission and charges.
                        </div>
                      </div>
                      <FileText className="h-4 w-4 text-black/35" aria-hidden />
                    </div>

                    <div className="mt-3 grid gap-2" data-testid="list-quote-summary-lines">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-total-price">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-total-price-label">Total Price</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-total-price-value">
                          {currency.format(quote.commissions.price)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-commission">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-commission-label">Commission ({quote.commissions.commissionPercent}%)</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-commission-value">
                          {currency.format(quote.commissions.commissionValue)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-agent-split">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-agent-split-label">Agent Split ({quote.commissions.agentSplitPercent}%)</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-agent-split-value">
                          {currency.format(quote.commissions.agentSplitValue)}
                        </div>
                      </div>

                      <div className="my-1 h-px w-full bg-black/10" data-testid="separator-quote-summary" />

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-quote-summary-total-commission">
                        <div className="text-xs font-semibold text-black/70" data-testid="text-quote-summary-total-commission-label">Net to Agency</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-commission-value">
                          {currency.format(quote.commissions.netToAgency)}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>

              <QuoteTasksSection quoteId={quoteId} entityType={pageLabel === "Booking" ? "booking" : "quote"} />

            </div>
          </div>
        </div>
      </div>
      {quote && (
        <EditQuoteDialog
          open={showEditModal}
          onOpenChange={setShowEditModal}
          quote={quote}
          quoteData={quoteData!}
          onSave={(updates) => {
            updateQuoteMutation.mutate(
              { id: quoteId, data: updates },
              {
                onSuccess: () => {
                  setShowEditModal(false);
                  queryClient.invalidateQueries({ queryKey: ["quotes"] });
                  toast({ title: "Quote updated successfully" });
                },
                onError: () => {
                  toast({ title: "Failed to update quote", variant: "destructive" });
                },
              }
            );
          }}
          isSaving={updateQuoteMutation.isPending}
        />
      )}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-convert-booking">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Enter the booking references to convert this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
              <Input
                value={convertHaysRef}
                onChange={(e) => setConvertHaysRef(e.target.value)}
                placeholder="e.g. HAYS-12345"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-convert-hays-ref"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
              <Input
                value={convertTourRef}
                onChange={(e) => setConvertTourRef(e.target.value)}
                placeholder="e.g. TOUR-67890"
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid="input-convert-tour-ref"
              />
            </div>
            <Button
              className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
              data-testid="button-confirm-convert"
              onClick={() => {
                convertToBookingMutation.mutate(
                  { quoteId, haysRef: convertHaysRef, supplierRef: convertTourRef },
                  {
                    onSuccess: () => {
                      setShowConvertDialog(false);
                      setConvertHaysRef("");
                      setConvertTourRef("");
                      queryClient.invalidateQueries({ queryKey: ["quotes"] });
                      toast({ title: "Quote converted to booking" });
                      setLocation(`/clients/${clientId}/bookings/${quoteId}`);
                    },
                    onError: () => {
                      toast({ title: "Failed to convert", variant: "destructive" });
                    },
                  }
                );
              }}
              disabled={convertToBookingMutation.isPending}
            >
              {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}

function EditQuoteDialog({
  open,
  onOpenChange,
  quote,
  quoteData,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: QuoteDisplay;
  quoteData: ApiQuote;
  onSave: (data: Record<string, any>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(() => buildEditForm(quote, quoteData));

  useEffect(() => {
    if (open) setForm(buildEditForm(quote, quoteData));
  }, [open, quote, quoteData]);

  const set = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }));

  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: accommodationsData } = useAllAccommodations();

  const handleSave = () => {
    const travelDateObj = new Date(form.travelDate);
    const returnDateObj = new Date(travelDateObj);
    returnDateObj.setDate(returnDateObj.getDate() + (form.nights || 7));

    const updates: Record<string, any> = {
      title: form.quoteTitle,
      quote_status: form.status,
      travel_date: form.travelDate,
      num_of_nights: form.nights,
      adult: form.passengersAdults,
      child: form.passengersChildren,
      infant: form.passengersInfants,
      transfer_type: form.transferType,
      pre_booked_seats: form.preBookedSeats,
      flight_meals: form.flightMeals === "Yes" || form.flightMeals === true,
      main_tour_operator_id: form.tourOperatorId || null,
      sales_price: String(form.price || 0),
      package_commission: String(((form.commission || 0) / 100) * (form.price || 0)),
      discounts: String(form.discount || 0),
      service_charge: String(form.serviceCharge || 0),
      price_per_person: String(form.pricePerPerson || 0),
    };

    const showFlights = form.packageType !== "Hot Tub Break" && !(form.packageType === "Cruise Package" && form.cruiseOnly);
    if (showFlights) {
      const buildDateTime = (date: string, time: string) => {
        if (!date) return null;
        return time ? `${date}T${time}:00` : `${date}T00:00:00`;
      };

      updates.outboundFlight = {
        departing_airport_id: form.outboundDepartAirportId || null,
        arrival_airport_id: form.outboundArriveAirportId || null,
        departure_date_time: buildDateTime(form.outboundDepartDate, form.outboundDepartTime),
        arrival_date_time: buildDateTime(form.outboundArriveDate, form.outboundArriveTime),
        flight_number: form.outboundFlightNumber || null,
      };

      updates.inboundFlight = {
        departing_airport_id: form.inboundDepartAirportId || null,
        arrival_airport_id: form.inboundArriveAirportId || null,
        departure_date_time: buildDateTime(form.inboundDepartDate, form.inboundDepartTime),
        arrival_date_time: buildDateTime(form.inboundArriveDate, form.inboundArriveTime),
        flight_number: form.inboundFlightNumber || null,
      };
    }

    if (form.packageType !== "Hot Tub Break") {
      updates.primaryAccommodation = {
        accomodation_id: form.accommodationId || null,
        board_basis_id: form.boardBasisId || null,
        room_type: form.roomType || null,
        no_of_nights: form.nights || 0,
        check_in_date_time: form.checkInDate ? (form.checkInTime ? `${form.checkInDate}T${form.checkInTime}:00` : `${form.checkInDate}T00:00:00`) : null,
      };
    }

    if (form.packageType === "Cruise Package") {
      updates.cruiseTitle = form.cruiseTitle;
      updates.cruiseLine = form.cruiseLine;
      updates.shipName = form.shipName;
      updates.cruiseDate = form.cruiseDate;
      updates.cabinType = form.cabinType;
      updates.embarkation = form.embarkation;
      updates.debarkation = form.debarkation;
      updates.cruiseExtras = form.cruiseExtras;
      updates.cruiseOnly = form.cruiseOnly;
    }

    if (form.packageType === "Hot Tub Break") {
      updates.lodge_type = form.lodgeCode;
      updates.pets = form.pets ? 1 : 0;
    }

    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Quote</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Update quote details, accommodation, flights, and pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-6">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Details</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Package Type</Label>
                <Select value={form.packageType} onValueChange={(v) => set("packageType", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-package-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Package Holiday">Package Holiday</SelectItem>
                    <SelectItem value="Hot Tub Break">Hot Tub Break</SelectItem>
                    <SelectItem value="Cruise Package">Cruise Package</SelectItem>
                    <SelectItem value="Flight Only">Flight Only</SelectItem>
                    <SelectItem value="Hotel Only">Hotel Only</SelectItem>
                    <SelectItem value="Tour">Tour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                <Input
                  placeholder="e.g. Maldives — Overwater Villa, 9 nights"
                  value={form.quoteTitle}
                  onChange={(e) => set("quoteTitle", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-quote-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Link</Label>
                <Input
                  placeholder="https://..."
                  value={form.quoteLink}
                  onChange={(e) => set("quoteLink", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-quote-link"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Lead Source</Label>
                <Select value={form.leadSource} onValueChange={(v) => set("leadSource", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-lead-source">
                    <SelectValue placeholder="Select source..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Shop">Shop</SelectItem>
                    <SelectItem value="Facebook">Facebook</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                    <SelectItem value="Instagram">Instagram</SelectItem>
                    <SelectItem value="Phone Enquiry">Phone Enquiry</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">JSON Upload</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string || "";
                        const toIsoDate = (d: string | undefined): string => {
                          if (!d) return "";
                          const match = d.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                          if (match) {
                            const [, day, month, year] = match;
                            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                          }
                          return d;
                        };
                        try {
                          const data = JSON.parse(content);
                          setForm((prev: any) => ({
                            ...prev,
                            packageType: data.packageType || data.package_type || prev.packageType,
                            quoteTitle: data.quoteTitle || data.quote_title || data.title || prev.quoteTitle,
                            quoteLink: data.quoteLink || data.quote_link || data.link || prev.quoteLink,
                            travelDate: toIsoDate(data.travelDate || data.travel_date || data.departureDate) || prev.travelDate,
                            passengersAdults: data.passengers?.adults || data.adults || data.passengersAdults || prev.passengersAdults,
                            passengersChildren: data.passengers?.children || data.children || data.passengersChildren || prev.passengersChildren,
                            passengersInfants: data.passengers?.infants || data.infants || data.passengersInfants || prev.passengersInfants,
                            childAges: data.childAges || data.child_ages || data.passengers?.childAges || prev.childAges,
                            country: data.country || prev.country,
                            destination: data.destination || prev.destination,
                            resort: data.resort || prev.resort,
                            accommodation: data.accommodation || data.hotel || data.property || prev.accommodation,
                            checkInDate: toIsoDate(data.checkInDate || data.check_in_date || data.checkin) || prev.checkInDate,
                            checkInTime: data.checkInTime || data.check_in_time || prev.checkInTime,
                            nights: data.nights || data.duration || prev.nights,
                            boardBasis: data.boardBasis || data.board_basis || data.board || prev.boardBasis,
                            roomType: data.roomType || data.room_type || data.room || prev.roomType,
                            transferType: data.transferType || data.transfer_type || data.transfers || prev.transferType,
                            preBookedSeats: data.preBookedSeats || data.pre_booked_seats || data.seats || prev.preBookedSeats,
                            flightMeals: data.flightMeals || data.flight_meals || data.meals || prev.flightMeals,
                            outboundDepartAirport: data.flights?.outbound?.departAirport || data.outbound?.from || data.departureAirport || prev.outboundDepartAirport,
                            outboundDepartDate: toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date) || prev.outboundDepartDate,
                            outboundDepartTime: data.flights?.outbound?.departTime || data.outbound?.time || prev.outboundDepartTime,
                            outboundArriveAirport: data.flights?.outbound?.arriveAirport || data.outbound?.to || data.arrivalAirport || prev.outboundArriveAirport,
                            outboundArriveDate: toIsoDate(data.flights?.outbound?.arriveDate) || prev.outboundArriveDate,
                            outboundArriveTime: data.flights?.outbound?.arriveTime || prev.outboundArriveTime,
                            inboundDepartAirport: data.flights?.inbound?.departAirport || data.inbound?.from || prev.inboundDepartAirport,
                            inboundDepartDate: toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date) || prev.inboundDepartDate,
                            inboundDepartTime: data.flights?.inbound?.departTime || data.inbound?.time || prev.inboundDepartTime,
                            inboundArriveAirport: data.flights?.inbound?.arriveAirport || data.inbound?.to || prev.inboundArriveAirport,
                            inboundArriveDate: toIsoDate(data.flights?.inbound?.arriveDate) || prev.inboundArriveDate,
                            inboundArriveTime: data.flights?.inbound?.arriveTime || prev.inboundArriveTime,
                            tourOperator: data.commissions?.tourOperator || data.tourOperator || data.tour_operator || data.operator || prev.tourOperator,
                            sales: data.commissions?.sales || data.sales || prev.sales,
                            price: data.commissions?.price || data.price || data.total || prev.price,
                            commission: data.commissions?.commission || data.commission || prev.commission,
                            discount: data.commissions?.discount || data.discount || prev.discount,
                            serviceCharge: data.commissions?.serviceCharge || data.serviceCharge || data.service_charge || prev.serviceCharge,
                            pricePerPerson: data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp || prev.pricePerPerson,
                          }));
                        } catch {
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-json-upload"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {form.packageType === "Hot Tub Break" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-travel-date-only">
              <div className="mb-3 text-sm font-semibold">Travel Details</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                  <DatePicker
                    value={form.travelDate}
                    onChange={(v) => set("travelDate", v)}
                    placeholder="Pick a date"
                    data-testid="edit-input-travel-date"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-travel-details">
              <div className="mb-3 text-sm font-semibold">Travel Details</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                  <DatePicker
                    value={form.travelDate}
                    onChange={(v) => set("travelDate", v)}
                    placeholder="Pick a date"
                    data-testid="edit-input-travel-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.passengersAdults}
                    onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-adults"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.passengersChildren}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      set("passengersChildren", count);
                      set("childAges", Array(count).fill(0));
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-children"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Infants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.passengersInfants}
                    onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-infants"
                  />
                </div>
                {form.passengersChildren > 0 && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                    <div className="flex flex-wrap gap-2">
                      {form.childAges.map((age: number, idx: number) => (
                        <Input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const ages = [...form.childAges];
                            ages[idx] = parseInt(e.target.value) || 0;
                            set("childAges", ages);
                          }}
                          className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                          data-testid={`edit-input-child-age-${idx}`}
                          placeholder={`Child ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {form.packageType === "Cruise Package" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-cruise-cabin">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Anchor className="h-4 w-4" />
                Cruise & Cabin
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Title</Label>
                  <Input
                    placeholder="e.g. Western Mediterranean"
                    value={form.cruiseTitle}
                    onChange={(e) => set("cruiseTitle", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-cruise-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Line</Label>
                  <Input
                    placeholder="e.g. Royal Caribbean"
                    value={form.cruiseLine}
                    onChange={(e) => set("cruiseLine", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-cruise-line"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Ship Name</Label>
                  <Input
                    placeholder="e.g. Harmony of the Seas"
                    value={form.shipName}
                    onChange={(e) => set("shipName", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-ship-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Date</Label>
                  <DatePicker
                    value={form.cruiseDate}
                    onChange={(v) => set("cruiseDate", v)}
                    placeholder="Pick a date"
                    data-testid="edit-input-cruise-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cabin Type</Label>
                  <Select value={form.cabinType} onValueChange={(v) => set("cabinType", v)}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-cabin-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Inside">Inside</SelectItem>
                      <SelectItem value="Outside">Outside</SelectItem>
                      <SelectItem value="Balcony">Balcony</SelectItem>
                      <SelectItem value="Suite">Suite</SelectItem>
                      <SelectItem value="Mini Suite">Mini Suite</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Embarkation</Label>
                  <Input
                    placeholder="e.g. Southampton"
                    value={form.embarkation}
                    onChange={(e) => set("embarkation", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-embarkation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Debarkation</Label>
                  <Input
                    placeholder="e.g. Barcelona"
                    value={form.debarkation}
                    onChange={(e) => set("debarkation", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-debarkation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Extras Included</Label>
                  <Input
                    placeholder="e.g. Drinks package, WiFi"
                    value={form.cruiseExtras}
                    onChange={(e) => set("cruiseExtras", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-cruise-extras"
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Only</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={form.cruiseOnly}
                        onCheckedChange={(v) => set("cruiseOnly", v)}
                        data-testid="edit-switch-cruise-only"
                      />
                      <span className="text-xs text-black/55">{form.cruiseOnly ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : form.packageType === "Hot Tub Break" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-lodge-details">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Hotel className="h-4 w-4" />
                Lodge Details
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Lodge Code</Label>
                  <Input
                    placeholder="e.g. HT-2451"
                    value={form.lodgeCode}
                    onChange={(e) => set("lodgeCode", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-lodge-code"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Park Name</Label>
                  <Input
                    placeholder="e.g. Forest Holidays"
                    value={form.parkName}
                    onChange={(e) => set("parkName", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-park-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.nights}
                    onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-lodge-nights"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                  <DatePicker
                    value={form.checkInDate}
                    onChange={(v) => set("checkInDate", v)}
                    placeholder="Pick a date"
                    data-testid="edit-input-lodge-checkin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.passengersAdults}
                    onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-lodge-adults"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.passengersChildren}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      set("passengersChildren", count);
                      set("childAges", Array(count).fill(0));
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-lodge-children"
                  />
                </div>
                {form.passengersChildren > 0 && (
                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                    <div className="flex flex-wrap gap-2">
                      {form.childAges.map((age: number, idx: number) => (
                        <Input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const ages = [...form.childAges];
                            ages[idx] = parseInt(e.target.value) || 0;
                            set("childAges", ages);
                          }}
                          className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                          data-testid={`edit-input-lodge-child-age-${idx}`}
                          placeholder={`Child ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Infants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.passengersInfants}
                    onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-lodge-infants"
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">
                      <span className="flex items-center gap-1.5">
                        <PawPrint className="h-3.5 w-3.5" />
                        Pets
                      </span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={form.pets}
                        onCheckedChange={(v) => set("pets", v)}
                        data-testid="edit-switch-pets"
                      />
                      <span className="text-xs text-black/55">{form.pets ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-destination-accommodation">
              <div className="mb-3 text-sm font-semibold">Destination & Accommodation</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Country</Label>
                  <Input
                    placeholder="e.g. United Kingdom"
                    value={form.country}
                    onChange={(e) => set("country", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-country"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Destination</Label>
                  <Input
                    placeholder="e.g. Maldives"
                    value={form.destination}
                    onChange={(e) => set("destination", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-destination"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Resort</Label>
                  <Input
                    placeholder="e.g. North Malé Atoll"
                    value={form.resort}
                    onChange={(e) => set("resort", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-resort"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Accommodation</Label>
                  <SearchableSelect
                    value={form.accommodationId || ""}
                    onValueChange={(v) => set("accommodationId", v)}
                    options={(accommodationsData || []).map((a: any) => ({ value: a.id, label: a.name }))}
                    placeholder="Select accommodation..."
                    searchPlaceholder="Search accommodations..."
                    emptyMessage="No accommodations found."
                    data-testid="edit-select-accommodation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                  <DatePicker
                    value={form.checkInDate}
                    onChange={(v) => set("checkInDate", v)}
                    placeholder="Pick a date"
                    data-testid="edit-input-checkin-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
                  <Input
                    type="time"
                    value={form.checkInTime}
                    onChange={(e) => set("checkInTime", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-checkin-time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.nights}
                    onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-nights"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                  <SearchableSelect
                    value={form.boardBasisId || ""}
                    onValueChange={(v) => set("boardBasisId", v)}
                    options={(boardBasisData || []).map((b: any) => ({ value: b.id, label: b.type }))}
                    placeholder="Select board basis..."
                    searchPlaceholder="Search..."
                    emptyMessage="No options found."
                    data-testid="edit-select-board-basis"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Room Type</Label>
                  <Input
                    placeholder="e.g. Overwater Villa"
                    value={form.roomType}
                    onChange={(e) => set("roomType", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-room-type"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
                  <Select value={form.transferType} onValueChange={(v) => set("transferType", v)}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-transfer-type">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Private Transfer">Private Transfer</SelectItem>
                      <SelectItem value="Shared Transfer">Shared Transfer</SelectItem>
                      <SelectItem value="Seaplane">Seaplane</SelectItem>
                      <SelectItem value="Speedboat">Speedboat</SelectItem>
                      <SelectItem value="Self-drive">Self-drive</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Pre-booked Seats</Label>
                  <Input
                    placeholder="e.g. Extra legroom (row 12)"
                    value={form.preBookedSeats}
                    onChange={(e) => set("preBookedSeats", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-prebooked-seats"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
                  <Input
                    placeholder="e.g. Standard + child meal"
                    value={form.flightMeals}
                    onChange={(e) => set("flightMeals", e.target.value)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-flight-meals"
                  />
                </div>
              </div>
            </div>
          )}

          {form.packageType !== "Hot Tub Break" && !(form.packageType === "Cruise Package" && form.cruiseOnly) && (
            <>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-outbound-flights">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Plane className="h-4 w-4" />
                  Flights — Outbound
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={form.outboundDepartAirportId || ""}
                      onValueChange={(v) => set("outboundDepartAirportId", v)}
                      options={(airportsData || []).map((a: any) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="edit-select-outbound-depart-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={form.outboundDepartDate}
                      onChange={(v) => set("outboundDepartDate", v)}
                      placeholder="Pick a date"
                      data-testid="edit-input-outbound-depart-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={form.outboundDepartTime}
                      onChange={(e) => set("outboundDepartTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-outbound-depart-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={form.outboundArriveAirportId || ""}
                      onValueChange={(v) => set("outboundArriveAirportId", v)}
                      options={(airportsData || []).map((a: any) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="edit-select-outbound-arrive-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={form.outboundArriveDate}
                      onChange={(v) => set("outboundArriveDate", v)}
                      placeholder="Pick a date"
                      data-testid="edit-input-outbound-arrive-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={form.outboundArriveTime}
                      onChange={(e) => set("outboundArriveTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-outbound-arrive-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                    <Input
                      placeholder="e.g. BA123"
                      value={form.outboundFlightNumber}
                      onChange={(e) => set("outboundFlightNumber", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-outbound-flight-number"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="edit-section-inbound-flights">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Plane className="h-4 w-4 rotate-180" />
                  Flights — Inbound
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={form.inboundDepartAirportId || ""}
                      onValueChange={(v) => set("inboundDepartAirportId", v)}
                      options={(airportsData || []).map((a: any) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="edit-select-inbound-depart-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={form.inboundDepartDate}
                      onChange={(v) => set("inboundDepartDate", v)}
                      placeholder="Pick a date"
                      data-testid="edit-input-inbound-depart-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={form.inboundDepartTime}
                      onChange={(e) => set("inboundDepartTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-inbound-depart-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={form.inboundArriveAirportId || ""}
                      onValueChange={(v) => set("inboundArriveAirportId", v)}
                      options={(airportsData || []).map((a: any) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="edit-select-inbound-arrive-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={form.inboundArriveDate}
                      onChange={(v) => set("inboundArriveDate", v)}
                      placeholder="Pick a date"
                      data-testid="edit-input-inbound-arrive-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={form.inboundArriveTime}
                      onChange={(e) => set("inboundArriveTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-inbound-arrive-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                    <Input
                      placeholder="e.g. BA456"
                      value={form.inboundFlightNumber}
                      onChange={(e) => set("inboundFlightNumber", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="edit-input-inbound-flight-number"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Commissions</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                <SearchableSelect
                  value={form.tourOperatorId || ""}
                  onValueChange={(v) => set("tourOperatorId", v)}
                  options={(tourOperatorsData || []).map((t: any) => ({ value: t.id, label: t.name }))}
                  placeholder="Select tour operator..."
                  searchPlaceholder="Search tour operators..."
                  emptyMessage="No tour operators found."
                  data-testid="edit-select-tour-operator"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sales}
                  onChange={(e) => set("sales", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-sales"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.commission}
                  onChange={(e) => set("commission", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-commission"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discount}
                  onChange={(e) => set("discount", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-discount"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.serviceCharge}
                  onChange={(e) => set("serviceCharge", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-service-charge"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.pricePerPerson}
                  onChange={(e) => set("pricePerPerson", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-price-per-person"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="h-9 rounded-2xl border-black/10 px-4"
              onClick={() => onOpenChange(false)}
              data-testid="edit-button-cancel"
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-2xl bg-black px-4 text-white hover:bg-black/90"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="edit-button-save"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizePackageType(raw: string): string {
  const map: Record<string, string> = {
    "Package (Flight + Hotel)": "Package Holiday",
    "Cruise": "Cruise Package",
  };
  return map[raw] || raw;
}

function buildEditForm(quote: QuoteDisplay, quoteData: ApiQuote) {
  const q = quoteData as any;
  const flights = q.flights || [];
  const outboundFlight = flights.find((f: any) => f.flight_type === "outbound") || flights[0];
  const inboundFlight = flights.find((f: any) => f.flight_type === "inbound") || flights[1];
  const accommodations = q.accommodations || [];
  const primaryAccom = accommodations.find((a: any) => a.is_primary) || accommodations[0];

  return {
    packageType: normalizePackageType(quote.packageType),
    quoteTitle: quote.quoteTitle,
    quoteLink: quote.quoteLink,
    status: quote.status,
    travelDate: quote.travelDate,
    passengersAdults: quote.passengers.adults,
    passengersChildren: quote.passengers.children,
    passengersInfants: quote.passengersInfants,
    childAges: [...quote.passengers.childAges],
    country: quote.country,
    destination: quote.destination,
    resort: quote.resort,
    accommodationId: primaryAccom?.accomodation_id || "",
    checkInDate: quote.checkInDate,
    checkInTime: quote.checkInTime,
    nights: quote.nights,
    boardBasisId: primaryAccom?.board_basis_id || "",
    roomType: quote.accommodation.roomType,
    transferType: quote.transferType,
    preBookedSeats: quote.preBookedSeats,
    flightMeals: quote.flightMeals,
    leadSource: quote.leadSource,
    outboundDepartAirportId: outboundFlight?.departing_airport_id || "",
    outboundDepartDate: quote.flights.outbound.departDate,
    outboundDepartTime: quote.flights.outbound.departTime,
    outboundArriveAirportId: outboundFlight?.arrival_airport_id || "",
    outboundArriveDate: quote.flights.outbound.arriveDate,
    outboundArriveTime: quote.flights.outbound.arriveTime,
    outboundFlightNumber: outboundFlight?.flight_number || "",
    inboundDepartAirportId: inboundFlight?.departing_airport_id || "",
    inboundDepartDate: quote.flights.inbound.departDate,
    inboundDepartTime: quote.flights.inbound.departTime,
    inboundArriveAirportId: inboundFlight?.arrival_airport_id || "",
    inboundArriveDate: quote.flights.inbound.arriveDate,
    inboundArriveTime: quote.flights.inbound.arriveTime,
    inboundFlightNumber: inboundFlight?.flight_number || "",
    tourOperatorId: q.main_tour_operator_id || "",
    sales: quote.commissions.agentSplitPercent || 50,
    price: quote.commissions.price,
    commission: quote.commissions.commissionPercent || 0,
    discount: 0,
    serviceCharge: 0,
    pricePerPerson: quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1),
    cruiseTitle: q.cruiseTitle || "",
    cruiseLine: q.cruiseLine || "",
    shipName: q.shipName || "",
    cruiseDate: q.cruiseDate || "",
    cabinType: q.cabinType || "",
    embarkation: q.embarkation || "",
    debarkation: q.debarkation || "",
    cruiseExtras: q.cruiseExtras || "",
    cruiseOnly: q.cruiseOnly || false,
    lodgeCode: q.lodgeCode || "",
    parkName: q.parkName || "",
    pets: q.pets || false,
  };
}
