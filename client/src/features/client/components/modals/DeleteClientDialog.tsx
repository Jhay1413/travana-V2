import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDeleteNeonClient } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";

/**
 * Soft-delete a client (admin only). The client disappears from lists, search and
 * pickers and the portal link stops working; their deals stay in the Pipeline.
 */
export function DeleteClientDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  onDeleted: () => void;
}) {
  const { toast } = useToast();
  const deleteMutation = useDeleteNeonClient();

  function handleConfirm() {
    deleteMutation.mutate(clientId, {
      onSuccess: () => {
        onOpenChange(false);
        toast({ title: `${clientName} deleted` });
        onDeleted();
      },
      onError: (err: unknown) => {
        toast({
          title: "Failed to delete client",
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl" data-testid="dialog-delete-client">
        <DialogHeader>
          <DialogTitle>Delete {clientName}?</DialogTitle>
          <DialogDescription>Their deals stay in the Pipeline. The portal link stops working.</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleteMutation.isPending} data-testid="button-delete-client-cancel">
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={deleteMutation.isPending} data-testid="button-delete-client-confirm">
            {deleteMutation.isPending ? "Deleting…" : "Delete client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
