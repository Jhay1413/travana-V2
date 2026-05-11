import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";

type EditForm = {
  title: string;
  firstName: string;
  surename: string;
  phoneNumber: string;
  email: string;
  DOB: string;
  houseNumber: string;
  street: string;
  city: string;
  country: string;
  post_code: string;
  badge: string;
};

export function EditClientDialog({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: EditForm;
  setEditForm: (form: EditForm) => void;
  onSave: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl" data-testid="dialog-edit-client">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>Update client information below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              <Select
                value={editForm.title}
                onValueChange={(v) => setEditForm({ ...editForm, title: v })}
              >
                <SelectTrigger id="edit-title" data-testid="select-edit-title">
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent className="z-[500]">
                  <SelectItem value="Mr">Mr</SelectItem>
                  <SelectItem value="Mrs">Mrs</SelectItem>
                  <SelectItem value="Miss">Miss</SelectItem>
                  <SelectItem value="Ms">Ms</SelectItem>
                  <SelectItem value="Dr">Dr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-badge">Badge</Label>
              <Select
                value={editForm.badge || "none"}
                onValueChange={(v) => setEditForm({ ...editForm, badge: v === "none" ? "" : v })}
              >
                <SelectTrigger id="edit-badge" data-testid="select-edit-badge">
                  <SelectValue placeholder="Select badge" />
                </SelectTrigger>
                <SelectContent className="z-[500]">
                  <SelectItem value="none">No Badge</SelectItem>
                  <SelectItem value="New Client">New Client</SelectItem>
                  <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                  <SelectItem value="VIP Client">VIP Client</SelectItem>
                  <SelectItem value="Family Member">Family Member</SelectItem>
                  <SelectItem value="Time Waster">Time Waster</SelectItem>
                  <SelectItem value="Banned">Banned</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-firstName">First Name</Label>
              <Input
                id="edit-firstName"
                value={editForm.firstName}
                onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                data-testid="input-edit-firstName"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-surename">Surname</Label>
              <Input
                id="edit-surename"
                value={editForm.surename}
                onChange={(e) => setEditForm({ ...editForm, surename: e.target.value })}
                data-testid="input-edit-surename"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone Number</Label>
              <Input
                id="edit-phone"
                value={editForm.phoneNumber}
                onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
                data-testid="input-edit-phone"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                data-testid="input-edit-email"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-dob">Date of Birth</Label>
            <DatePicker
              value={editForm.DOB}
              onChange={(v) => setEditForm({ ...editForm, DOB: v })}
              placeholder="Pick a date"
              data-testid="input-edit-dob"
            />
          </div>
          <div className="border-t border-black/10 pt-3">
            <div className="text-xs font-semibold text-black/60 mb-2">Address</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-houseNumber">House Number</Label>
                <Input
                  id="edit-houseNumber"
                  value={editForm.houseNumber}
                  onChange={(e) => setEditForm({ ...editForm, houseNumber: e.target.value })}
                  data-testid="input-edit-houseNumber"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-street">Street</Label>
                <Input
                  id="edit-street"
                  value={editForm.street}
                  onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
                  data-testid="input-edit-street"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-city">City</Label>
                <Input
                  id="edit-city"
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  data-testid="input-edit-city"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-country">Country</Label>
                <Input
                  id="edit-country"
                  value={editForm.country}
                  onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                  data-testid="input-edit-country"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-postcode">Postcode</Label>
                <Input
                  id="edit-postcode"
                  value={editForm.post_code}
                  onChange={(e) => setEditForm({ ...editForm, post_code: e.target.value })}
                  data-testid="input-edit-postcode"
                />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-2xl"
              onClick={() => onOpenChange(false)}
              data-testid="button-edit-cancel"
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#2563eb]"
              onClick={onSave}
              disabled={isPending}
              data-testid="button-edit-save"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
