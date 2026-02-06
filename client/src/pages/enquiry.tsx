import { useCallback, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  ArrowRight,
  Bold,
  Calendar,
  ChevronLeft,
  Globe,
  Hotel,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MapPin,
  MessageSquare,
  Pencil,
  Plane,
  Redo,
  Reply,
  Send,
  SmilePlus,
  Sparkles,
  Star,
  Trash2,
  Undo,
  Users,
  Wallet,
} from "lucide-react";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useEnquiry } from "@/hooks/queries";
import { useEnquiryNotes, enquiryNoteKeys } from "@/hooks/queries/use-enquiry-note-queries";
import { useCreateEnquiryNote, useUpdateEnquiryNote, useDeleteEnquiryNote } from "@/hooks/mutations/use-enquiry-note-mutations";
import { useCreateQuote, useUpdateEnquiry } from "@/hooks/mutations";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TiptapLink from "@tiptap/extension-link";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { EnquiryWizard } from "@/components/enquiry-wizard";
import type { Enquiry } from "@/types/enquiry";
import type { EnquiryNote } from "@shared/schema";

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
      <div className="grid grid-cols-10 gap-0.5 p-2">
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

function EnquiryNoteCard({ note, replies, enquiryId, currentUserName }: { note: EnquiryNote; replies: EnquiryNote[]; enquiryId: string; currentUserName: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const { toast } = useToast();
  const updateMutation = useUpdateEnquiryNote(enquiryId);
  const deleteMutation = useDeleteEnquiryNote(enquiryId);
  const createMutation = useCreateEnquiryNote(enquiryId);

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
    createMutation.mutate({ enquiryId, content: html, authorName: currentUserName, parentId: note.id }, {
      onSuccess: () => { setIsReplying(false); toast({ title: "Reply added" }); },
      onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="group" data-testid={`note-card-${note.id}`}>
      <div className="rounded-xl border border-black/10 bg-white/60 p-2">
        <div className="flex items-start justify-between gap-1.5">
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[8px] font-bold text-[#3b82f6]">{(note.authorName || "A").charAt(0).toUpperCase()}</div>
            <div>
              <span className="text-[11px] font-semibold text-black/80">{note.authorName || "Agent"}</span>
              <span className="ml-1.5 text-[9px] text-black/40">{formatRelativeTime(note.createdAt)}{note.updatedAt && <span className="ml-1 italic">(edited)</span>}</span>
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
            <button type="button" onClick={() => setIsReplying(!isReplying)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Reply"><Reply className="h-2.5 w-2.5" /></button>
            <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-black/5 hover:text-black/70" title="Edit"><Pencil className="h-2.5 w-2.5" /></button>
            <button type="button" onClick={handleDelete} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/40 transition hover:bg-rose-50 hover:text-rose-500" title="Delete"><Trash2 className="h-2.5 w-2.5" /></button>
          </div>
        </div>
        {isEditing ? (
          <div className="mt-1.5"><NoteEditor initialContent={note.content} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact /></div>
        ) : (
          <div className="mt-1 prose prose-sm max-w-none text-[11px] leading-relaxed text-black/70 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: note.content }} data-testid={`note-content-${note.id}`} />
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
                    <EnquiryReplyCard key={reply.id} reply={reply} enquiryId={enquiryId} />
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

function EnquiryReplyCard({ reply, enquiryId }: { reply: EnquiryNote; enquiryId: string }) {
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();
  const updateMutation = useUpdateEnquiryNote(enquiryId);
  const deleteMutation = useDeleteEnquiryNote(enquiryId);
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
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-[8px] font-bold text-emerald-600">{(reply.authorName || "A").charAt(0).toUpperCase()}</div>
          <span className="text-[10px] font-semibold text-black/70">{reply.authorName || "Agent"}</span>
          <span className="text-[9px] text-black/35">{formatRelativeTime(reply.createdAt)}{reply.updatedAt && <span className="ml-1 italic">(edited)</span>}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 transition group-hover/reply:opacity-100">
          <button type="button" onClick={() => setIsEditing(!isEditing)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-black/5 hover:text-black/60"><Pencil className="h-2.5 w-2.5" /></button>
          <button type="button" onClick={() => deleteMutation.mutate(reply.id)} className="inline-flex h-5 w-5 items-center justify-center rounded text-black/35 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-2.5 w-2.5" /></button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-1.5"><NoteEditor initialContent={reply.content} onSubmit={handleEdit} onCancel={() => setIsEditing(false)} submitLabel="Save" isLoading={updateMutation.isPending} compact /></div>
      ) : (
        <div className="mt-1 prose prose-sm max-w-none text-[11px] text-black/60 [&_a]:text-[#3b82f6] [&_ul]:pl-3 [&_ol]:pl-3" dangerouslySetInnerHTML={{ __html: reply.content }} />
      )}
    </div>
  );
}

function EnquiryNotesSection({ enquiryId }: { enquiryId: string }) {
  const { data: notesData, isLoading } = useEnquiryNotes(enquiryId);
  const { data: currentUser } = useCurrentUser();
  const createMutation = useCreateEnquiryNote(enquiryId);
  const { toast } = useToast();
  const authorName = currentUser?.name || "Agent";

  const topLevelNotes = useMemo(() => {
    if (!notesData) return [];
    return notesData.filter((n) => !n.parentId);
  }, [notesData]);

  const repliesByParent = useMemo(() => {
    if (!notesData) return new Map<string, EnquiryNote[]>();
    const map = new Map<string, EnquiryNote[]>();
    notesData.filter((n) => n.parentId).forEach((n) => {
      const existing = map.get(n.parentId!) || [];
      existing.push(n);
      map.set(n.parentId!, existing);
    });
    return map;
  }, [notesData]);

  const handleCreate = (html: string) => {
    createMutation.mutate({ enquiryId, content: html, authorName }, {
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
              <EnquiryNoteCard key={note.id} note={note} replies={repliesByParent.get(note.id) || []} enquiryId={enquiryId} currentUserName={authorName} />
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

export default function EnquiryPage() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/clients/:clientId/enquiries/:enquiryId");
  const clientId = params?.clientId || "";
  const enquiryId = params?.enquiryId || "";
  const { role, setRole } = useRole();

  const { data: enquiry, isLoading } = useEnquiry(enquiryId);
  const { data: currentUser } = useCurrentUser();
  const createQuoteMutation = useCreateQuote();
  const updateEnquiryMutation = useUpdateEnquiry();
  const { toast } = useToast();

  const [showEditWizard, setShowEditWizard] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToQuote = () => {
    if (!enquiry) return;
    setIsConverting(true);

    const quoteData: Record<string, any> = {
      clientId: enquiry.clientId,
      userId: currentUser?.id || enquiry.userId,
      status: "In Play",
      quoteTitle: enquiry.enquiryTitle,
      destination: enquiry.destination || "",
      country: enquiry.country || "",
      resort: enquiry.resort || "",
      travelDate: enquiry.travelDate || new Date().toISOString().split("T")[0],
      returnDate: enquiry.travelDate && enquiry.nights
        ? new Date(new Date(enquiry.travelDate).getTime() + enquiry.nights * 86400000).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      passengersAdults: enquiry.passengersAdults,
      passengersChildren: enquiry.passengersChildren,
      passengersInfants: enquiry.passengersInfants,
      nights: enquiry.nights,
      boardBasis: enquiry.boardBasis || "",
      packageType: enquiry.holidayType || "Package (Flight + Hotel)",
      leadSource: "Enquiry",
    };

    if (enquiry.departureAirport) {
      quoteData.outboundDepartAirport = enquiry.departureAirport;
      quoteData.inboundArriveAirport = enquiry.departureAirport;
    }

    createQuoteMutation.mutate(quoteData as any, {
      onSuccess: (newQuote: any) => {
        updateEnquiryMutation.mutate({ id: enquiry.id, data: { status: "Converted" } });
        toast({ title: "Enquiry converted to quote!" });
        setIsConverting(false);
        navigate(`/clients/${clientId}/quotes/${newQuote.id}`);
      },
      onError: () => {
        toast({ title: "Failed to create quote", variant: "destructive" });
        setIsConverting(false);
      },
    });
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

  const totalPassengers = enquiry.passengersAdults + enquiry.passengersChildren + enquiry.passengersInfants;
  const passengerBreakdown = [
    `${enquiry.passengersAdults} Adult${enquiry.passengersAdults !== 1 ? "s" : ""}`,
    enquiry.passengersChildren > 0 ? `${enquiry.passengersChildren} Child${enquiry.passengersChildren !== 1 ? "ren" : ""}` : null,
    enquiry.passengersInfants > 0 ? `${enquiry.passengersInfants} Infant${enquiry.passengersInfants !== 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ");

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
                <h1 className="truncate text-xl font-bold text-black/90" data-testid="text-enquiry-title">{enquiry.enquiryTitle}</h1>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusColor}`} data-testid="badge-enquiry-status">{enquiry.status}</span>
              </div>
              <div className="mt-0.5 text-xs text-black/50">
                Created {formatUKDate(enquiry.createdAt)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-9 rounded-2xl border-black/10 px-3" onClick={() => setShowEditWizard(true)} data-testid="button-edit-enquiry">
                <Pencil className="mr-2 h-3.5 w-3.5" /> Edit
              </Button>
              {enquiry.status !== "Converted" && (
                <Button size="sm" className="h-9 rounded-2xl bg-black px-4 text-white hover:bg-black/90" onClick={handleConvertToQuote} disabled={isConverting} data-testid="button-convert-to-quote">
                  {isConverting ? <Spinner className="mr-2 h-3.5 w-3.5" /> : <ArrowRight className="mr-2 h-3.5 w-3.5" />}
                  Convert to Quote
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
            <div className="space-y-5">
              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-holiday-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="text-sm font-bold">Holiday Details</div>
                </div>
                <div className="divide-y divide-black/5">
                  <InfoRow icon={Globe} label="Holiday Type" value={enquiry.holidayType} />
                  <InfoRow icon={MapPin} label="Country" value={enquiry.country} />
                  <InfoRow icon={MapPin} label="Destination" value={enquiry.destination} />
                  <InfoRow icon={MapPin} label="Resort" value={enquiry.resort} />
                </div>
              </Card>

              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-travel-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
                    <Plane className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div className="text-sm font-bold">Travel & Passengers</div>
                </div>
                <div className="divide-y divide-black/5">
                  <InfoRow icon={Plane} label="Departure Airport" value={enquiry.departureAirport} />
                  <InfoRow icon={Calendar} label="Travel Date" value={formatUKDate(enquiry.travelDate)} />
                  <InfoRow icon={Calendar} label="Flexibility" value={enquiry.flexibility} />
                  <InfoRow icon={Users} label="Passengers" value={`${totalPassengers} total — ${passengerBreakdown}`} />
                </div>
              </Card>

              <Card className="rounded-3xl border-black/10 bg-white/70 p-5" data-testid="card-accommodation-details">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10">
                    <Hotel className="h-4 w-4 text-amber-600" />
                  </div>
                  <div className="text-sm font-bold">Accommodation & Budget</div>
                </div>
                <div className="divide-y divide-black/5">
                  <InfoRow icon={Calendar} label="Nights" value={enquiry.nights ? `${enquiry.nights} nights` : null} />
                  <InfoRow icon={Star} label="Star Rating" value={enquiry.starRating} />
                  <InfoRow icon={Hotel} label="Board Basis" value={enquiry.boardBasis} />
                  <InfoRow icon={Wallet} label="Budget" value={enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))} ${enquiry.budgetType?.toLowerCase() || ""}` : null} />
                </div>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-enquiry-summary">
                <div className="text-sm font-bold mb-3">Quick Summary</div>
                <div className="space-y-2">
                  {[
                    { label: "Type", value: enquiry.holidayType, color: "bg-blue-500/10 text-blue-700" },
                    { label: "Destination", value: [enquiry.destination, enquiry.country].filter(Boolean).join(", ") || "—" },
                    { label: "Travel Date", value: formatUKDate(enquiry.travelDate) },
                    { label: "Passengers", value: passengerBreakdown },
                    { label: "Duration", value: enquiry.nights ? `${enquiry.nights} nights` : "—" },
                    { label: "Budget", value: enquiry.budget ? `${currency.format(parseFloat(enquiry.budget))} ${enquiry.budgetType?.toLowerCase() || ""}` : "—" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-xl bg-black/[0.02] px-3 py-2">
                      <span className="text-[11px] font-medium text-black/50">{item.label}</span>
                      <span className={cn("text-xs font-semibold text-black/80", item.color)}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <EnquiryNotesSection enquiryId={enquiryId} />
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
    </CommandCenterShell>
  );
}
