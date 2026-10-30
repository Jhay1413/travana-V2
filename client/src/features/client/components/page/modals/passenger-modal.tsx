import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { ClientPassenger } from "@/features/client/api/client-passenger.api";
import { useClientPassengerMutations } from "@/features/client/api/use-client-passengers";
import {
  PASSENGER_TITLES,
  draftFromPassenger,
  draftToInput,
  isPassengerDraftValid,
  passengerFullName,
  type PassengerDraft,
} from "@/features/client/lib/client-passengers";

const NO_TITLE = "__none__";

interface PassengerModalProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = adding a new passenger. */
  passenger: ClientPassenger | null;
}

/**
 * Add / edit a passenger. For the lead only the passport fields are editable -
 * name and date of birth come from the client's own details.
 */
export function PassengerModal({ clientId, open, onOpenChange, passenger }: PassengerModalProps) {
  const { toast } = useToast();
  const { saveLead, create, update, remove } = useClientPassengerMutations(clientId);
  const [draft, setDraft] = useState<PassengerDraft>(() => draftFromPassenger(passenger));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isLead = !!passenger?.isLead;
  const isEdit = !!passenger && !isLead;
  const pending = saveLead.isPending || create.isPending || update.isPending || remove.isPending;
  const canSave = isLead || isPassengerDraftValid(draft);

  useEffect(() => {
    if (open) {
      setDraft(draftFromPassenger(passenger));
      setConfirmDelete(false);
    }
  }, [open, passenger]);

  const set = (patch: Partial<PassengerDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const done = (title: string) => {
    toast({ title });
    onOpenChange(false);
  };
  const failed = (title: string) => toast({ title, variant: "destructive" });

  const save = async () => {
    if (!canSave) return;
    const input = draftToInput(draft);
    try {
      if (isLead) {
        await saveLead.mutateAsync({ passportNumber: input.passportNumber, passportExpiry: input.passportExpiry });
        done("Passport details saved");
      } else if (passenger?.id) {
        await update.mutateAsync({ passengerId: passenger.id, input });
        done("Passenger updated");
      } else {
        await create.mutateAsync(input);
        done("Passenger added");
      }
    } catch {
      failed("Failed to save passenger");
    }
  };

  const doDelete = async () => {
    if (!passenger?.id) return;
    try {
      await remove.mutateAsync(passenger.id);
      setConfirmDelete(false);
      done("Passenger deleted");
    } catch {
      setConfirmDelete(false);
      failed("Failed to delete passenger");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-[520px] overflow-y-auto rounded-2xl" data-testid="dialog-passenger">
          <DialogHeader>
            <DialogTitle>{isLead ? "Lead passenger passport" : isEdit ? "Edit passenger" : "Add passenger"}</DialogTitle>
            <DialogDescription>
              {isLead
                ? "Name and date of birth come from the client's details."
                : isEdit
                  ? `Details for ${passengerFullName(passenger)}.`
                  : "Saved on the client so you can reuse them on quotes."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            noValidate
            className="grid gap-4"
          >
            <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
              {!isLead && (
                <>
                  <div className="grid gap-1.5">
                    <Label htmlFor="passenger-title">Title</Label>
                    <Select value={draft.title || undefined} onValueChange={(v) => set({ title: v === NO_TITLE ? "" : v })}>
                      <SelectTrigger id="passenger-title" data-testid="select-passenger-title">
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TITLE}>No title</SelectItem>
                        {PASSENGER_TITLES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <span aria-hidden />
                  <div className="grid gap-1.5">
                    <Label htmlFor="passenger-first-name">First name</Label>
                    <Input id="passenger-first-name" value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} data-testid="input-passenger-first-name" />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="passenger-surname">Surname</Label>
                    <Input id="passenger-surname" value={draft.surname} onChange={(e) => set({ surname: e.target.value })} data-testid="input-passenger-surname" />
                  </div>
                  <div className="col-span-2 grid gap-1.5">
                    <Label htmlFor="passenger-dob">Date of birth</Label>
                    <Input id="passenger-dob" type="date" value={draft.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} data-testid="input-passenger-dob" />
                  </div>
                </>
              )}
              <div className="grid gap-1.5">
                <Label htmlFor="passenger-passport-number">Passport number</Label>
                <Input
                  id="passenger-passport-number"
                  maxLength={20}
                  value={draft.passportNumber}
                  onChange={(e) => set({ passportNumber: e.target.value })}
                  data-testid="input-passenger-passport-number"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="passenger-passport-expiry">Passport expiry</Label>
                <Input
                  id="passenger-passport-expiry"
                  type="date"
                  value={draft.passportExpiry}
                  onChange={(e) => set({ passportExpiry: e.target.value })}
                  data-testid="input-passenger-passport-expiry"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <div>
                {isEdit && (
                  <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={pending} onClick={() => setConfirmDelete(true)} data-testid="button-delete-passenger">
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={!canSave || pending} data-testid="button-save-passenger">
                  {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this passenger?</AlertDialogTitle>
            <AlertDialogDescription>They will be removed from this client's saved passengers.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doDelete()} data-testid="button-confirm-delete-passenger">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
