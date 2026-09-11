import { useEffect, useRef, useState } from "react";
import { FileText, Image, Search, Upload, User, X } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/shared/rich-text-editor";
import { attachmentApi } from "@/api";
import { useCurrentUser, useNeonClients, useTransactions, useUsers } from "@/hooks/queries";
import { holidayLabelOf } from "@/features/transaction";
import { useToast } from "@/hooks/use-toast";
import { useCreateTicket } from "../api/use-ticket-mutations";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_TYPES } from "../types";
import type { Ticket } from "../types";

const HOLIDAY_KIND_PREFIX: Record<"booking" | "quote" | "enquiry", string> = {
  booking: "Booking",
  quote: "Quote",
  enquiry: "Enquiry",
};

// "23 Jul 2026" — short date for the holiday select's label.
function formatBookingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Extracted from the legacy tickets-board.tsx create dialog so the new 3-panel
// tickets inbox can reuse it as the compose flow behind the header's
// round SquarePen button, without cross-importing the whole social board.

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="h-4 w-4 text-blue-500" />;
  return <FileText className="h-4 w-4 text-red-500" />;
}

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (ticket: Ticket) => void;
}

export function CreateTicketDialog({ open, onOpenChange, onCreated }: CreateTicketDialogProps) {
  const { toast } = useToast();
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    clientId: "",
    userId: "",
    transactionId: "",
    type: "Sales" as (typeof TICKET_TYPES)[number],
    status: "Open" as (typeof TICKET_STATUSES)[number],
    priority: "Medium" as (typeof TICKET_PRIORITIES)[number],
    subject: "",
    description: "",
    dueDate: "",
  });

  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 20, search: customerSearch });
  const { data: users } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const createTicketMutation = useCreateTicket();

  // That client's transactions, for the optional "Holiday" select below the
  // customer picker — Build tickets have no client, so this only ever fires
  // for Admin/Sales tickets once a customer is chosen.
  const showBookingField = formData.type !== "Build";
  const { data: clientTransactions } = useTransactions(
    { clientId: formData.clientId },
    { enabled: showBookingField && !!formData.clientId },
  );
  const holidayOptions = (clientTransactions ?? [])
    .map((t) => ({ id: t.id, ...holidayLabelOf(t) }))
    .filter((o) => o.kind !== null);

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
    setFormData({ clientId: "", userId: "", transactionId: "", type: "Sales", status: "Open", priority: "Medium", subject: "", description: "", dueDate: "" });
    setCustomerSearch("");
    setSelectedCustomerName("");
    setShowCustomerDropdown(false);
    setPendingFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const close = () => {
    onOpenChange(false);
    resetForm();
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

  const handleCreate = () => {
    const needsClient = formData.type !== "Build";
    if ((needsClient && !formData.clientId) || !formData.userId || !formData.subject) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    createTicketMutation.mutate(
      {
        clientId: formData.type === "Build" ? null : formData.clientId,
        userId: currentUser?.id || formData.userId,
        assignedTo: formData.userId,
        transactionId: formData.type === "Build" ? null : formData.transactionId || null,
        type: formData.type,
        status: formData.status,
        priority: formData.priority,
        subject: formData.subject,
        description: formData.description || null,
        dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
      },
      {
        onSuccess: async (ticket: Ticket) => {
          if (ticket.id && pendingFiles.length > 0) {
            let uploaded = 0;
            let failed = 0;
            for (const file of pendingFiles) {
              try {
                await attachmentApi.upload(ticket.id, file);
                uploaded++;
              } catch {
                failed++;
              }
            }
            if (failed > 0) toast({ title: `Ticket created. ${uploaded} file(s) uploaded, ${failed} failed.`, variant: "destructive" });
            else toast({ title: `Ticket created with ${uploaded} attachment(s)` });
          } else {
            toast({ title: "Ticket created successfully" });
          }
          setIsUploading(false);
          close();
          onCreated?.(ticket);
        },
        onError: () => {
          toast({ title: "Failed to create ticket", variant: "destructive" });
          setIsUploading(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : close())}>
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
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerName("");
                    setFormData({ ...formData, clientId: "", transactionId: "" });
                    setShowCustomerDropdown(true);
                  }}
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
                            setFormData({ ...formData, clientId: c.id, transactionId: "" });
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
          {showBookingField && formData.clientId && (
            <div className="grid gap-2">
              <Label htmlFor="booking">Holiday</Label>
              <Select
                value={formData.transactionId || undefined}
                onValueChange={(v) => setFormData({ ...formData, transactionId: v })}
              >
                <SelectTrigger data-testid="select-booking">
                  <SelectValue placeholder={holidayOptions.length ? "Select a holiday (optional)" : "No holidays for this client"} />
                </SelectTrigger>
                <SelectContent>
                  {holidayOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {HOLIDAY_KIND_PREFIX[o.kind as "booking" | "quote" | "enquiry"]} · {o.title}
                      {formatBookingDate(o.date) ? ` — ${formatBookingDate(o.date)}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
              <Select
                value={formData.type}
                onValueChange={(v) => {
                  const type = v as (typeof TICKET_TYPES)[number];
                  setFormData((prev) => ({
                    ...prev,
                    type,
                    clientId: type === "Build" ? "" : prev.clientId,
                    transactionId: type === "Build" ? "" : prev.transactionId,
                  }));
                  if (type === "Build") {
                    setSelectedCustomerName("");
                    setCustomerSearch("");
                  }
                }}
              >
                <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as (typeof TICKET_STATUSES)[number] })}>
                <SelectTrigger data-testid="select-status"><SelectValue /></SelectTrigger>
                <SelectContent>{TICKET_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Priority</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData({ ...formData, priority: v as (typeof TICKET_PRIORITIES)[number] })}>
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
            <DatePicker id="dueDate" value={formData.dueDate} onChange={(dueDate) => setFormData({ ...formData, dueDate })} className="h-9 rounded-md" data-testid="input-due-date" />
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
                    <span className="text-xs text-black/40">{formatFileSize(file.size)}</span>
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
          <Button variant="outline" onClick={close} data-testid="button-cancel">Cancel</Button>
          <Button onClick={handleCreate} disabled={createTicketMutation.isPending || isUploading} data-testid="button-submit-create">
            {isUploading ? "Uploading files..." : createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
