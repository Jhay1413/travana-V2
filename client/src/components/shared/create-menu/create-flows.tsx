import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { AddTaskModal } from "@/components/shared/add-task-modal";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUser, transactionKeys, quoteKeys } from "@/hooks/queries";
import { dealTypeHref } from "@/lib/deal-links";
import { QuoteCreateDialog } from "@/features/quote";
import { BookingCreateDialog } from "@/features/booking";
import { EnquiryWizard, buildEnquiryTransaction } from "@/features/enquiry";
import { useCreateTransaction } from "@/features/transaction";
import { CreateTicketDialog } from "@/features/tickets";
import { ClientPickDialog } from "./client-pick-dialog";
import { isDealKind, type CreateDealKind, type CreateKind } from "./create-kind";

export type AfterCreate = "navigate" | "stay";

interface CreateFlowProps {
  kind: CreateKind | null;
  /** Whether the flow's dialog is showing. The flow stays mounted while closed so
   *  a pending save still finishes its callbacks (uploads, toasts, navigation). */
  open: boolean;
  clientId?: string;
  transactionId?: string;
  afterCreate: AfterCreate;
  onOpenChange: (open: boolean) => void;
}

interface DealFlowProps {
  kind: CreateDealKind;
  open: boolean;
  clientId?: string;
  afterCreate: AfterCreate;
  onOpenChange: (open: boolean) => void;
}

/** Enquiry / quote / booking: pick a client (unless given), then the drawer form. */
function DealFlow({ kind, open, clientId, afterCreate, onOpenChange }: DealFlowProps) {
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const createTransaction = useCreateTransaction();
  const [pickedId, setPickedId] = useState<string | null>(null);
  const activeClientId = clientId ?? pickedId;

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: transactionKeys.all });
    void queryClient.invalidateQueries({ queryKey: quoteKeys.all });
  };
  const close = (o: boolean) => {
    if (!o) onOpenChange(false);
  };
  const created = (id: string | null | undefined) => {
    onOpenChange(false);
    if (afterCreate === "navigate" && id && activeClientId) navigate(dealTypeHref(kind, id, activeClientId));
  };

  return (
    <>
      <ClientPickDialog open={open && !activeClientId} noun={kind} onCancel={() => onOpenChange(false)} onPick={(c) => setPickedId(c.id)} />

      {activeClientId && kind === "enquiry" && (
        <EnquiryWizard
          presentation="drawer"
          open={open}
          onOpenChange={close}
          onSubmit={(formData) => {
            if (!currentUser?.id) return;
            createTransaction.mutate(buildEnquiryTransaction(formData, { clientId: activeClientId, userId: currentUser.id }), {
              onSuccess: (txn) => {
                toast({ title: "Deal created" });
                created(txn.enquiry?.id);
              },
              onError: () => toast({ title: "Failed to create deal", variant: "destructive" }),
            });
          }}
          isSaving={createTransaction.isPending}
        />
      )}

      {activeClientId && kind === "quote" && currentUser?.id && (
        <QuoteCreateDialog
          presentation="drawer"
          clientId={activeClientId}
          userId={currentUser.id}
          open={open}
          onOpenChange={close}
          onSuccess={(quoteId) => {
            refresh();
            created(quoteId);
          }}
        />
      )}

      {activeClientId && kind === "booking" && (
        <BookingCreateDialog
          presentation="drawer"
          clientId={activeClientId}
          open={open}
          onOpenChange={close}
          onSuccess={(bookingId) => {
            refresh();
            created(bookingId);
          }}
        />
      )}
    </>
  );
}

/** The built-in flow behind a "+" menu pick, used when the caller has no `onCreate`. */
export function CreateFlow({ kind, open, clientId, transactionId, afterCreate, onOpenChange }: CreateFlowProps) {
  const { data: currentUser } = useCurrentUser();
  if (!kind || kind === "client") return null;

  if (isDealKind(kind)) {
    return <DealFlow kind={kind} open={open} clientId={clientId} afterCreate={afterCreate} onOpenChange={onOpenChange} />;
  }

  if (kind === "task") {
    return (
      <AddTaskModal
        open={open}
        onOpenChange={onOpenChange}
        entityType={clientId ? "client" : undefined}
        entityId={clientId}
        defaultAssignedToId={currentUser?.id}
      />
    );
  }

  return (
    <CreateTicketDialog
      open={open}
      onOpenChange={onOpenChange}
      initialClientId={clientId}
      initialTransactionId={transactionId}
    />
  );
}
