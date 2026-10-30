import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ClientEditForm } from "@/features/client/components/hooks/use-client-edit-form";

import { PASSENGER_TITLES as TITLES } from "@/features/client/lib/client-passengers";

interface FieldDef {
  key: keyof ClientEditForm;
  label: string;
  type?: string;
  span?: 2;
}

const FIELDS: FieldDef[] = [
  { key: "firstName", label: "First name" },
  { key: "surename", label: "Surname" },
  { key: "phoneNumber", label: "Phone", type: "tel" },
  { key: "email", label: "Email", type: "email" },
  { key: "DOB", label: "Date of birth", type: "date" },
  { key: "houseNumber", label: "House number / name" },
  { key: "street", label: "Street", span: 2 },
  { key: "city", label: "Town / city" },
  { key: "post_code", label: "Postcode" },
  { key: "country", label: "Country" },
];

interface EditClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ClientEditForm;
  setForm: (form: ClientEditForm) => void;
  onSave: () => void;
  isPending: boolean;
}

/**
 * Edit details. Only profile fields are ever sent; the server rejects portal
 * PIN, status, merge/split links and VIP fields, and the shared edit hook never
 * includes them.
 */
export function EditClientModal({ open, onOpenChange, form, setForm, onSave, isPending }: EditClientModalProps) {
  const canSave = !!form.firstName.trim() && !!form.surename.trim() && !!form.phoneNumber.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[600px] overflow-y-auto rounded-2xl" data-testid="dialog-edit-client">
        <DialogHeader>
          <DialogTitle>Edit client details</DialogTitle>
          <DialogDescription>These show on quotes, the portal and in the Inbox.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) onSave();
          }}
          noValidate
          className="grid gap-4"
        >
          <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-client-title">Title</Label>
              <Select value={form.title || undefined} onValueChange={(v) => setForm({ ...form, title: v })}>
                <SelectTrigger id="edit-client-title" data-testid="select-title">
                  <SelectValue placeholder="Select title" />
                </SelectTrigger>
                <SelectContent>
                  {TITLES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <span aria-hidden />
            {FIELDS.map((f) => (
              <div key={f.key} className={f.span === 2 ? "col-span-2 grid gap-1.5" : "grid gap-1.5"}>
                <Label htmlFor={`edit-client-${f.key}`}>{f.label}</Label>
                <Input
                  id={`edit-client-${f.key}`}
                  type={f.type}
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  data-testid={`input-edit-${f.key}`}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSave || isPending} data-testid="button-save-client">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
