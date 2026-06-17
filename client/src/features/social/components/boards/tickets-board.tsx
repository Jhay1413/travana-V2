import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  ChevronDown,
  Clock,
  Edit2,
  FileText,
  Filter,
  Image,
  LifeBuoy,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  Search,
  Send,
  Tag,
  Trash2,
  Upload,
  User,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useTickets,
  useNeonClients,
  useUsers,
  useCurrentUser,
  useAttachments,
  useReplies,
  getAttachmentDownloadUrl,
} from "@/hooks/queries";
import {
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
  useUploadAttachment,
  useDeleteAttachment,
  useCreateReply,
  useUpdateReply,
  useDeleteReply,
} from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { attachmentApi } from "@/api";
import { RichTextEditor, RichTextDisplay } from "@/components/shared/rich-text-editor";
import type { Ticket } from "@/features/tickets/types";
import type { TicketReply } from "@/features/reply/types";
import type { User as ApiUser } from "@/features/user/types";

const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateString);
}

function priorityDotColor(priority: string) {
  switch (priority) {
    case "Urgent": return "bg-red-500";
    case "High": return "bg-orange-500";
    case "Medium": return "bg-yellow-500";
    case "Low": return "bg-blue-400";
    default: return "bg-slate-400";
  }
}

function statusStyle(status: string) {
  switch (status) {
    case "Open": return { dot: "bg-blue-500", bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case "In Progress": return { dot: "bg-amber-500", bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    case "Resolved": return { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case "Closed": return { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" };
    default: return { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300" };
  }
}

function priorityPillStyle(priority: string) {
  switch (priority) {
    case "Urgent": return "bg-red-50 text-red-700 border-red-200";
    case "High": return "bg-orange-50 text-orange-700 border-orange-200";
    case "Medium": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Low": return "bg-slate-50 text-slate-600 border-slate-200";
    default: return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function typeBadgeStyle(type: string) {
  switch (type) {
    case "Admin": return "bg-violet-100 text-violet-700 border-violet-200";
    case "Build": return "bg-sky-100 text-sky-700 border-sky-200";
    case "Sales": return "bg-emerald-100 text-emerald-700 border-emerald-200";
    default: return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function TicketRepliesSection({
  ticketId,
  users,
  onImageClick,
}: {
  ticketId: string;
  users: ApiUser[];
  onImageClick?: (img: { url: string; name: string }) => void;
}) {
  const [replyContent, setReplyContent] = useState("");
  const [editingReply, setEditingReply] = useState<TicketReply | null>(null);
  const [editContent, setEditContent] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<TicketReply | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const uploadAttachmentMutation = useUploadAttachment();
  const { data: currentUser } = useCurrentUser();
  const { data: replies, isLoading } = useReplies(ticketId);

  const createReplyMutation = useCreateReply(ticketId);
  const createMutation = {
    mutate: ({ content, parentReplyId }: { content: string; parentReplyId?: string }) => {
      createReplyMutation.mutate(
        { userId: currentUser?.id || "", content, parentReplyId },
        {
          onSuccess: () => { setReplyContent(""); setReplyingTo(null); toast({ title: "Reply added" }); },
          onError: () => { toast({ title: "Failed to add reply", variant: "destructive" }); },
        },
      );
    },
    isPending: createReplyMutation.isPending,
  };

  const updateReplyMutation = useUpdateReply(ticketId);
  const updateMutation = {
    mutate: ({ id, content }: { id: string; content: string }) => {
      updateReplyMutation.mutate(
        { id, content },
        {
          onSuccess: () => { setEditingReply(null); toast({ title: "Reply updated" }); },
          onError: () => { toast({ title: "Failed to update reply", variant: "destructive" }); },
        },
      );
    },
    isPending: updateReplyMutation.isPending,
  };

  const deleteReplyMutation = useDeleteReply(ticketId);
  const deleteMutation = {
    mutate: (id: string) => {
      deleteReplyMutation.mutate(id, {
        onSuccess: () => { toast({ title: "Reply deleted" }); },
        onError: () => { toast({ title: "Failed to delete reply", variant: "destructive" }); },
      });
    },
  };

  const getUserName = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    return user?.name || "Unknown";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    const validFiles: File[] = [];
    for (const file of Array.from(files)) {
      if (!allowedTypes.includes(file.type)) {
        toast({ title: `${file.name} is not allowed. Only images and PDFs are accepted.`, variant: "destructive" });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: `${file.name} is too large. Maximum size is 10MB.`, variant: "destructive" });
        continue;
      }
      validFiles.push(file);
    }
    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if ((!replyContent.trim() || replyContent === "<p></p>") && pendingFiles.length === 0) return;
    if (!currentUser?.id) {
      toast({ title: "Please wait while loading user data", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      for (const file of pendingFiles) {
        await uploadAttachmentMutation.mutateAsync({ ticketId, file });
      }
      if (replyContent.trim() && replyContent !== "<p></p>") {
        createMutation.mutate({ content: replyContent, parentReplyId: replyingTo?.id });
      } else if (pendingFiles.length > 0) {
        toast({ title: "Attachments uploaded" });
      }
      setPendingFiles([]);
    } catch {
      toast({ title: "Failed to upload attachments", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (reply: TicketReply) => {
    setEditingReply(reply);
    setEditContent(reply.content);
  };

  const handleSaveEdit = () => {
    if (!editingReply || !editContent.trim()) return;
    updateMutation.mutate({ id: editingReply.id, content: editContent });
  };

  const topLevelReplies = replies?.filter(r => !r.parentReplyId) || [];
  const childReplies = replies?.filter(r => r.parentReplyId) || [];
  const getChildReplies = (parentId: string) => childReplies.filter(r => r.parentReplyId === parentId);

  const renderReply = (reply: TicketReply, isNested = false) => {
    const userName = getUserName(reply.userId);
    return (
      <div key={reply.id} className={`flex gap-3 ${isNested ? "ml-10" : ""}`} data-testid={`reply-${reply.id}`}>
        <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex-none flex items-center justify-center text-[10px] font-bold mt-0.5">
          {getInitials(userName)}
        </div>
        <div className="flex-1 bg-white p-3.5 rounded-lg rounded-tl-none border border-slate-200 shadow-sm relative">
          <div className="absolute top-3 -left-[7px] w-[10px] h-[10px] bg-white border-l border-b border-slate-200 transform rotate-45" />
          {editingReply?.id === reply.id ? (
            <div className="space-y-3">
              <RichTextEditor content={editContent} onChange={setEditContent} placeholder="Edit your reply..." />
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditingReply(null)} data-testid="button-cancel-edit-reply">Cancel</Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={updateMutation.isPending} data-testid="button-save-edit-reply">
                  {updateMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="font-semibold text-sm text-slate-900">{userName}</span>
                <span className="text-[11px] text-slate-400">{formatDateTime(reply.createdAt)}</span>
              </div>
              <RichTextDisplay content={reply.content} />
              <div className="flex items-center gap-1 mt-2">
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-blue-600 px-1.5 py-0.5 rounded flex items-center gap-1"
                  onClick={() => setReplyingTo(reply)}
                  data-testid={`button-reply-to-${reply.id}`}
                >
                  <MessageCircle className="h-3 w-3" /> Reply
                </button>
                {currentUser?.id === reply.userId && (
                  <>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-0.5 rounded"
                      onClick={() => handleEdit(reply)}
                      data-testid={`button-edit-reply-${reply.id}`}
                    >
                      <Edit2 className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-red-600 px-1.5 py-0.5 rounded"
                      onClick={() => deleteMutation.mutate(reply.id)}
                      data-testid={`button-delete-reply-${reply.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div>
        <h3 className="text-xs font-semibold text-slate-500 mb-4 uppercase tracking-wider flex items-center gap-1.5">
          <MessageCircle className="w-3.5 h-3.5" />
          Activity
          {replies?.length ? (
            <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px] font-bold ml-0.5">{replies.length}</span>
          ) : null}
        </h3>
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner /></div>
          ) : !replies?.length ? (
            <div className="text-center py-6 bg-white border border-dashed border-slate-200 rounded-lg">
              <MessageCircle className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <p className="text-sm text-slate-400">No activity yet</p>
            </div>
          ) : (
            topLevelReplies.map((reply) => (
              <div key={reply.id} className="space-y-3">
                {renderReply(reply)}
                {getChildReplies(reply.id).map((childReply) => renderReply(childReply, true))}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="flex-none bg-white border-t border-slate-200 p-4">
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm mb-2">
            <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-blue-800">
              Replying to <strong>{getUserName(replyingTo.userId)}</strong>
            </span>
            <button type="button" onClick={() => setReplyingTo(null)} className="ml-auto text-blue-600 hover:text-blue-800" data-testid="button-cancel-reply-to">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 bg-slate-50 rounded-lg border border-slate-200 p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition-all">
          <div className="flex-1">
            <RichTextEditor
              content={replyContent}
              onChange={setReplyContent}
              placeholder={replyingTo ? `Reply to ${getUserName(replyingTo.userId)}...` : "Type a reply..."}
            />
          </div>
          <div className="flex gap-1 pb-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-reply-attachment"
            />
            <button
              type="button"
              className="p-2 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-attach-file"
            >
              <Paperclip className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`p-2 rounded-md transition-colors ${
                (replyContent.trim() && replyContent !== "<p></p>") || pendingFiles.length > 0
                  ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
              onClick={handleSubmit}
              disabled={uploading || createMutation.isPending || ((!replyContent.trim() || replyContent === "<p></p>") && pendingFiles.length === 0)}
              data-testid="button-send-reply"
            >
              {uploading || createMutation.isPending ? <Spinner className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {pendingFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-slate-100 rounded-lg px-2 py-1 text-sm">
                <Paperclip className="h-3 w-3 text-slate-500" />
                <span className="max-w-[150px] truncate text-slate-700">{file.name}</span>
                <button type="button" onClick={() => removePendingFile(index)} className="text-slate-400 hover:text-red-500" data-testid={`button-remove-file-${index}`}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function TicketDetailPanel({
  ticket,
  users,
  onClose,
  onAfterDelete,
}: {
  ticket: Ticket;
  users: ApiUser[];
  onClose?: () => void;
  onAfterDelete?: () => void;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    status: "",
    priority: "",
    subject: "",
    description: "",
    assignedTo: "",
  });
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  const { data: attachments } = useAttachments(ticket.id, { enabled: !!ticket.id });
  const uploadMutation = useUploadAttachment();
  const deleteAttachmentMutation = useDeleteAttachment(ticket.id);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const [ticketUploading, setTicketUploading] = useState(false);

  const updateTicketMutation = useUpdateTicket();
  const deleteTicketMutation = useDeleteTicket();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setStatusDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setIsEditing(false);
    setStatusDropdownOpen(false);
  }, [ticket.id]);

  const handleStatusChange = (newStatus: string) => {
    setStatusDropdownOpen(false);
    updateTicketMutation.mutate(
      { id: ticket.id, data: { status: newStatus } },
      {
        onSuccess: () => toast({ title: `Status updated to ${newStatus}` }),
        onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
      },
    );
  };

  const handleStartEdit = () => {
    setFormData({
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description || "",
      assignedTo: ticket.assignedTo || ticket.userId || "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateTicketMutation.mutate(
      {
        id: ticket.id,
        data: {
          type: formData.type,
          status: formData.status,
          priority: formData.priority,
          subject: formData.subject,
          description: formData.description || null,
          assignedTo: formData.assignedTo || undefined,
        },
      },
      {
        onSuccess: () => { setIsEditing(false); toast({ title: "Ticket updated" }); },
        onError: () => toast({ title: "Failed to update ticket", variant: "destructive" }),
      },
    );
  };

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    deleteTicketMutation.mutate(ticket.id, {
      onSuccess: () => {
        toast({ title: "Ticket deleted" });
        if (onClose) onClose();
        if (onAfterDelete) {
          onAfterDelete();
        } else {
          navigate("/tickets");
        }
      },
      onError: () => toast({ title: "Failed to delete ticket", variant: "destructive" }),
    });
  };

  const handleTicketFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setTicketUploading(true);
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    try {
      for (const file of Array.from(files)) {
        if (!allowedTypes.includes(file.type)) { toast({ title: `${file.name}: Only images and PDFs allowed`, variant: "destructive" }); continue; }
        if (file.size > 10 * 1024 * 1024) { toast({ title: `${file.name}: File too large (max 10MB)`, variant: "destructive" }); continue; }
        await uploadMutation.mutateAsync({ ticketId: ticket.id, file });
      }
      toast({ title: "Files uploaded" });
    } catch { toast({ title: "Failed to upload files", variant: "destructive" }); }
    finally { setTicketUploading(false); if (ticketFileInputRef.current) ticketFileInputRef.current.value = ""; }
  };

  const getClientName = () => ticket?.clientName?.trim() || "Unknown Client";
  const getUserName = (userId: string) => {
    if (ticket?.userName && userId === ticket.userId) return ticket.userName;
    const user = users?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  };

  const ss = statusStyle(ticket.status);
  const assignedName = ticket.assignedTo ? getUserName(ticket.assignedTo) : getUserName(ticket.userId);
  const clientName = getClientName();

  return (
    <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden" data-testid={`detail-ticket-${ticket.id}`}>
      {isEditing ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-slate-900">Edit Ticket</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} data-testid="button-cancel-edit">Cancel</Button>
                <Button size="sm" onClick={handleSave} disabled={updateTicketMutation.isPending} data-testid="button-save-ticket">
                  {updateTicketMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} data-testid="input-edit-subject" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label>Type</Label>
                  <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                    <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                    <SelectTrigger data-testid="select-edit-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Assigned To</Label>
                <Select value={formData.assignedTo} onValueChange={(v) => setFormData({ ...formData, assignedTo: v })}>
                  <SelectTrigger data-testid="select-edit-assigned-to"><SelectValue placeholder="Select user" /></SelectTrigger>
                  <SelectContent>{users?.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <RichTextEditor content={formData.description ?? ""} onChange={(html) => setFormData({ ...formData, description: html })} placeholder="Detailed description of the ticket" data-testid="input-edit-description" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-none bg-white border-b border-slate-200 shadow-sm z-10">
            <div className="px-6 pt-5 pb-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 mb-1">
                    <span className="text-xs font-mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">TKT-{String(ticket.id).slice(-4).padStart(4, "0")}</span>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${typeBadgeStyle(ticket.type)}`}>{ticket.type}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 leading-tight" data-testid="text-ticket-subject">{ticket.subject}</h2>
                </div>
                <div className="flex items-center gap-1 flex-none">
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                    title="Edit"
                    onClick={handleStartEdit}
                    data-testid="button-edit-ticket"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                    onClick={handleDelete}
                    data-testid="button-delete-ticket"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div className="relative" ref={statusRef}>
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                      className={`flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg text-sm font-medium border cursor-pointer transition-all hover:shadow-sm ${ss.bg} ${ss.text} ${ss.border}`}
                      data-testid="button-status-dropdown"
                    >
                      <div className={`w-2 h-2 rounded-full ${ss.dot}`} />
                      <span>{ticket.status}</span>
                      <ChevronDown className="w-3.5 h-3.5 opacity-60" />
                    </button>
                    {statusDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1.5 w-48 bg-white rounded-xl border border-slate-200 shadow-xl z-50 py-1.5 overflow-hidden">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Update Status</div>
                        {(["Open", "In Progress", "Resolved"] as const).map((s) => {
                          const sty = statusStyle(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleStatusChange(s)}
                              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:${sty.bg} transition-colors ${ticket.status === s ? "bg-slate-50 font-medium" : ""}`}
                              data-testid={`button-status-${s.toLowerCase().replace(" ", "-")}`}
                            >
                              <div className={`w-2 h-2 rounded-full ${sty.dot}`} />
                              {s}
                            </button>
                          );
                        })}
                        <div className="border-t border-slate-100 my-1" />
                        <button
                          type="button"
                          onClick={() => handleStatusChange("Closed")}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors ${ticket.status === "Closed" ? "bg-slate-50 font-medium" : ""}`}
                          data-testid="button-status-closed"
                        >
                          <div className="w-2 h-2 rounded-full bg-slate-400" />
                          Close Ticket
                        </button>
                      </div>
                    )}
                  </div>

                  <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${priorityPillStyle(ticket.priority)}`}>
                    <Zap className="w-3.5 h-3.5" />
                    {ticket.priority}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    {timeAgo(ticket.createdAt)}
                  </span>
                  {(ticket.replyCount ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5" />
                      {ticket.replyCount} {ticket.replyCount === 1 ? "reply" : "replies"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center gap-8 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-medium">Client</span>
                {ticket.clientId ? (
                  <Link href={`/clients/${ticket.clientId}`} className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200 hover:border-blue-300 transition-colors cursor-pointer" data-testid="link-ticket-client">
                    <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">{getInitials(clientName)}</div>
                    <span className="font-medium text-slate-800 text-xs">{clientName}</span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                    <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-bold">{getInitials(clientName)}</div>
                    <span className="font-medium text-slate-800 text-xs">{clientName}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-medium">Assigned</span>
                <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">{getInitials(assignedName)}</div>
                  <span className="font-medium text-slate-800 text-xs">{assignedName}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs font-medium">Created</span>
                <span className="font-medium text-slate-700 text-xs">{formatDate(ticket.createdAt)}</span>
              </div>
              {ticket.dueDate && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs font-medium">Due</span>
                  <span className={cn("font-medium text-xs", new Date(ticket.dueDate) < new Date() && ticket.status !== "Resolved" ? "text-red-600" : "text-slate-700")}>{formatDate(ticket.dueDate)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {ticket.description && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  Description
                </h3>
                <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed" data-testid="text-ticket-description">
                  <RichTextDisplay content={ticket.description} />
                </div>
              </div>
            )}

            {attachments && attachments.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 mb-2.5 uppercase tracking-wider flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5" />
                  Attachments ({attachments.length})
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {attachments.filter(a => isImageType(a.mimeType)).map((attachment) => (
                    <div key={attachment.id} className="group relative rounded-lg overflow-hidden border border-slate-200 bg-white" data-testid={`inline-attachment-${attachment.id}`}>
                      <button type="button" className="block w-full cursor-pointer relative h-32" onClick={() => setLightboxImage({ url: getAttachmentDownloadUrl(attachment.id), name: attachment.originalName })} data-testid={`button-lightbox-attachment-${attachment.id}`}>
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
                          <FileText className="w-8 h-8" />
                        </div>
                        <img
                          src={getAttachmentDownloadUrl(attachment.id)}
                          alt={attachment.originalName}
                          className="relative w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      </button>
                      <div className="p-2 flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-slate-600 truncate">{attachment.originalName}</p>
                          <p className="text-[10px] text-slate-400">{formatFileSize(attachment.size)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600" onClick={() => deleteAttachmentMutation.mutate(attachment.id)} data-testid={`button-delete-inline-attachment-${attachment.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {attachments.filter(a => !isImageType(a.mimeType)).length > 0 && (
                  <div className="space-y-2 mt-3">
                    {attachments.filter(a => !isImageType(a.mimeType)).map((attachment) => (
                      <div key={attachment.id} className="group flex items-center gap-3 p-3 rounded-lg border border-slate-200 bg-white" data-testid={`inline-attachment-${attachment.id}`}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-50 flex-shrink-0"><FileText className="h-5 w-5 text-red-600" /></div>
                        <div className="flex-1 min-w-0">
                          <a href={getAttachmentDownloadUrl(attachment.id)} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-slate-700 hover:text-slate-900 truncate block">{attachment.originalName}</a>
                          <p className="text-xs text-slate-400">{formatFileSize(attachment.size)}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600" onClick={() => deleteAttachmentMutation.mutate(attachment.id)} data-testid={`button-delete-inline-file-${attachment.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <input ref={ticketFileInputRef} type="file" accept="image/*,.pdf" multiple onChange={handleTicketFileUpload} className="hidden" data-testid="input-ticket-file-upload" />
              <Button variant="outline" size="sm" onClick={() => ticketFileInputRef.current?.click()} disabled={ticketUploading} className="gap-2 text-slate-600 border-slate-200 hover:bg-slate-100" data-testid="button-upload-to-ticket">
                {ticketUploading ? <><Spinner className="h-4 w-4" />Uploading...</> : <><Upload className="h-4 w-4" />Add Attachment</>}
              </Button>
            </div>

            <TicketRepliesSection ticketId={ticket.id} users={users || []} onImageClick={setLightboxImage} />
            <div className="h-4" />
          </div>
        </>
      )}

      <Dialog open={!!lightboxImage} onOpenChange={(open) => { if (!open) setLightboxImage(null); }}>
        <DialogContent className="max-w-4xl w-auto p-0 bg-black/95 border-none rounded-2xl overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
            <DialogTitle className="text-sm font-medium text-white/90 truncate">{lightboxImage?.name}</DialogTitle>
            <a href={lightboxImage?.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 transition hover:bg-white/25" data-testid="button-lightbox-download" onClick={(e) => e.stopPropagation()}>
              Open Original
            </a>
          </DialogHeader>
          {lightboxImage && <img src={lightboxImage.url} alt={lightboxImage.name} className="max-h-[85vh] w-auto mx-auto object-contain" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { TicketDetailPanel };

export default function TicketsBoard({ selectedTicketId }: { selectedTicketId?: string }) {
  const [query, setQuery] = useState("");
  const [statusTab, setStatusTab] = useState<string>("active");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("me");
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(selectedTicketId || null);
  const [, navigate] = useLocation();

  const [formData, setFormData] = useState({
    clientId: "",
    userId: "",
    type: "Sales" as string,
    status: "Open" as string,
    priority: "Medium" as string,
    subject: "",
    description: "",
    dueDate: "",
  });

  const { toast } = useToast();
  const { data: tickets, isLoading: ticketsLoading } = useTickets();
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 20, search: customerSearch });
  const { data: users } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const createTicketMutation = useCreateTicket();

  useEffect(() => {
    if (selectedTicketId) setActiveTicketId(selectedTicketId);
  }, [selectedTicketId]);

  useEffect(() => {
    if (!activeTicketId && tickets?.length && !selectedTicketId) {
      const filtered = getFilteredTickets();
      if (filtered?.length) setActiveTicketId(filtered[0].id);
    }
  }, [tickets]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const resetForm = () => {
    setFormData({ clientId: "", userId: "", type: "Sales", status: "Open", priority: "Medium", subject: "", description: "", dueDate: "" });
    setCustomerSearch("");
    setSelectedCustomerName("");
    setShowCustomerDropdown(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    const maxSize = 10 * 1024 * 1024;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!allowed.includes(f.type)) { toast({ title: `${f.name}: Only images and PDFs are allowed`, variant: "destructive" }); continue; }
      if (f.size > maxSize) { toast({ title: `${f.name}: File too large (max 10MB)`, variant: "destructive" }); continue; }
      newFiles.push(f);
    }
    setPendingFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePendingFile = (index: number) => setPendingFiles((prev) => prev.filter((_, i) => i !== index));

  const formatFileSizeLocal = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-red-500" />;
  };

  const handleCreate = () => {
    const needsClient = formData.type !== "Build";
    if ((needsClient && !formData.clientId) || !formData.userId || !formData.subject) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    createTicketMutation.mutate({
      clientId: formData.type === "Build" ? null : formData.clientId,
      userId: currentUser?.id || formData.userId,
      assignedTo: formData.userId,
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      subject: formData.subject,
      description: formData.description || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    }, {
      onSuccess: async (data: any) => {
        const ticketId = data?.id;
        if (ticketId && pendingFiles.length > 0) {
          let uploaded = 0;
          let failed = 0;
          for (const file of pendingFiles) {
            try { await attachmentApi.upload(ticketId, file); uploaded++; } catch { failed++; }
          }
          if (failed > 0) { toast({ title: `Ticket created. ${uploaded} file(s) uploaded, ${failed} failed.`, variant: "destructive" }); }
          else { toast({ title: `Ticket created with ${uploaded} attachment(s)` }); }
        } else { toast({ title: "Ticket created successfully" }); }
        setShowCreateDialog(false);
        resetForm();
        setIsUploading(false);
        if (ticketId) {
          setActiveTicketId(ticketId);
          navigate(`/tickets/${ticketId}`);
        }
      },
      onError: () => { toast({ title: "Failed to create ticket", variant: "destructive" }); setIsUploading(false); },
    });
  };

  const getFilteredTickets = () => {
    return tickets?.filter((ticket) => {
      const matchesQuery = query === "" || ticket.subject.toLowerCase().includes(query.toLowerCase()) || ticket.description?.toLowerCase().includes(query.toLowerCase());
      const matchesType = typeFilter === "all" || ticket.type === typeFilter;
      const matchesStatus = statusTab === "all"
        ? true
        : statusTab === "active"
          ? ticket.status !== "Resolved" && ticket.status !== "Closed"
          : ticket.status === statusTab;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const myId = currentUser?.id;
      let matchesAgent = true;
      if (agentFilter === "me") {
        const assignedToMe = ticket.assignedTo === myId || (!ticket.assignedTo && ticket.userId === myId);
        const iCreatedAndReassigned = ticket.userId === myId && ticket.assignedTo && ticket.assignedTo !== myId && (ticket.replyCount || 0) > 0;
        matchesAgent = assignedToMe || !!iCreatedAndReassigned;
      } else if (agentFilter !== "all") {
        matchesAgent = ticket.assignedTo === agentFilter || ticket.userId === agentFilter;
      }
      return matchesQuery && matchesType && matchesStatus && matchesPriority && matchesAgent;
    });
  };

  const filteredTickets = getFilteredTickets();

  const getClientName = (ticket: { clientName?: string | null }) => {
    const name = ticket.clientName?.trim();
    return name && name !== "null" ? name : "Unknown Client";
  };

  const getUserName = (ticket: { userName?: string | null; userId: string; assignedTo?: string | null; assignedToName?: string | null }) => {
    if (ticket.assignedToName) return ticket.assignedToName;
    if (ticket.assignedTo) {
      const assignee = users?.find((u) => u.id === ticket.assignedTo);
      if (assignee?.name) return assignee.name;
    }
    if (ticket.userName) return ticket.userName;
    const u = users?.find((usr) => usr.id === ticket.userId);
    return u?.name || "Unassigned";
  };

  const activeTicket = tickets?.find((t) => t.id === activeTicketId);
  const activeFiltersCount = [typeFilter, priorityFilter].filter((f) => f !== "all").length + (agentFilter !== "me" && agentFilter !== "all" ? 1 : 0);
  const statusTabs = [
    { key: "active", label: "Active" },
    { key: "all", label: "All" },
    { key: "Open", label: "Open" },
    { key: "In Progress", label: "In Progress" },
    { key: "Resolved", label: "Resolved" },
    { key: "Closed", label: "Closed" },
  ];

  const handleSelectTicket = (ticketId: string) => {
    setActiveTicketId(ticketId);
    navigate(`/tickets/${ticketId}`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] overflow-hidden -m-6 -mt-2">
      <div className="flex flex-1 overflow-hidden">
        <div className="w-[35%] flex-none bg-white border-r border-slate-200 flex flex-col min-w-[320px] max-w-[450px]">
          <div className="p-4 border-b border-slate-100 flex-none space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search tickets..."
                  className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  data-testid="input-search-tickets"
                />
              </div>
              <button
                type="button"
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-md border transition-colors ${showFilters || activeFiltersCount > 0 ? "border-blue-300 bg-blue-50 text-blue-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}
                data-testid="button-toggle-filters"
              >
                <Filter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setShowCreateDialog(true); }}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md font-medium text-sm transition-colors"
                data-testid="button-create-ticket"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>

            {showFilters && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex flex-wrap gap-2">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-type-filter"><SelectValue placeholder="Type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[120px] h-8 text-xs" data-testid="select-priority-filter"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Priorities</SelectItem>
                    {TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs" data-testid="select-agent-filter"><SelectValue placeholder="Agent" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="me">My Tickets</SelectItem>
                    <SelectItem value="all">All Agents</SelectItem>
                    {users?.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {activeFiltersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setTypeFilter("all"); setPriorityFilter("all"); setAgentFilter("me"); }}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                    data-testid="button-clear-filters"
                  >
                    <X className="h-3 w-3 inline mr-1" />Clear
                  </button>
                )}
              </motion.div>
            )}

            <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
              {statusTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    statusTab === tab.key
                      ? "bg-slate-800 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                  data-testid={`tab-status-${tab.key.toLowerCase().replace(" ", "-")}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {ticketsLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : !filteredTickets?.length ? (
              <div className="text-center py-12 px-4">
                <LifeBuoy className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="text-sm text-slate-500 font-medium mb-1">No tickets found</p>
                <p className="text-xs text-slate-400">
                  {query || activeFiltersCount > 0 ? "Try adjusting your search or filters" : "Create your first ticket to get started"}
                </p>
              </div>
            ) : (
              filteredTickets.map((ticket) => {
                const isActive = ticket.id === activeTicketId;
                const assignedUserName = getUserName(ticket);
                return (
                  <div
                    key={ticket.id}
                    onClick={() => handleSelectTicket(ticket.id)}
                    className={`py-4 pr-4 pl-6 cursor-pointer transition-colors ${
                      isActive
                        ? "bg-slate-200/80"
                        : "hover:bg-slate-100/60"
                    }`}
                    data-testid={`card-ticket-${ticket.id}`}
                  >
                    <div className="flex items-start justify-between mb-1 gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2 h-2 rounded-full flex-none ${priorityDotColor(ticket.priority)}`} />
                        <h3 className="text-sm font-semibold truncate text-slate-900">
                          {ticket.subject}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500 flex-none">{formatDate(ticket.createdAt)}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {getClientName(ticket)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Tag className="w-3 h-3" />
                          {ticket.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(ticket.replyCount ?? 0) > 0 && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <MessageCircle className="w-3 h-3" />
                            {ticket.replyCount}
                          </span>
                        )}
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-medium text-slate-600">
                          {getInitials(assignedUserName)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {activeTicket ? (
          <TicketDetailPanel
            ticket={activeTicket}
            users={users || []}
            onClose={() => { setActiveTicketId(null); navigate("/tickets"); }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <LifeBuoy className="h-12 w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 font-medium">Select a ticket to view details</p>
              <p className="text-xs text-slate-400 mt-1">Choose a ticket from the list on the left</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Ticket</DialogTitle>
            <DialogDescription>Create a support ticket for a client</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {formData.type !== "Build" && (
              <div className="grid gap-2">
                <Label htmlFor="client">Customer *</Label>
                <div className="relative" ref={customerDropdownRef}>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    data-testid="select-client"
                    placeholder="Search customers..."
                    value={selectedCustomerName || customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setSelectedCustomerName(""); setFormData({ ...formData, clientId: "" }); setShowCustomerDropdown(true); }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    className="pl-9"
                  />
                  {showCustomerDropdown && customerSearch.length >= 1 && (
                    <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-black/10 bg-white shadow-lg">
                      {neonClientsData?.clients && neonClientsData.clients.length > 0 ? (
                        neonClientsData.clients.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-black/5"
                            data-testid={`customer-option-${c.id}`}
                            onClick={() => {
                              const displayName = `${c.title && c.title !== "NULL" ? c.title + " " : ""}${c.firstName || ""} ${c.surename || ""}`.trim();
                              setFormData({ ...formData, clientId: c.id });
                              setSelectedCustomerName(displayName);
                              setCustomerSearch("");
                              setShowCustomerDropdown(false);
                            }}
                          >
                            <User className="h-3.5 w-3.5 text-muted-foreground" />
                            <span>{c.title && c.title !== "NULL" ? c.title + " " : ""}{c.firstName} {c.surename}</span>
                            {c.phoneNumber && <span className="ml-auto text-xs text-muted-foreground">{c.phoneNumber}</span>}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-muted-foreground">No customers found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="user">Assigned To *</Label>
              <Select value={formData.userId} onValueChange={(v) => setFormData({ ...formData, userId: v })}>
                <SelectTrigger data-testid="select-user"><SelectValue placeholder="Select user" /></SelectTrigger>
                <SelectContent>{users?.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={formData.type} onValueChange={(v) => {
                  const updates: any = { type: v };
                  if (v === "Build") { updates.clientId = ""; }
                  setFormData({ ...formData, ...updates });
                  if (v === "Build") { setSelectedCustomerName(""); setCustomerSearch(""); }
                }}>
                  <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Priority</Label>
                <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                  <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                  <SelectContent>{TICKET_PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="subject">Subject *</Label>
              <Input id="subject" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} placeholder="Brief summary of the issue" data-testid="input-subject" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })} data-testid="input-due-date" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <RichTextEditor content={formData.description ?? ""} onChange={(html) => setFormData({ ...formData, description: html })} placeholder="Detailed description of the ticket" data-testid="input-description" />
            </div>
            <div className="grid gap-2">
              <Label>Attachments</Label>
              <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/gif,image/webp,application/pdf" onChange={handleFileSelect} className="hidden" data-testid="input-file-attachment" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border-2 border-dashed border-black/20 bg-black/[0.02] p-4 text-center hover:border-black/40 hover:bg-black/[0.04] transition-colors cursor-pointer"
                data-testid="button-add-attachment"
              >
                <Upload className="h-5 w-5 mx-auto text-black/40 mb-1" />
                <p className="text-sm text-black/60 font-medium">Click to attach files</p>
                <p className="text-xs text-black/40 mt-0.5">Images (JPG, PNG, GIF, WebP) and PDF - max 10MB each</p>
              </button>
              {pendingFiles.length > 0 && (
                <div className="space-y-1.5 mt-1">
                  {pendingFiles.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2" data-testid={`attachment-file-${index}`}>
                      {getFileIcon(file.type)}
                      <span className="text-sm text-black/70 flex-1 truncate">{file.name}</span>
                      <span className="text-xs text-black/40">{formatFileSizeLocal(file.size)}</span>
                      <button type="button" onClick={() => removePendingFile(index)} className="text-black/30 hover:text-red-500 transition-colors" data-testid={`button-remove-file-${index}`}>
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">Cancel</Button>
            <Button onClick={handleCreate} disabled={createTicketMutation.isPending || isUploading} data-testid="button-submit-create">
              {isUploading ? "Uploading files..." : createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
