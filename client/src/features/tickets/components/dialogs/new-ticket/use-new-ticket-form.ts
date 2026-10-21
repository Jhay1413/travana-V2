import { useEffect, useState } from "react";
import { useCurrentUser } from "@/hooks/queries";
import { useClient } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { clientDisplayName } from "@/lib/utils";
import { usePendingAttachments } from "@/features/attachment";
import { useCreateTicket } from "../../../api/use-ticket-mutations";
import { ticketErrorMessage } from "../../../lib/error-message";
import { seededTransactionId, validTransactionId } from "./form-seed";
import { useHolidayOptions } from "../holiday-picker";
import { cleanContact, type PickedClient, type RawClientRow } from "../../../lib/raw-client";
import type { Ticket, TicketPriorityValue, TicketStatusValue, TicketTypeValue } from "../../../types";

export interface NewTicketFormState {
  client: PickedClient | null;
  assigneeId: string;
  transactionId: string;
  type: TicketTypeValue;
  status: TicketStatusValue;
  priority: TicketPriorityValue;
  subject: string;
  description: string;
  /** Reply-due instant as ISO, or null for none. */
  dueDate: string | null;
}

function initialState(status?: TicketStatusValue): NewTicketFormState {
  return {
    client: null,
    assigneeId: "",
    transactionId: "",
    type: "Sales",
    status: status ?? "Open",
    priority: "Medium",
    subject: "",
    description: "",
    dueDate: null,
  };
}

/**
 * State, validation and submit for the new-ticket dialog. Rules are unchanged
 * from the previous dialog: assignee and subject are required, a customer is
 * required unless the ticket is a Build ticket, and server errors (such as a
 * holiday that belongs to another client) are shown as they come back.
 */
export function useNewTicketForm({
  open,
  initialClientId,
  initialTransactionId,
  initialStatus,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialClientId?: string;
  initialTransactionId?: string;
  initialStatus?: TicketStatusValue;
  onClose: () => void;
  onCreated?: (ticket: Ticket) => void;
}) {
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const createTicket = useCreateTicket();
  const attachments = usePendingAttachments();
  const [form, setForm] = useState<NewTicketFormState>(() => initialState(initialStatus));
  const [isUploading, setIsUploading] = useState(false);
  const { data: initialClient } = useClient(open && initialClientId ? initialClientId : "");

  const holidayOptions = useHolidayOptions(form.client?.id, !!form.client);
  const optionIds = holidayOptions.map((o) => o.id);
  const optionKey = optionIds.join(",");

  const patch = (next: Partial<NewTicketFormState>) => setForm((prev) => ({ ...prev, ...next }));

  // Reseed whenever the dialog opens, so a ?status= or ?client= link starts the form right.
  useEffect(() => {
    if (open) setForm(initialState(initialStatus));
    else attachments.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialStatus]);

  // Prefill the client once its details arrive (and only if the user has not picked another).
  useEffect(() => {
    if (!open || !initialClientId || !initialClient) return;
    const raw = initialClient as unknown as RawClientRow;
    setForm((prev) =>
      prev.client
        ? prev
        : {
            ...prev,
            transactionId: prev.transactionId || seededTransactionId(initialClientId, initialClientId, initialTransactionId),
            client: {
              id: initialClientId,
              name: clientDisplayName(raw) || "Client",
              phone: cleanContact(raw.phoneNumber),
              email: cleanContact(raw.email),
            },
          },
    );
  }, [open, initialClientId, initialTransactionId, initialClient]);

  // A seeded or stale holiday that is not one of this client's holidays is dropped once the list has loaded.
  useEffect(() => {
    if (!form.transactionId || optionIds.length === 0) return;
    if (validTransactionId(form.transactionId, optionIds) === "") setForm((prev) => ({ ...prev, transactionId: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionKey, form.transactionId]);

  const setType = (type: TicketTypeValue) =>
    setForm((prev) => ({ ...prev, type, client: type === "Build" ? null : prev.client, transactionId: type === "Build" ? "" : prev.transactionId }));

  const pickClient = (client: PickedClient | null) =>
    patch({ client, transactionId: seededTransactionId(client?.id, initialClientId, initialTransactionId) });

  const submit = () => {
    const needsClient = form.type !== "Build";
    if ((needsClient && !form.client) || !form.assigneeId || !form.subject.trim()) {
      toast({ title: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    setIsUploading(true);
    createTicket.mutate(
      {
        clientId: needsClient ? form.client?.id ?? null : null,
        userId: currentUser?.id || form.assigneeId,
        assignedTo: form.assigneeId,
        transactionId: needsClient ? validTransactionId(form.transactionId, optionIds) || null : null,
        type: form.type,
        status: form.status,
        priority: form.priority,
        subject: form.subject.trim(),
        description: form.description || null,
        dueDate: form.dueDate,
      },
      {
        onSuccess: async (ticket: Ticket) => {
          if (ticket.id && attachments.files.length > 0) {
            const { uploaded, failed } = await attachments.uploadAll(ticket.id);
            if (failed > 0) toast({ title: `Ticket created. ${uploaded} file(s) uploaded, ${failed} failed.`, variant: "destructive" });
            else toast({ title: `Ticket created with ${uploaded} attachment(s)` });
          } else {
            toast({ title: "Ticket created successfully" });
          }
          setIsUploading(false);
          onClose();
          onCreated?.(ticket);
        },
        onError: (err) => {
          toast({ title: ticketErrorMessage(err, "Failed to create ticket"), variant: "destructive" });
          setIsUploading(false);
        },
      },
    );
  };

  return {
    form,
    patch,
    setType,
    pickClient,
    attachments,
    submit,
    isBusy: createTicket.isPending || isUploading,
  };
}
