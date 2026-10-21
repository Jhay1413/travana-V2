import { useState } from "react";
import { Plus } from "lucide-react";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { useCurrentUser, useUsers } from "@/hooks/queries";
import { CreateTicketDialog } from "@/features/client/components/modals/CreateTicketDialog";
import { useClientTicketCreate } from "@/features/client/components/hooks";

const LINK_BUTTON =
  "inline-flex items-center gap-1 rounded-[10px] px-1.5 py-1 text-[13px] font-semibold text-status-posted-fg hover:bg-status-posted-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** "New task" link that opens the shared add-task pop-up for this holiday. Booking tasks live under the quote entity. */
export function NewTaskAction({ entityType, entityId }: { entityType: "enquiry" | "quote" | "booking"; entityId: string }) {
  const [open, setOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();
  return (
    <>
      <button type="button" className={LINK_BUTTON} onClick={() => setOpen(true)} data-testid="button-activity-new-task">
        <Plus className="size-3.5" aria-hidden />
        New task
      </button>
      <AddTaskModal
        open={open}
        onOpenChange={setOpen}
        entityType={entityType === "booking" ? "quote" : entityType}
        entityId={entityId}
        assignedToId={currentUser?.id}
        testIdPrefix="holiday-add-task"
      />
    </>
  );
}

/** "Raise a ticket" link that opens the create-ticket drawer linked to this holiday's deal. */
export function RaiseTicketAction({
  clientId,
  clientName,
  transactionId,
}: {
  clientId: string;
  clientName: string;
  transactionId: string | null | undefined;
}) {
  const { data: currentUser } = useCurrentUser();
  const { data: users = [] } = useUsers();
  const ticketCreate = useClientTicketCreate(clientId, currentUser?.id, { transactionId: transactionId ?? null });
  return (
    <>
      <button type="button" className={LINK_BUTTON} onClick={() => ticketCreate.setShowTicketDialog(true)} data-testid="button-activity-raise-ticket">
        <Plus className="size-3.5" aria-hidden />
        Raise a ticket
      </button>
      <CreateTicketDialog
        presentation="drawer"
        open={ticketCreate.showTicketDialog}
        onOpenChange={ticketCreate.setShowTicketDialog}
        clientName={clientName || "this client"}
        ticketForm={ticketCreate.ticketForm}
        setTicketForm={ticketCreate.setTicketForm}
        ticketPendingFiles={ticketCreate.ticketPendingFiles}
        ticketFileInputRef={ticketCreate.ticketFileInputRef}
        isUploading={ticketCreate.isTicketUploading}
        isPending={ticketCreate.createTicketMutation.isPending}
        users={users}
        onFileSelect={ticketCreate.handleTicketFileSelect}
        removePendingFile={ticketCreate.removeTicketPendingFile}
        formatFileSize={ticketCreate.formatTicketFileSize}
        onConfirm={ticketCreate.handleCreateTicket}
        onReset={ticketCreate.resetTicketForm}
      />
    </>
  );
}
