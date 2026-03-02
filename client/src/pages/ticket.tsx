import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Link, useParams, useLocation } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { RichTextEditor, RichTextDisplay } from "@/components/rich-text-editor";
import {
  ArrowLeft,
  Calendar,
  Edit2,
  FileImage,
  FileText,
  MessageCircle,
  Paperclip,
  Send,
  Trash2,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useTickets, useUsers, useCurrentUser, useAttachments, useReplies, getAttachmentDownloadUrl } from "@/hooks/queries";
import { useUpdateTicket, useDeleteTicket, useUploadAttachment, useDeleteAttachment, useCreateReply, useUpdateReply, useDeleteReply } from "@/hooks/mutations";
import type { Ticket } from "@/types/ticket";
import type { TicketAttachment } from "@/types/attachment";
import type { TicketReply } from "@/types/reply";
import type { User as ApiUser } from "@/types/user";
import { useToast } from "@/hooks/use-toast";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

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

function typePill(type: string) {
  switch (type) {
    case "Admin":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Build":
      return "border-sky-500/25 bg-sky-500/10 text-sky-700";
    case "Sales":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function statusPill(status: string) {
  switch (status) {
    case "Open":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "In Progress":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Resolved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "Closed":
      return "border-black/25 bg-black/10 text-black/70";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function priorityPill(priority: string) {
  switch (priority) {
    case "Low":
      return "border-slate-500/25 bg-slate-500/10 text-slate-700";
    case "Medium":
      return "border-blue-500/25 bg-blue-500/10 text-blue-700";
    case "High":
      return "border-orange-500/25 bg-orange-500/10 text-orange-700";
    case "Urgent":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

function AttachmentsDialog({ ticketId, open, onOpenChange }: { ticketId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const { data: attachments, isLoading } = useAttachments(ticketId, { enabled: open });

  const deleteMutation = useDeleteAttachment(ticketId);
  const uploadMutation = useUploadAttachment();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
        if (!allowedTypes.includes(file.type)) {
          toast({ 
            title: `${file.name} is not allowed. Only images and PDFs are accepted.`,
            variant: "destructive" 
          });
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast({ 
            title: `${file.name} is too large. Maximum size is 10MB.`,
            variant: "destructive" 
          });
          continue;
        }
        await uploadMutation.mutateAsync({ ticketId, file });
      }
      toast({ title: "Files uploaded successfully" });
    } catch {
      toast({ title: "Failed to upload files", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Attachments
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-black/50">Images and PDFs, max 10MB each</p>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                multiple
                onChange={handleFileChange}
                className="hidden"
                data-testid="input-file-upload"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2 rounded-xl"
                data-testid="button-upload-attachment"
              >
                {uploading ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Upload Files
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : !attachments?.length ? (
            <div className="text-center py-8 border border-dashed border-black/10 rounded-xl bg-black/[0.02]">
              <Paperclip className="h-10 w-10 mx-auto text-black/20 mb-2" />
              <p className="text-sm text-black/40">No attachments yet</p>
              <p className="text-xs text-black/30 mt-1">Upload images or PDFs to attach to this ticket</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-black/10 bg-white/50"
                  data-testid={`attachment-${attachment.id}`}
                >
                  {isImageType(attachment.mimeType) ? (
                    <button
                      type="button"
                      className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-black/5 cursor-pointer"
                      onClick={() => onImageClick?.({ url: getAttachmentDownloadUrl(attachment.id), name: attachment.filename })}
                      data-testid={`button-lightbox-side-attachment-${attachment.id}`}
                    >
                      <img
                        src={getAttachmentDownloadUrl(attachment.id)}
                        alt={attachment.filename}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="w-14 h-14 rounded-lg flex items-center justify-center bg-red-50 flex-shrink-0">
                      <FileText className="h-7 w-7 text-red-600" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    {isImageType(attachment.mimeType) ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-black/80 hover:text-black truncate block text-left cursor-pointer"
                        onClick={() => onImageClick?.({ url: getAttachmentDownloadUrl(attachment.id), name: attachment.filename })}
                      >
                        {attachment.filename}
                      </button>
                    ) : (
                      <a
                        href={getAttachmentDownloadUrl(attachment.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-black/80 hover:text-black truncate block"
                      >
                        {attachment.filename}
                      </a>
                    )}
                    <p className="text-xs text-black/40">{formatFileSize(attachment.size)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteMutation.mutate(attachment.id)}
                    className="h-8 w-8 text-black/40 hover:text-red-600"
                    data-testid={`button-delete-attachment-${attachment.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TicketRepliesSection({ ticketId, users, onImageClick }: { ticketId: string; users: ApiUser[]; onImageClick?: (img: { url: string; name: string }) => void }) {
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
          onSuccess: () => {
            setReplyContent("");
            setReplyingTo(null);
            toast({ title: "Reply added" });
          },
          onError: () => {
            toast({ title: "Failed to add reply", variant: "destructive" });
          },
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
          onSuccess: () => {
            setEditingReply(null);
            toast({ title: "Reply updated" });
          },
          onError: () => {
            toast({ title: "Failed to update reply", variant: "destructive" });
          },
        },
      );
    },
    isPending: updateReplyMutation.isPending,
  };

  const deleteReplyMutation = useDeleteReply(ticketId);
  const deleteMutation = {
    mutate: (id: string) => {
      deleteReplyMutation.mutate(id, {
        onSuccess: () => {
          toast({ title: "Reply deleted" });
        },
        onError: () => {
          toast({ title: "Failed to delete reply", variant: "destructive" });
        },
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
        toast({ 
          title: `${file.name} is not allowed. Only images and PDFs are accepted.`,
          variant: "destructive" 
        });
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({ 
          title: `${file.name} is too large. Maximum size is 10MB.`,
          variant: "destructive" 
        });
        continue;
      }
      validFiles.push(file);
    }
    
    setPendingFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
      
      // Then create reply if there's content
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

  return (
    <Card className="glass ringed grain rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="h-4 w-4" />
        <h3 className="font-medium">Replies</h3>
        {replies?.length ? (
          <Badge className="rounded-full text-xs bg-black/10 text-black/60">{replies.length}</Badge>
        ) : null}
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto mb-4">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : !replies?.length ? (
          <div className="text-center py-6 border border-dashed border-black/10 rounded-xl bg-black/[0.02]">
            <MessageCircle className="h-8 w-8 mx-auto text-black/20 mb-2" />
            <p className="text-sm text-black/40">No replies yet</p>
          </div>
        ) : (
          (() => {
            const topLevelReplies = replies.filter(r => !r.parentReplyId);
            const childReplies = replies.filter(r => r.parentReplyId);
            const getChildReplies = (parentId: string) => childReplies.filter(r => r.parentReplyId === parentId);
            
            const renderReply = (reply: TicketReply, isNested = false) => (
              <div
                key={reply.id}
                className={`p-4 rounded-xl border border-black/10 bg-white/60 ${isNested ? 'ml-6 border-l-2 border-l-blue-200' : ''}`}
                data-testid={`reply-${reply.id}`}
              >
                {editingReply?.id === reply.id ? (
                  <div className="space-y-3">
                    <RichTextEditor
                      content={editContent}
                      onChange={setEditContent}
                      placeholder="Edit your reply..."
                    />
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingReply(null)}
                        data-testid="button-cancel-edit-reply"
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleSaveEdit}
                        disabled={updateMutation.isPending}
                        data-testid="button-save-edit-reply"
                      >
                        {updateMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-black/10 flex items-center justify-center text-xs font-medium">
                          {getUserName(reply.userId).charAt(0)}
                        </div>
                        <span className="text-sm font-medium">{getUserName(reply.userId)}</span>
                        <span className="text-xs text-black/40">{formatDateTime(reply.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setReplyingTo(reply)}
                          data-testid={`button-reply-to-${reply.id}`}
                        >
                          <MessageCircle className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                        {currentUser?.id === reply.userId && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => handleEdit(reply)}
                              data-testid={`button-edit-reply-${reply.id}`}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-600"
                              onClick={() => deleteMutation.mutate(reply.id)}
                              data-testid={`button-delete-reply-${reply.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <RichTextDisplay content={reply.content} />
                  </>
                )}
              </div>
            );
            
            return topLevelReplies.map((reply) => (
              <div key={reply.id} className="space-y-2">
                {renderReply(reply)}
                {getChildReplies(reply.id).map((childReply) => renderReply(childReply, true))}
              </div>
            ));
          })()
        )}
      </div>

      <div className="space-y-2">
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <MessageCircle className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-blue-800">
              Replying to <strong>{getUserName(replyingTo.userId)}</strong>
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="ml-auto text-blue-600 hover:text-blue-800"
              data-testid="button-cancel-reply-to"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <RichTextEditor
          content={replyContent}
          onChange={setReplyContent}
          placeholder={replyingTo ? `Reply to ${getUserName(replyingTo.userId)}...` : "Write a reply..."}
        />
        
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 bg-black/5 rounded-lg">
            {pendingFiles.map((file, index) => (
              <div key={index} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1 text-sm">
                <Paperclip className="h-3 w-3 text-black/50" />
                <span className="max-w-[150px] truncate">{file.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(index)}
                  className="text-black/40 hover:text-red-500"
                  data-testid={`button-remove-file-${index}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex justify-between items-center">
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              data-testid="input-reply-attachment"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2"
              data-testid="button-attach-file"
            >
              <Paperclip className="h-4 w-4" />
              Attach
            </Button>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={uploading || createMutation.isPending || ((!replyContent.trim() || replyContent === "<p></p>") && pendingFiles.length === 0)}
            className="gap-2"
            data-testid="button-send-reply"
          >
            {uploading || createMutation.isPending ? (
              "Sending..."
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Reply
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function TicketPage() {
  const params = useParams();
  const ticketId = params.ticketId as string;
  const [, navigate] = useLocation();
  const { role, setRole } = useRole();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    status: "",
    priority: "",
    subject: "",
    description: "",
  });

  const { toast } = useToast();

  const { data: tickets, isLoading: ticketsLoading } = useTickets();

  const { data: users } = useUsers();

  const { data: attachments } = useAttachments(ticketId, { enabled: !!ticketId });

  const uploadMutation = useUploadAttachment();
  const deleteAttachmentMutation = useDeleteAttachment(ticketId);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; name: string } | null>(null);

  const ticket = tickets?.find((t) => t.id === ticketId);

  const handleTicketFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setTicketUploading(true);
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
    try {
      for (const file of Array.from(files)) {
        if (!allowedTypes.includes(file.type)) {
          toast({ title: `${file.name}: Only images and PDFs allowed`, variant: "destructive" });
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast({ title: `${file.name}: File too large (max 10MB)`, variant: "destructive" });
          continue;
        }
        await uploadMutation.mutateAsync({ ticketId, file });
      }
      toast({ title: "Files uploaded" });
    } catch {
      toast({ title: "Failed to upload files", variant: "destructive" });
    } finally {
      setTicketUploading(false);
      if (ticketFileInputRef.current) ticketFileInputRef.current.value = "";
    }
  };

  const updateTicketMutation = useUpdateTicket();
  const updateMutation = {
    mutate: (data: Partial<Ticket>) => {
      updateTicketMutation.mutate(
        { id: ticketId, data },
        {
          onSuccess: () => {
            setIsEditing(false);
            toast({ title: "Ticket updated successfully" });
          },
          onError: () => {
            toast({ title: "Failed to update ticket", variant: "destructive" });
          },
        },
      );
    },
    isPending: updateTicketMutation.isPending,
  };

  const deleteTicketMutation = useDeleteTicket();
  const deleteMutation = {
    mutate: (id: string) => {
      deleteTicketMutation.mutate(id, {
        onSuccess: () => {
          toast({ title: "Ticket deleted successfully" });
          navigate("/tickets");
        },
        onError: () => {
          toast({ title: "Failed to delete ticket", variant: "destructive" });
        },
      });
    },
    isPending: deleteTicketMutation.isPending,
  };

  const handleStartEdit = () => {
    if (!ticket) return;
    setFormData({
      type: ticket.type,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      description: ticket.description || "",
    });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      type: formData.type,
      status: formData.status,
      priority: formData.priority,
      subject: formData.subject,
      description: formData.description || null,
    });
  };

  const handleDelete = () => {
    if (!ticket) return;
    if (confirm("Are you sure you want to delete this ticket?")) {
      deleteMutation.mutate(ticket.id);
    }
  };

  const getClientName = () => {
    return ticket?.clientName?.trim() || "Unknown Client";
  };

  const getUserName = (userId: string) => {
    if (ticket?.userName && userId === ticket.userId) return ticket.userName;
    const user = users?.find((u) => u.id === userId);
    return user?.name || "Unassigned";
  };

  if (ticketsLoading) {
    return (
      <CommandCenterShell
        active="tickets"
        title="Ticket"
        subtitle="Loading..."
        role={role}
        onRoleChange={setRole}
      >
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </CommandCenterShell>
    );
  }

  if (!ticket) {
    return (
      <CommandCenterShell
        active="tickets"
        title="Ticket"
        subtitle="Not found"
        role={role}
        onRoleChange={setRole}
      >
        <Card className="glass ringed grain rounded-3xl p-8 text-center">
          <h3 className="text-lg font-medium text-black/70 mb-2">Ticket not found</h3>
          <p className="text-sm text-black/50 mb-4">
            The ticket you're looking for doesn't exist or has been deleted.
          </p>
          <Link href="/tickets">
            <Button className="rounded-2xl gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Tickets
            </Button>
          </Link>
        </Card>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell
      active="tickets"
      title="Ticket Details"
      subtitle={ticket.subject}
      role={role}
      onRoleChange={setRole}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="flex items-center justify-between">
          <Link href="/tickets">
            <Button variant="ghost" className="gap-2 rounded-2xl" data-testid="button-back-tickets">
              <ArrowLeft className="h-4 w-4" />
              Back to Tickets
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleStartEdit}
                  className="gap-2 rounded-2xl"
                  data-testid="button-edit-ticket"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="gap-2 rounded-2xl"
                  data-testid="button-delete-ticket"
                >
                  <Trash2 className="h-4 w-4" />
                  {deleteMutation.isPending ? "Deleting..." : "Delete"}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="rounded-2xl"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="rounded-2xl"
                  data-testid="button-save-ticket"
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </>
            )}
          </div>
        </div>

        <Card className="glass ringed grain rounded-2xl p-6">
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={`rounded-full text-xs ${typePill(ticket.type)}`}>
                {ticket.type}
              </Badge>
              <Badge className={`rounded-full text-xs ${statusPill(ticket.status)}`}>
                {ticket.status}
              </Badge>
              <Badge className={`rounded-full text-xs ${priorityPill(ticket.priority)}`}>
                {ticket.priority}
              </Badge>
            </div>

            {isEditing ? (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="rounded-xl"
                    data-testid="input-edit-subject"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-2">
                    <Label>Type</Label>
                    <Select value={formData.type} onValueChange={(v) => setFormData({ ...formData, type: v })}>
                      <SelectTrigger className="rounded-xl" data-testid="select-edit-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Status</Label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger className="rounded-xl" data-testid="select-edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Priority</Label>
                    <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v })}>
                      <SelectTrigger className="rounded-xl" data-testid="select-edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TICKET_PRIORITIES.map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {priority}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="rounded-xl"
                    data-testid="input-edit-description"
                  />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <h1 className="text-xl font-semibold text-black/90" data-testid="text-ticket-subject">
                    {ticket.subject}
                  </h1>
                  {ticket.description && (
                    <p className="text-black/60 mt-2" data-testid="text-ticket-description">
                      {ticket.description}
                    </p>
                  )}
                </div>

                {attachments && attachments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Paperclip className="h-4 w-4 text-black/40" />
                      <h3 className="text-sm font-medium text-black/60">Attachments ({attachments.length})</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {attachments.filter(a => isImageType(a.mimeType)).map((attachment) => (
                        <div
                          key={attachment.id}
                          className="group relative rounded-xl overflow-hidden border border-black/10 bg-black/[0.02]"
                          data-testid={`inline-attachment-${attachment.id}`}
                        >
                          <button
                            type="button"
                            className="block w-full cursor-pointer"
                            onClick={() => setLightboxImage({ url: getAttachmentDownloadUrl(attachment.id), name: attachment.originalName })}
                            data-testid={`button-lightbox-attachment-${attachment.id}`}
                          >
                            <img
                              src={getAttachmentDownloadUrl(attachment.id)}
                              alt={attachment.originalName}
                              className="w-full h-32 object-cover"
                            />
                          </button>
                          <div className="p-2 flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-black/60 truncate">{attachment.originalName}</p>
                              <p className="text-[10px] text-black/30">{formatFileSize(attachment.size)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-black/40 hover:text-red-600"
                              onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              data-testid={`button-delete-inline-attachment-${attachment.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {attachments.filter(a => !isImageType(a.mimeType)).length > 0 && (
                      <div className="space-y-2">
                        {attachments.filter(a => !isImageType(a.mimeType)).map((attachment) => (
                          <div
                            key={attachment.id}
                            className="group flex items-center gap-3 p-3 rounded-xl border border-black/10 bg-white/50"
                            data-testid={`inline-attachment-${attachment.id}`}
                          >
                            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-red-50 flex-shrink-0">
                              <FileText className="h-5 w-5 text-red-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <a
                                href={getAttachmentDownloadUrl(attachment.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-black/70 hover:text-black truncate block"
                              >
                                {attachment.originalName}
                              </a>
                              <p className="text-xs text-black/40">{formatFileSize(attachment.size)}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-black/40 hover:text-red-600"
                              onClick={() => deleteAttachmentMutation.mutate(attachment.id)}
                              data-testid={`button-delete-inline-file-${attachment.id}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <input
                    ref={ticketFileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    multiple
                    onChange={handleTicketFileUpload}
                    className="hidden"
                    data-testid="input-ticket-file-upload"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => ticketFileInputRef.current?.click()}
                    disabled={ticketUploading}
                    className="gap-2 rounded-xl"
                    data-testid="button-upload-to-ticket"
                  >
                    {ticketUploading ? (
                      <>
                        <Spinner className="h-4 w-4" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Add Attachment
                      </>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-b border-black/10">
                  <div>
                    <p className="text-xs text-black/40 mb-1">Customer</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-black/40" />
                      {getClientName()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40 mb-1">Assigned To</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-black/40" />
                      {getUserName(ticket.userId)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40 mb-1">Created</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-black/40" />
                      {formatDate(ticket.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-black/40 mb-1">Updated</p>
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-black/40" />
                      {ticket.updatedAt ? formatDate(ticket.updatedAt) : "-"}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>

        <TicketRepliesSection ticketId={ticketId} users={users || []} onImageClick={setLightboxImage} />
      </motion.div>

      <Dialog open={!!lightboxImage} onOpenChange={(open) => { if (!open) setLightboxImage(null); }}>
        <DialogContent className="max-w-4xl w-auto p-0 bg-black/95 border-none rounded-2xl overflow-hidden" aria-describedby={undefined}>
          <DialogHeader className="absolute top-0 left-0 right-0 z-10 flex flex-row items-center justify-between p-3 bg-gradient-to-b from-black/60 to-transparent">
            <DialogTitle className="text-sm font-medium text-white/90 truncate">{lightboxImage?.name}</DialogTitle>
            <a
              href={lightboxImage?.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 transition hover:bg-white/25"
              data-testid="button-lightbox-download"
              onClick={(e) => e.stopPropagation()}
            >
              Open Original
            </a>
          </DialogHeader>
          {lightboxImage && (
            <img
              src={lightboxImage.url}
              alt={lightboxImage.name}
              className="max-h-[85vh] w-auto mx-auto object-contain"
              data-testid="img-lightbox"
            />
          )}
        </DialogContent>
      </Dialog>
    </CommandCenterShell>
  );
}
