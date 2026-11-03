import { useState } from "react";
import { Loader2, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DestinationGuru } from "@/features/destination-guru/components/destination-guru";
import { AdjustPinPopover } from "./adjust-pin-popover";
import { useDeleteDestinationGuru } from "@/features/destination-guru/api/use-destination-guru-mutations";
import { getErrorMessage } from "@/features/destination-guru/lib/get-error-message";
import { useRoles } from "@/hooks/use-role";
import { useToast } from "@/hooks/use-toast";
import type { GuruDestinationItem } from "@/features/destination-guru/types";

const ADMIN_ROLES = ["org_admin", "platform_admin"] as const;

interface DestinationGuruSheetProps {
  item: GuruDestinationItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
  onCoordinatesSaved: (lat: number, lng: number) => void;
}

// Detail drawer opened from either the globe or the list view. Uses the
// plain Sheet primitive (not FormDrawer) because <DestinationGuru> already
// renders its own hero + close button — a light overlay keeps the globe
// visible behind it.
export function DestinationGuruSheet({
  item,
  open,
  onOpenChange,
  onDeleted,
  onCoordinatesSaved,
}: DestinationGuruSheetProps) {
  const { hasAnyRole } = useRoles();
  const { toast } = useToast();
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const deleteMutation = useDeleteDestinationGuru();

  const isAdmin = hasAnyRole([...ADMIN_ROLES]);
  const canManage = isAdmin && !!item?.fromDb && !!item?.id;

  const handleDelete = () => {
    if (!item?.id) return;
    deleteMutation.mutate(item.id, {
      onSuccess: () => {
        toast({ title: `${item.destination} removed` });
        setConfirmDeleteOpen(false);
        onDeleted();
      },
      onError: (error) => {
        toast({ title: "Failed to delete", description: getErrorMessage(error, "Please try again"), variant: "destructive" });
      },
    });
  };

  return (
    <Sheet open={open && !!item} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 bg-[#f8f8f8]"
        overlayClassName="bg-black/10"
        hideClose
        data-testid="sheet-guru-detail"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>{item?.destination ?? "Destination detail"}</SheetTitle>
          <SheetDescription>Destination Guru intelligence panel</SheetDescription>
        </SheetHeader>
        {item && (
          <div className="p-5 pt-10">
            <DestinationGuru
              destination={item.destination}
              externalData={item.data}
              compact
              onClose={() => onOpenChange(false)}
            />

            {item.lat === null && (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-3 text-xs text-black/50">
                <span>Not placed on the globe yet</span>
                {isAdmin && item.id && (
                  <AdjustPinPopover
                    destinationId={item.id}
                    lat={item.lat}
                    lng={item.lng}
                    onSaved={onCoordinatesSaved}
                    trigger={
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 shrink-0 rounded-full border-black/10 bg-white"
                        data-testid="button-guru-set-location"
                      >
                        <MapPin className="mr-1.5 h-3.5 w-3.5" />
                        Set location
                      </Button>
                    }
                  />
                )}
              </div>
            )}

            {canManage && item.id && (
              <div className="mt-4 flex items-center justify-end gap-2 border-t border-black/5 pt-4">
                <AdjustPinPopover
                  destinationId={item.id}
                  lat={item.lat}
                  lng={item.lng}
                  onSaved={onCoordinatesSaved}
                  trigger={
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-2xl border-black/10"
                      data-testid="button-guru-adjust-pin"
                    >
                      <MapPin className="mr-1.5 h-4 w-4" />
                      Adjust pin
                    </Button>
                  }
                />

                <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 rounded-2xl border-red-200 text-red-600 hover:bg-red-50"
                      data-testid="button-guru-delete"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {item.destination}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This removes the destination intel permanently. This can&apos;t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={(e) => {
                          e.preventDefault();
                          handleDelete();
                        }}
                        disabled={deleteMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                        data-testid="button-guru-confirm-delete"
                      >
                        {deleteMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Deleting…
                          </>
                        ) : (
                          "Delete"
                        )}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
