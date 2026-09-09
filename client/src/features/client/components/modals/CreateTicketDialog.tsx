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
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import {
  DrawerField,
  FormDrawer,
  FormDrawerFooter,
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
} from "@/components/shared/form-drawer";
import { cn } from "@/lib/utils";
import type { FormPresentation } from "@/features/quote/types";

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
  /** "drawer" renders the right-hand Create / Edit drawer used on the client dashboard. */
  presentation?: FormPresentation;
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
  presentation = "dialog",
}: CreateTicketDialogProps) {
  const isDrawer = presentation === "drawer";
  const canSubmit = !!ticketForm.subject.trim() && !!ticketForm.userId;
  const description = `Create a support ticket for ${clientName}`;

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      onOpenChange(false);
      onReset();
    }
  };

  // The select trigger in dialog mode keeps the stacking fix it always had;
  // the drawer restyles it to match the other drawer controls.
  const triggerCls = isDrawer ? drawerControlClass : "z-[600]";
  const inputCls = isDrawer ? drawerInputClass : undefined;

  const assignedField = (
    <Select value={ticketForm.userId} onValueChange={(v) => setTicketForm((f) => ({ ...f, userId: v }))}>
      <SelectTrigger id="ticket-user" className={triggerCls}>
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
  );

  const typeField = (
    <Select value={ticketForm.type} onValueChange={(v) => setTicketForm((f) => ({ ...f, type: v }))}>
      <SelectTrigger className={triggerCls}>
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
  );

  const statusField = (
    <Select value={ticketForm.status} onValueChange={(v) => setTicketForm((f) => ({ ...f, status: v }))}>
      <SelectTrigger className={triggerCls}>
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
  );

  const priorityField = (
    <Select value={ticketForm.priority} onValueChange={(v) => setTicketForm((f) => ({ ...f, priority: v }))}>
      <SelectTrigger className={triggerCls}>
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
  );

  const subjectField = (
    <Input
      id="ticket-subject"
      placeholder="Brief summary of the issue"
      value={ticketForm.subject}
      onChange={(e) => setTicketForm((f) => ({ ...f, subject: e.target.value }))}
      className={inputCls}
    />
  );

  const dueDateField = (
    <DatePicker
      id="ticket-due-date"
      value={ticketForm.dueDate}
      onChange={(dueDate) => setTicketForm((f) => ({ ...f, dueDate }))}
      className={isDrawer ? drawerControlClass : "h-9 rounded-md"}
    />
  );

  const descriptionField = (
    <RichTextEditor
      content={ticketForm.description}
      onChange={(html) => setTicketForm((f) => ({ ...f, description: html }))}
      placeholder="Detailed description of the ticket"
    />
  );

  const attachmentsField = (
    <>
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
        className={cn(
          "rounded-xl border-2 border-dashed border-black/20 p-4 text-center transition-colors hover:border-black/40 hover:bg-black/[0.04] cursor-pointer",
          isDrawer ? "bg-[#f4f5f7]" : "bg-black/[0.02]",
        )}
      >
        <Upload className="mx-auto mb-1 h-5 w-5 text-black/40" />
        <p className="text-sm font-medium text-black/60">Click to attach files</p>
        <p className="mt-0.5 text-xs text-black/40">Images (JPG, PNG, GIF, WebP) and PDF – max 10MB each</p>
      </button>
      {ticketPendingFiles.length > 0 && (
        <div className="mt-1 space-y-1.5">
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
              <span className="flex-1 truncate text-sm text-black/70">{file.name}</span>
              <span className="text-xs text-black/40">{formatFileSize(file.size)}</span>
              <button
                type="button"
                onClick={() => removePendingFile(index)}
                className="text-black/30 transition-colors hover:text-red-500"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (isDrawer) {
    return (
      <FormDrawer
        open={open}
        onOpenChange={handleOpenChange}
        title="Create Ticket"
        description={description}
        data-testid="create-ticket-drawer"
      >
        <div className="space-y-5 px-7 pb-6 pt-6">
          <DrawerField label="Subject" className="max-w-[420px]">
            {subjectField}
          </DrawerField>
          <div className="grid grid-cols-3 gap-x-6 gap-y-4">
            <DrawerField label="Assigned To">{assignedField}</DrawerField>
            <DrawerField label="Type">{typeField}</DrawerField>
            <DrawerField label="Priority">{priorityField}</DrawerField>
            <DrawerField label="Status">{statusField}</DrawerField>
            <DrawerField label="Due Date">{dueDateField}</DrawerField>
          </div>
        </div>
        <FormDrawerSection title="Description" data-testid="drawer-section-ticket-description">
          {descriptionField}
        </FormDrawerSection>
        <FormDrawerSection title="Attachments" data-testid="drawer-section-ticket-attachments">
          <div className="grid gap-2">{attachmentsField}</div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Create Ticket"
          isLoading={isPending || isUploading}
          disabled={!canSubmit}
          hint={canSubmit ? undefined : "Enter a subject and choose who it's assigned to."}
          onSubmit={onConfirm}
          data-testid="drawer-footer"
        />
      </FormDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-[500] sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Ticket</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="ticket-user">
              Assigned To <span className="text-red-500">*</span>
            </Label>
            {assignedField}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Type</Label>
              {typeField}
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              {statusField}
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              {priorityField}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-subject">
              Subject <span className="text-red-500">*</span>
            </Label>
            {subjectField}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-due-date">Due Date</Label>
            {dueDateField}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ticket-description">Description</Label>
            {descriptionField}
          </div>
          <div className="grid gap-2">
            <Label>Attachments</Label>
            {attachmentsField}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canSubmit || isPending || isUploading} onClick={onConfirm}>
            {isUploading ? "Uploading files…" : isPending ? "Creating…" : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
