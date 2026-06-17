import { FileText, Image, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/rich-text-editor";

const TICKET_TYPES = ["Admin", "Build", "Sales"] as const;
const TICKET_STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
const TICKET_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;

interface TicketForm {
  subject: string;
  type: string;
  status: string;
  priority: string;
  description: string;
  dueDate: string;
  userId: string;
}

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  ticketForm: TicketForm;
  setTicketForm: (updater: (prev: TicketForm) => TicketForm) => void;
  ticketPendingFiles: File[];
  ticketFileInputRef: React.RefObject<HTMLInputElement | null>;
  isUploading: boolean;
  isPending: boolean;
  users: Array<{ id: string; name: string | null }>;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removePendingFile: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  onConfirm: () => void;
  onReset: () => void;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  clientName,
  ticketForm,
  setTicketForm,
  ticketPendingFiles,
  ticketFileInputRef,
  isUploading,
  isPending,
  users,
  onFileSelect,
  removePendingFile,
  formatFileSize,
  onConfirm,
  onReset,
}: CreateTicketDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onOpenChange(false);
          onReset();
        }
      }}
    >
      <DialogContent className="z-[500] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>Create a support ticket for {clientName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ticket-user">
              Assigned To <span className="text-red-500">*</span>
            </Label>
            <Select
              value={ticketForm.userId}
              onValueChange={(v) => setTicketForm((f) => ({ ...f, userId: v }))}
            >
              <SelectTrigger id="ticket-user" className="z-[600]">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent className="z-[600]">
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              <Select value={ticketForm.type} onValueChange={(v) => setTicketForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="z-[600]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[600]">
                  {TICKET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={ticketForm.status}
                onValueChange={(v) => setTicketForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="z-[600]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[600]">
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select
                value={ticketForm.priority}
                onValueChange={(v) => setTicketForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger className="z-[600]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[600]">
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            <Input
              id="ticket-subject"
              placeholder="Brief summary of the issue"
              value={ticketForm.subject}
              onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-due-date">Due Date</Label>
            <Input
              id="ticket-due-date"
              type="date"
              value={ticketForm.dueDate}
              onChange={(e) => setTicketForm((f) => ({ ...f, dueDate: e.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-description">Description</Label>
            <RichTextEditor
              content={ticketForm.description}
              onChange={(html) => setTicketForm((f) => ({ ...f, description: html }))}
              placeholder="Detailed description of the ticket"
            />
          </div>
          <div className="grid gap-2">
            <Label>Attachments</Label>
            <input
              ref={ticketFileInputRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
              onChange={onFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => ticketFileInputRef.current?.click()}
              className="rounded-xl border-2 border-dashed border-black/20 bg-black/[0.02] p-4 text-center hover:border-black/40 hover:bg-black/[0.04] transition-colors cursor-pointer"
            >
              <Upload className="h-5 w-5 mx-auto text-black/40 mb-1" />
              <p className="text-sm text-black/60 font-medium">Click to attach files</p>
              <p className="text-xs text-black/40 mt-0.5">
                Images (JPG, PNG, GIF, WebP) and PDF – max 10MB each
              </p>
            </button>
            {ticketPendingFiles.length > 0 && (
              <div className="space-y-1.5 mt-1">
                {ticketPendingFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2"
                  >
                    {file.type.startsWith("image/") ? (
                      <Image className="h-4 w-4 text-blue-500" />
                    ) : (
                      <FileText className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-sm text-black/70 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-black/40">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      onClick={() => removePendingFile(index)}
                      className="text-black/30 hover:text-red-500 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onReset();
            }}
          >
            Cancel
          </Button>
          <Button
            disabled={!ticketForm.subject.trim() || !ticketForm.userId || isPending || isUploading}
            onClick={onConfirm}
          >
            {isUploading ? "Uploading files…" : isPending ? "Creating…" : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
