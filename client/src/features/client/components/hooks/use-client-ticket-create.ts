import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attachmentApi } from "@/api";
import { ticketKeys } from "@/hooks/queries";
import { useCreateTicket } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

const EMPTY_TICKET_FORM = {
  subject: "",
  type: "Sales",
  status: "Open",
  priority: "Medium",
  description: "",
  dueDate: "",
  userId: "",
};

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "application/pdf"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Owns the Create Ticket dialog: open state, form fields, pending file
 * attachments, file picker handlers, and the create+upload flow.
 */
/** Holiday a new ticket should be attached to — set when raised from a quote, booking, or enquiry. */
export interface TicketLinkTarget {
  transactionId?: string | null;
}

export function useClientTicketCreate(clientId: string, currentUserId: string | undefined, link?: TicketLinkTarget) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [ticketForm, setTicketForm] = useState(EMPTY_TICKET_FORM);
  const [ticketPendingFiles, setTicketPendingFiles] = useState<File[]>([]);
  const [isTicketUploading, setIsTicketUploading] = useState(false);
  const ticketFileInputRef = useRef<HTMLInputElement>(null);
  const createTicketMutation = useCreateTicket();

  function resetTicketForm() {
    setTicketForm(EMPTY_TICKET_FORM);
    setTicketPendingFiles([]);
    setIsTicketUploading(false);
    if (ticketFileInputRef.current) ticketFileInputRef.current.value = "";
  }

  function handleTicketFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (!ALLOWED_FILE_TYPES.includes(f.type)) {
        toast({ title: `${f.name}: Only images and PDFs are allowed`, variant: "destructive" });
        continue;
      }
      if (f.size > MAX_FILE_SIZE) {
        toast({ title: `${f.name}: File too large (max 10MB)`, variant: "destructive" });
        continue;
      }
      newFiles.push(f);
    }
    setTicketPendingFiles((prev) => [...prev, ...newFiles]);
    if (ticketFileInputRef.current) ticketFileInputRef.current.value = "";
  }

  function removeTicketPendingFile(index: number) {
    setTicketPendingFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function formatTicketFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleCreateTicket() {
    if (!ticketForm.subject.trim() || !ticketForm.userId || !currentUserId) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsTicketUploading(true);
    createTicketMutation.mutate(
      {
        clientId,
        userId: currentUserId,
        assignedTo: ticketForm.userId,
        type: ticketForm.type,
        status: ticketForm.status,
        priority: ticketForm.priority,
        subject: ticketForm.subject.trim(),
        description: ticketForm.description || null,
        dueDate: ticketForm.dueDate ? new Date(ticketForm.dueDate).toISOString() : null,
        transactionId: link?.transactionId ?? null,
      },
      {
        onSuccess: async (data: any) => {
          const ticketId = data?.id;
          queryClient.invalidateQueries({ queryKey: ticketKeys.byClient(clientId) });
          if (ticketId && ticketPendingFiles.length > 0) {
            let uploaded = 0;
            let failed = 0;
            for (const file of ticketPendingFiles) {
              try {
                await attachmentApi.upload(ticketId, file);
                uploaded++;
              } catch {
                failed++;
              }
            }
            if (failed > 0) {
              toast({
                title: `Ticket created. ${uploaded} file(s) uploaded, ${failed} failed.`,
                variant: "destructive",
              });
            } else {
              toast({ title: `Ticket created with ${uploaded} attachment(s)` });
            }
          } else {
            toast({ title: "Ticket created successfully" });
          }
          setShowTicketDialog(false);
          resetTicketForm();
        },
        onError: () => {
          toast({ title: "Failed to create ticket", variant: "destructive" });
          setIsTicketUploading(false);
        },
      },
    );
  }

  return {
    showTicketDialog,
    setShowTicketDialog,
    ticketForm,
    setTicketForm,
    ticketPendingFiles,
    isTicketUploading,
    ticketFileInputRef,
    createTicketMutation,
    resetTicketForm,
    handleTicketFileSelect,
    removeTicketPendingFile,
    formatTicketFileSize,
    handleCreateTicket,
  };
}
