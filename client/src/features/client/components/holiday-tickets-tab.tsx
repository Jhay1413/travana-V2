import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Heart, Paperclip, Pencil, Reply as ReplyIcon, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { NoteEditor } from "@/components/shared/note-editor";
import { useToast } from "@/hooks/use-toast";
import { useTicketsByClient, useUsers, useCurrentUser } from "@/hooks/queries";
import { useReplies, useCreateReply, useUpdateReply, useDeleteReply, useToggleReplyLike, type TicketReply } from "@/features/reply";
import { authorBubbleClasses, useToggleTicketLike, useUpdateTicket, ReplyThreadToggle, TicketAttachmentList, type Ticket } from "@/features/tickets";
import { useAttachments, useDeleteAttachment, usePendingAttachments, type TicketAttachment } from "@/features/attachment";

import type { User as ApiUser } from "@/features/user/types";

// ─── Tickets tab ────────────────────────────────────────────────────────────
// Every ticket the client has raised, newest first, rendered as a collapsible
// card whose body is the ticket's thread: the original description as the
// first post, followed by its replies (one level of threading). Visual
// language matches the Notes tab — same rounded card, corner-straddling
// avatar and blue-name/timestamp header — but each post gets an author-keyed
// bubble colour and a Like / Reply / Edit / Delete action row.

function formatNoteDateTime(value: string): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function statusChipClass(status: string): string {
  switch (status) {
    case "Open": return "bg-blue-50 text-blue-700 border-blue-200";
    case "In Progress": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Resolved": return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Closed": return "bg-slate-100 text-slate-600 border-slate-300";
    default: return "bg-slate-100 text-slate-600 border-slate-300";
  }
}

function priorityChipClass(priority: string): string {
  switch (priority) {
    case "Urgent": return "bg-red-50 text-red-700 border-red-200";
    case "High": return "bg-orange-50 text-orange-700 border-orange-200";
    case "Medium": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Low": return "bg-slate-50 text-slate-600 border-slate-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function typeChipClass(type: string): string {
  switch (type) {
    case "Admin": return "bg-violet-100 text-violet-700 border-violet-200";
    case "Build": return "bg-sky-100 text-sky-700 border-sky-200";
    case "Sales": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

// The author's uploaded profile photo (user.image) when they have one,
// otherwise their initial in a blue circle — same treatment as the Notes tab.
function PostAvatar({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  if (imageUrl) {
    return <img src={imageUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#3b82f6]/10 text-sm font-bold text-[#3b82f6]">
      {(name.trim() || "?").charAt(0).toUpperCase()}
    </span>
  );
}

// Either the ticket's own description (post #0, no actions) or one of its
// replies. Modelling both as the same shape keeps the bubble/avatar rendering
// in one place.
interface ThreadPost {
  id: string;
  authorId: string;
  authorName: string;
  authorImage: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
  reply: TicketReply | null; // null for the ticket description
  likeCount: number;
  likedByMe: boolean;
}

function PostBubble({
  post,
  isMe,
  onReply,
  onEdit,
  onLike,
  onDelete,
  isEditing,
  onSaveEdit,
  onCancelEdit,
  isSavingEdit,
  isConfirmingDelete,
  onConfirmDelete,
  onCancelDelete,
  isLiking = false,
  nested = false,
  footer,
  attachments,
  onDeleteAttachment,
  deletingAttachmentId,
}: {
  post: ThreadPost;
  isMe: boolean;
  /** Rendered under a parent comment — gets the thread rail beside it. */
  nested?: boolean;
  /** Rendered under the bubble, inside its column (e.g. the replies toggle). */
  footer?: ReactNode;
  onReply?: () => void;
  onEdit?: () => void;
  onLike?: () => void;
  isLiking?: boolean;
  onDelete?: () => void;
  isEditing?: boolean;
  onSaveEdit?: (html: string) => void;
  onCancelEdit?: () => void;
  isSavingEdit?: boolean;
  isConfirmingDelete?: boolean;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  /** Files posted with this post (ticket-level or reply-level). */
  attachments?: TicketAttachment[];
  /** Present only when the viewer may remove attachments from this post. */
  onDeleteAttachment?: (id: string) => void;
  deletingAttachmentId?: string | null;
}) {
  const colors = authorBubbleClasses(post.authorId, isMe);
  const isEdited = !!post.updatedAt && Date.parse(post.updatedAt) > Date.parse(post.createdAt) + 1000;
  const reply = post.reply;

  return (
    <div className={cn("flex", isMe ? "justify-end" : "justify-start", isMe && !nested && "pr-8")} data-testid={`ticket-reply-${post.id}`}>
      <div className={cn("relative mt-4", nested ? "max-w-full" : "max-w-[75%]")}>
        <div className="absolute -top-4 left-0">
          <PostAvatar name={post.authorName} imageUrl={post.authorImage} />
        </div>
        <div className={cn("rounded-2xl px-4 py-2.5 text-sm", colors.bubble)}>
          <div className="mb-1 flex flex-wrap items-baseline gap-1 pl-6 text-xs">
            <span className={cn("font-semibold", colors.name)}>{post.authorName}</span>
            <span className="text-black/40 dark:text-white/40">
              – {formatNoteDateTime(post.createdAt)}
              {isEdited ? " (edited)" : ""}
            </span>
          </div>
          {isEditing ? (
            <div className="pl-6">
              <NoteEditor
                initialContent={post.content}
                submitLabel="Save"
                compact
                isLoading={isSavingEdit}
                onSubmit={(html) => onSaveEdit?.(html)}
                onCancel={onCancelEdit}
              />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words pl-6 text-[13px] leading-relaxed 3xl:text-sm">
              <RichTextDisplay content={post.content} />
            </div>
          )}
          {!isEditing && attachments && attachments.length > 0 && (
            <div className="pl-6">
              <TicketAttachmentList
                attachments={attachments}
                onDelete={onDeleteAttachment}
                deletingId={deletingAttachmentId}
                compact
              />
            </div>
          )}
          {!isEditing && (
            <div className="mt-1.5 flex items-center gap-3 pl-6 text-black/45 dark:text-white/40">
              {isConfirmingDelete ? (
                <span className="flex items-center gap-1.5 text-[11px]">
                  Confirm delete?
                  <button type="button" onClick={onConfirmDelete} className="font-semibold text-rose-600 hover:underline" data-testid={`ticket-reply-delete-confirm-${post.id}`}>
                    Yes
                  </button>
                  <button type="button" onClick={onCancelDelete} className="font-semibold hover:underline">
                    No
                  </button>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onLike}
                    disabled={isLiking}
                    className={cn(
                      "flex items-center gap-1 text-[11px] font-medium transition hover:text-rose-500",
                      post.likedByMe && "text-rose-500",
                    )}
                    data-testid={`ticket-reply-like-${post.id}`}
                  >
                    <Heart className={cn("h-3.5 w-3.5", post.likedByMe && "fill-current text-rose-500")} />
                    {post.likeCount > 0 ? post.likeCount : null}
                  </button>
                  <button
                    type="button"
                    onClick={onReply}
                    className="flex items-center gap-1 text-[11px] font-medium transition hover:text-black dark:hover:text-white"
                    data-testid={`ticket-reply-reply-${post.id}`}
                  >
                    <ReplyIcon className="h-3.5 w-3.5" /> Reply
                  </button>
                  {isMe && (
                    <>
                      <button
                        type="button"
                        onClick={onEdit}
                        className="flex items-center gap-1 text-[11px] font-medium transition hover:text-black dark:hover:text-white"
                        data-testid={`ticket-reply-edit-${post.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      {/* The ticket itself is deleted from its own menu, not here. */}
                      {reply && (
                      <button
                        type="button"
                        onClick={onDelete}
                        className="flex items-center gap-1 text-[11px] font-medium transition hover:text-rose-600"
                        data-testid={`ticket-reply-delete-${post.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </div>
        {footer}
      </div>
    </div>
  );
}

interface ReplyTarget {
  authorName: string;
  parentReplyId?: string;
}

function HolidayTicketThread({ ticket }: { ticket: Ticket }) {
  const { toast } = useToast();
  const { data: users = [] } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const { data: replies, isLoading } = useReplies(ticket.id);

  const createReply = useCreateReply(ticket.id);
  const updateReply = useUpdateReply(ticket.id);
  const deleteReply = useDeleteReply(ticket.id);
  const toggleLike = useToggleReplyLike(ticket.id);
  const toggleTicketLike = useToggleTicketLike();
  const updateTicket = useUpdateTicket();
  const { data: attachments } = useAttachments(ticket.id);
  const deleteAttachment = useDeleteAttachment(ticket.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { files: pendingFiles, addFiles, removeFile, uploadAll } = usePendingAttachments();

  const [replyingTo, setReplyingTo] = useState<ReplyTarget | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedReplies, setCollapsedReplies] = useState<Set<string>>(new Set());
  const toggleReplies = (id: string) =>
    setCollapsedReplies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const usersById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const userName = (userId: string, fallback?: string | null) =>
    fallback || usersById.get(userId)?.name || "Unknown";
  const userImage = (userId: string) => usersById.get(userId)?.image ?? null;

  const toPost = (reply: TicketReply): ThreadPost => ({
    id: reply.id,
    authorId: reply.userId,
    authorName: userName(reply.userId),
    authorImage: userImage(reply.userId),
    content: reply.content,
    createdAt: reply.createdAt,
    updatedAt: reply.updatedAt,
    reply,
    likeCount: reply.likeCount,
    likedByMe: reply.likedByMe,
  });

  // One level of threading. A reply whose parent is missing (deleted, or
  // from before parents were tracked) is promoted to top level rather than
  // hidden. The server already flattens deeper replies onto the top-level
  // parent, so children never have children of their own.
  const { topLevel, topLevelIds, childrenByParent } = useMemo(() => {
    const all = replies ?? [];
    const byTime = (a: TicketReply, b: TicketReply) => Date.parse(a.createdAt) - Date.parse(b.createdAt);
    const ids = new Set(all.map((r) => r.id));
    const topLevelIds = new Set(all.filter((r) => !r.parentReplyId || !ids.has(r.parentReplyId)).map((r) => r.id));
    const topLevel = all.filter((r) => topLevelIds.has(r.id)).sort(byTime);
    const childrenByParent = new Map<string, TicketReply[]>();
    for (const r of all) {
      if (topLevelIds.has(r.id) || !r.parentReplyId) continue;
      const list = childrenByParent.get(r.parentReplyId) ?? [];
      list.push(r);
      childrenByParent.set(r.parentReplyId, list);
    }
    childrenByParent.forEach((list) => list.sort(byTime));
    return { topLevel, topLevelIds, childrenByParent };
  }, [replies]);

  const descriptionPost: ThreadPost | null = ticket.description
    ? {
        id: `desc-${ticket.id}`,
        authorId: ticket.userId,
        authorName: userName(ticket.userId, ticket.userName),
        authorImage: userImage(ticket.userId),
        content: ticket.description,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        reply: null,
        likeCount: ticket.likeCount ?? 0,
        likedByMe: !!ticket.likedByMe,
      }
    : null;

  const isMine = (userId: string) => !!currentUser?.id && currentUser.id === userId;

  // Attachments grouped by the reply they were posted with — null groups the
  // ticket-level ones under the description post.
  const attachmentsByReply = useMemo(() => {
    const map = new Map<string | null, TicketAttachment[]>();
    for (const a of attachments ?? []) {
      const list = map.get(a.replyId) ?? [];
      list.push(a);
      map.set(a.replyId, list);
    }
    return map;
  }, [attachments]);

  const attachmentsFor = (post: ThreadPost): TicketAttachment[] =>
    attachmentsByReply.get(post.reply ? post.reply.id : null) ?? [];

  // A reply's author may remove its attachments; the ticket-level ones may
  // only be removed by whoever raised the ticket.
  const canDeleteAttachmentsFor = (post: ThreadPost): boolean =>
    post.reply ? isMine(post.reply.userId) : isMine(ticket.userId);

  const onDeleteAttachmentFor = (post: ThreadPost) =>
    canDeleteAttachmentsFor(post)
      ? (id: string) =>
          deleteAttachment.mutate(id, {
            onError: () => toast({ title: "Failed to delete attachment", variant: "destructive" }),
          })
      : undefined;

  const deletingAttachmentId = deleteAttachment.isPending ? (deleteAttachment.variables ?? null) : null;

  const replyToTopLevel = (reply: TicketReply): string =>
    topLevelIds.has(reply.id) ? reply.id : (reply.parentReplyId as string);

  // The description post is the ticket itself: it likes and edits through the
  // ticket endpoints, everything else through the reply ones.
  const handleLike = (post: ThreadPost) => {
    const onError = () => toast({ title: "Failed to update like", variant: "destructive" });
    if (post.reply) toggleLike.mutate(post.reply.id, { onError });
    else toggleTicketLike.mutate(ticket.id, { onError });
  };

  const handleSaveEdit = (post: ThreadPost, html: string) => {
    const onSuccess = () => setEditingId(null);
    if (post.reply) {
      updateReply.mutate(
        { id: post.reply.id, content: html },
        { onSuccess, onError: () => toast({ title: "Failed to update reply", variant: "destructive" }) },
      );
    } else {
      updateTicket.mutate(
        { id: ticket.id, data: { description: html } },
        { onSuccess, onError: () => toast({ title: "Failed to update ticket", variant: "destructive" }) },
      );
    }
  };

  const isLikingPost = (post: ThreadPost) =>
    post.reply
      ? toggleLike.isPending && toggleLike.variables === post.reply.id
      : toggleTicketLike.isPending && toggleTicketLike.variables === ticket.id;
  const isSavingPost = (post: ThreadPost) => (post.reply ? updateReply.isPending : updateTicket.isPending);

  const handleDelete = (id: string) => {
    deleteReply.mutate(id, {
      onSuccess: () => setConfirmDeleteId(null),
      onError: () => toast({ title: "Failed to delete reply", variant: "destructive" }),
    });
  };

  const handleComposerSubmit = (html: string) => {
    if (!currentUser?.id) {
      toast({ title: "Please wait while loading user data", variant: "destructive" });
      return;
    }
    createReply.mutate(
      { userId: currentUser.id, content: html, parentReplyId: replyingTo?.parentReplyId },
      {
        onSuccess: async (reply) => {
          setReplyingTo(null);
          if (pendingFiles.length > 0) {
            const { failed } = await uploadAll(ticket.id, reply.id);
            if (failed > 0) {
              toast({ title: `${failed} attachment(s) failed to upload`, variant: "destructive" });
            }
          }
        },
        onError: () => toast({ title: "Failed to add reply", variant: "destructive" }),
      },
    );
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderPost = (post: ThreadPost, nested = false, footer?: ReactNode) => (
    <div key={post.id}>
      <PostBubble
        post={post}
        nested={nested}
        footer={footer}
        isMe={isMine(post.authorId)}
        attachments={attachmentsFor(post)}
        onDeleteAttachment={onDeleteAttachmentFor(post)}
        deletingAttachmentId={deletingAttachmentId}
        onReply={
          post.reply
            ? () => setReplyingTo({ authorName: post.authorName, parentReplyId: replyToTopLevel(post.reply!) })
            : () => setReplyingTo({ authorName: post.authorName, parentReplyId: undefined })
        }
        onEdit={() => setEditingId(post.id)}
        onLike={() => handleLike(post)}
        isLiking={isLikingPost(post)}
        onDelete={() => setConfirmDeleteId(post.id)}
        isEditing={editingId === post.id}
        onSaveEdit={(html) => handleSaveEdit(post, html)}
        onCancelEdit={() => setEditingId(null)}
        isSavingEdit={isSavingPost(post)}
        isConfirmingDelete={confirmDeleteId === post.id}
        onConfirmDelete={() => handleDelete(post.id)}
        onCancelDelete={() => setConfirmDeleteId(null)}
      />
    </div>
  );

  return (
    <div className="space-y-4 border-t border-black/[0.06] px-2 pb-4 pt-5">
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner className="h-5 w-5" />
        </div>
      ) : (
        <div className="space-y-4">
          {descriptionPost && renderPost(descriptionPost)}
          {topLevel.map((reply) => (
            <div key={reply.id} className="flex flex-col space-y-3">
              {renderPost(
                toPost(reply),
                false,
                (childrenByParent.get(reply.id) ?? []).length > 0 ? (
                  <ReplyThreadToggle
                    count={(childrenByParent.get(reply.id) ?? []).length}
                    collapsed={collapsedReplies.has(reply.id)}
                    onToggle={() => toggleReplies(reply.id)}
                    data-testid={`ticket-reply-replies-toggle-${reply.id}`}
                  />
                ) : undefined,
              )}
              {(childrenByParent.get(reply.id) ?? []).length > 0 && !collapsedReplies.has(reply.id) && (
                <div
                  className={cn(
                    "flex w-fit max-w-[88%] flex-col space-y-3 border-l-2 border-black/[0.08] pl-4 dark:border-white/10",
                    isMine(reply.userId) ? "self-end" : "self-start ml-2",
                  )}
                >
                  {(childrenByParent.get(reply.id) ?? []).map((child) => renderPost(toPost(child), true))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 rounded-xl bg-black/[0.02] p-2" data-testid={`ticket-reply-composer-${ticket.id}`}>
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-1.5 text-xs text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
            <span>
              Replying to <strong>{replyingTo.authorName}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-auto text-sky-600 hover:text-sky-800 dark:text-sky-400"
              data-testid="ticket-reply-cancel-reply-to"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <NoteEditor
          key={replyingTo?.parentReplyId ?? "top-level"}
          placeholder="Write a reply…"
          submitLabel="Reply"
          compact
          isLoading={createReply.isPending}
          onSubmit={handleComposerSubmit}
        />
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="ticket-reply-attach-input"
          />
          <button
            type="button"
            title="Attach files"
            onClick={() => fileInputRef.current?.click()}
            className="grid h-7 w-7 place-items-center rounded-md text-black/45 transition hover:bg-black/5 hover:text-black dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
            data-testid="ticket-reply-attach"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pendingFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1.5 rounded-lg bg-black/[0.04] px-2 py-1 text-xs dark:bg-white/10"
                  data-testid={`ticket-reply-pending-${index}`}
                >
                  <Paperclip className="h-3 w-3 text-black/40 dark:text-white/40" />
                  <span className="max-w-[140px] truncate text-black/70 dark:text-white/70">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-black/30 hover:text-rose-600 dark:text-white/30"
                    aria-label="Remove attachment"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketCard({
  ticket,
  isOpen,
  onToggle,
  scopedLabel,
  users,
}: {
  ticket: Ticket;
  isOpen: boolean;
  onToggle: () => void;
  /** "This booking" / "This quote" / "This enquiry" when the ticket is linked to the holiday being viewed. */
  scopedLabel: string | null;
  users: ApiUser[];
}) {
  const assigneeName = ticket.assignedToName || users.find((u) => u.id === ticket.assignedTo)?.name || "Unassigned";
  return (
    <div className="rounded-2xl border border-black/10 bg-white" data-testid={`holiday-ticket-${ticket.id}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        data-testid={`holiday-ticket-toggle-${ticket.id}`}
      >
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-black/40 transition-transform", isOpen && "rotate-180")} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13px] font-medium text-black/85">{ticket.subject}</span>
            {scopedLabel && (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">{scopedLabel}</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", typeChipClass(ticket.type))}>
              {ticket.type}
            </span>
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", statusChipClass(ticket.status))}>
              {ticket.status}
            </span>
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold", priorityChipClass(ticket.priority))}>
              {ticket.priority}
            </span>
            <span className="text-[11px] text-black/40">Assigned to {assigneeName}</span>
            <span className="text-[11px] text-black/40">
              · {new Date(ticket.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>
        </div>
      </button>
      {isOpen && <HolidayTicketThread ticket={ticket} />}
    </div>
  );
}

export function HolidayTicketsTab({
  clientId,
  entityType,
  transactionId,
}: {
  clientId: string;
  entityId: string;
  entityType: "enquiry" | "quote" | "booking";
  transactionId: string | null | undefined;
}) {
  const { data: ticketsData, isLoading } = useTicketsByClient(clientId);
  const { data: users = [] } = useUsers();
  const [openOverrides, setOpenOverrides] = useState<Record<string, boolean>>({});

  // Tickets linked to the holiday's transaction are listed first and flagged.
  const isScoped = useCallback((t: Ticket) => !!transactionId && t.transactionId === transactionId, [transactionId]);

  const sortedTickets = useMemo(() => {
    const all = [...(ticketsData ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const scoped = all.filter(isScoped);
    const rest = all.filter((t) => !isScoped(t));
    return [...scoped, ...rest];
  }, [ticketsData, isScoped]);

  // The newest ticket starts open. Pinned to its id (not its index) so a
  // re-sort doesn't silently swap which card is expanded.
  const [defaultOpenId, setDefaultOpenId] = useState<string | null>(null);
  const firstId = sortedTickets[0]?.id ?? null;
  if (defaultOpenId === null && firstId !== null) setDefaultOpenId(firstId);
  const isTicketOpen = (id: string) => openOverrides[id] ?? id === defaultOpenId;

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }
  if (sortedTickets.length === 0) {
    return <p className="py-8 text-center text-[13px] text-black/40">No tickets yet.</p>;
  }

  return (
    <div className="space-y-3" data-testid="holiday-detail-tickets">
      {sortedTickets.map((ticket) => {
        return (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            isOpen={isTicketOpen(ticket.id)}
            onToggle={() =>
              setOpenOverrides((prev) => ({ ...prev, [ticket.id]: !(prev[ticket.id] ?? ticket.id === defaultOpenId) }))
            }
            scopedLabel={
              isScoped(ticket)
                ? entityType === "booking"
                  ? "This booking"
                  : entityType === "quote"
                    ? "This quote"
                    : "This enquiry"
                : null
            }
            users={users}
          />
        );
      })}
    </div>
  );
}
