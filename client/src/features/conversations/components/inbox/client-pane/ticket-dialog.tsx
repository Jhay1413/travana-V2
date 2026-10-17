import type { ReactNode } from "react";
import { useCurrentUser, useUsers } from "@/hooks/queries";
import { CreateTicketDialog, useClientTicketCreate } from "@/features/client";

export interface ClientTicketDialog {
  open(): void;
  dialog: ReactNode;
}

/**
 * The old panel's Create Ticket wiring. `clientName` is only used for the
 * dialog title; the dialog renders nothing until a client id is provided.
 */
export function useClientTicketDialog(clientId: string | null | undefined, clientName = ""): ClientTicketDialog {
  const { data: currentUser } = useCurrentUser();
  const { data: staff = [] } = useUsers();
  const ticketCreate = useClientTicketCreate(clientId ?? "", currentUser?.id);

  const dialog = clientId ? (
    <CreateTicketDialog
      presentation="drawer"
      open={ticketCreate.showTicketDialog}
      onOpenChange={ticketCreate.setShowTicketDialog}
      clientName={clientName}
      ticketForm={ticketCreate.ticketForm}
      setTicketForm={ticketCreate.setTicketForm}
      ticketPendingFiles={ticketCreate.ticketPendingFiles}
      ticketFileInputRef={ticketCreate.ticketFileInputRef}
      isUploading={ticketCreate.isTicketUploading}
      isPending={ticketCreate.createTicketMutation.isPending}
      users={staff}
      onFileSelect={ticketCreate.handleTicketFileSelect}
      removePendingFile={ticketCreate.removeTicketPendingFile}
      formatFileSize={ticketCreate.formatTicketFileSize}
      onConfirm={ticketCreate.handleCreateTicket}
      onReset={ticketCreate.resetTicketForm}
    />
  ) : null;

  return { open: () => ticketCreate.setShowTicketDialog(true), dialog };
}
