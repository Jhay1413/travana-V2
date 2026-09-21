/**
 * ClientFormDrawer
 *
 * Presents the "New Client" and "Edit Client" forms. In dialog presentation
 * (the default) it renders as a centered Dialog; pass presentation="drawer"
 * to render as the same right-hand Create / Edit drawer used by the quote,
 * booking and enquiry flows on the client dashboard.
 *
 * Field state, the postcode lookup and the create/update mutations live in
 * useClientCreateForm / useClientEditForm — this component is presentation
 * only, so callers wire it up the same way regardless of mode.
 */

import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DrawerField,
  FormDrawer,
  FormDrawerFooter,
  FormDrawerSection,
  drawerControlClass,
  drawerInputClass,
} from "@/components/shared/form-drawer";
import type { FormPresentation } from "@/features/quote/types";
import type { ClientCreateForm } from "@/features/client/components/hooks/use-client-create-form";
import type { ClientEditForm } from "@/features/client/components/hooks/use-client-edit-form";

interface ClientFormDrawerAddProps {
  mode: "add";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: ClientCreateForm;
  setForm: (updater: (prev: ClientCreateForm) => ClientCreateForm) => void;
  showAddressSection: boolean;
  setShowAddressSection: (open: boolean) => void;
  postcodeSearch: string;
  setPostcodeSearch: (value: string) => void;
  postcodeLoading: boolean;
  postcodeError: string;
  onLookupPostcode: () => void;
  onSubmit: () => void;
  isPending: boolean;
  /** "drawer" renders the right-hand Create / Edit drawer used on the client dashboard. */
  presentation?: FormPresentation;
}

interface ClientFormDrawerEditProps {
  mode: "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editForm: ClientEditForm;
  setEditForm: (form: ClientEditForm) => void;
  onSave: () => void;
  isPending: boolean;
  /** "drawer" renders the right-hand Create / Edit drawer used on the client dashboard. */
  presentation?: FormPresentation;
}

type ClientFormDrawerProps = ClientFormDrawerAddProps | ClientFormDrawerEditProps;

export function ClientFormDrawer(props: ClientFormDrawerProps) {
  if (props.mode === "add") return <ClientAddForm {...props} />;
  return <ClientEditFormView {...props} />;
}

// ─── Add Client ──────────────────────────────────────────────────────────────

function ClientAddForm({
  open,
  onOpenChange,
  form,
  setForm,
  showAddressSection,
  setShowAddressSection,
  postcodeSearch,
  setPostcodeSearch,
  postcodeLoading,
  postcodeError,
  onLookupPostcode,
  onSubmit,
  isPending,
  presentation = "dialog",
}: ClientFormDrawerAddProps) {
  const isDrawer = presentation === "drawer";
  const canSubmit = !!form.firstName && !!form.lastName && !!form.phone;
  const triggerCls = isDrawer ? drawerControlClass : "rounded-xl";
  const inputCls = isDrawer ? drawerInputClass : "rounded-xl";

  const clientTypeField = (
    <Select value={form.clientType} onValueChange={(v) => setForm((f) => ({ ...f, clientType: v }))}>
      <SelectTrigger id="clientType" className={triggerCls} data-testid="select-client-type">
        <SelectValue placeholder="Select client type" />
      </SelectTrigger>
      <SelectContent className={isDrawer ? "z-[500]" : undefined}>
        <SelectItem value="Time Waster">Time Waster</SelectItem>
        <SelectItem value="New Client">New Client</SelectItem>
        <SelectItem value="Repeat Client">Repeat Client</SelectItem>
        <SelectItem value="VIP Client">VIP Client</SelectItem>
        <SelectItem value="Family Member">Family Member</SelectItem>
        <SelectItem value="Banned">Banned</SelectItem>
      </SelectContent>
    </Select>
  );

  const titleField = (
    <Select value={form.title} onValueChange={(v) => setForm((f) => ({ ...f, title: v }))}>
      <SelectTrigger id="title" className={triggerCls} data-testid="select-title">
        <SelectValue placeholder="Select title" />
      </SelectTrigger>
      <SelectContent className={isDrawer ? "z-[500]" : undefined}>
        <SelectItem value="Mr.">Mr.</SelectItem>
        <SelectItem value="Mrs">Mrs</SelectItem>
        <SelectItem value="Ms">Ms</SelectItem>
        <SelectItem value="Miss">Miss</SelectItem>
      </SelectContent>
    </Select>
  );

  const firstNameField = (
    <Input
      id="firstName"
      value={form.firstName}
      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
      className={inputCls}
      data-testid="input-first-name"
    />
  );

  const lastNameField = (
    <Input
      id="lastName"
      value={form.lastName}
      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
      className={inputCls}
      data-testid="input-last-name"
    />
  );

  const phoneField = (
    <Input
      id="phone"
      value={form.phone}
      onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
      className={inputCls}
      data-testid="input-phone"
    />
  );

  const emailField = (
    <Input
      id="email"
      type="email"
      value={form.email}
      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
      className={inputCls}
      data-testid="input-email"
    />
  );

  const postcodeSearchField = (
    <div className="flex gap-2">
      <Input
        id="postcodeSearch"
        value={postcodeSearch}
        onChange={(e) => setPostcodeSearch(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), onLookupPostcode())}
        placeholder="Enter postcode (e.g. SW1A 1AA)"
        className={isDrawer ? `flex-1 ${drawerInputClass}` : "flex-1 rounded-xl"}
        data-testid="input-postcode-search"
      />
      <Button
        type="button"
        onClick={onLookupPostcode}
        disabled={postcodeLoading || !postcodeSearch.trim()}
        className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
        data-testid="button-lookup-postcode"
      >
        {postcodeLoading ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Looking up...
          </span>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Find
          </>
        )}
      </Button>
    </div>
  );

  const houseNumberField = (
    <Input
      id="houseNumber"
      value={form.houseNumber}
      onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
      className={inputCls}
      data-testid="input-house-number"
    />
  );

  const streetField = (
    <Input
      id="street"
      value={form.street}
      onChange={(e) => setForm((f) => ({ ...f, street: e.target.value }))}
      className={inputCls}
      data-testid="input-street"
    />
  );

  const cityField = (
    <Input
      id="city"
      value={form.city}
      onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
      className={inputCls}
      data-testid="input-city"
    />
  );

  const countryField = (
    <Input
      id="country"
      value={form.country}
      onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
      className={inputCls}
      data-testid="input-country"
    />
  );

  const postcodeField = (
    <Input
      id="postcode"
      value={form.postcode}
      onChange={(e) => setForm((f) => ({ ...f, postcode: e.target.value }))}
      className={isDrawer ? drawerInputClass : "w-1/2 rounded-xl"}
      data-testid="input-postcode"
    />
  );

  const postcodeHint = postcodeError && (
    <p className={`text-xs ${postcodeError.includes("found!") ? "text-green-600" : "text-red-500"}`}>
      {postcodeError}
    </p>
  );

  if (isDrawer) {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="New Client"
        description="Add a new client's contact and address details."
        data-testid="client-create-drawer"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-7 pb-6 pt-6">
          <DrawerField label="Client Type">{clientTypeField}</DrawerField>
          <DrawerField label="Title">{titleField}</DrawerField>
          <DrawerField label="First Name *">{firstNameField}</DrawerField>
          <DrawerField label="Last Name *">{lastNameField}</DrawerField>
          <DrawerField label="Phone Number *">{phoneField}</DrawerField>
          <DrawerField label="Email">{emailField}</DrawerField>
        </div>
        <FormDrawerSection
          title="Address (optional)"
          defaultOpen={showAddressSection}
          data-testid="drawer-section-client-address"
        >
          <div className="space-y-4">
            <DrawerField label="Postcode Search">
              {postcodeSearchField}
              {postcodeHint}
            </DrawerField>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <DrawerField label="House Number">{houseNumberField}</DrawerField>
              <DrawerField label="Street">{streetField}</DrawerField>
              <DrawerField label="City">{cityField}</DrawerField>
              <DrawerField label="Country">{countryField}</DrawerField>
              <DrawerField label="Postcode">{postcodeField}</DrawerField>
            </div>
          </div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Create Client"
          isLoading={isPending}
          disabled={!canSubmit}
          hint={canSubmit ? undefined : "Enter a first name, last name and phone number to save."}
          onSubmit={onSubmit}
          data-testid="drawer-footer"
        />
      </FormDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-2xl z-[300]">
        <DialogHeader>
          <DialogTitle>New Client</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="clientType">Client Type</Label>
            {clientTypeField}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            {titleField}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="firstName">First Name *</Label>
              {firstNameField}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lastName">Last Name *</Label>
              {lastNameField}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number *</Label>
            {phoneField}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="email">Email (optional)</Label>
            {emailField}
          </div>
          <button
            type="button"
            onClick={() => setShowAddressSection(!showAddressSection)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
            data-testid="button-toggle-address"
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${showAddressSection ? "rotate-0" : "-rotate-90"}`} />
            Address (optional)
          </button>
          {showAddressSection && (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="postcodeSearch" className="text-xs">Postcode Search</Label>
                {postcodeSearchField}
                {postcodeHint}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="houseNumber" className="text-xs">House Number</Label>
                  {houseNumberField}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="street" className="text-xs">Street</Label>
                  {streetField}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city" className="text-xs">City</Label>
                  {cityField}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country" className="text-xs">Country</Label>
                  {countryField}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                {postcodeField}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" data-testid="button-cancel-client">
            Cancel
          </Button>
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || isPending}
            className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
            data-testid="button-save-client"
          >
            {isPending ? "Creating..." : "Create Client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Client ─────────────────────────────────────────────────────────────

function ClientEditFormView({
  open,
  onOpenChange,
  editForm,
  setEditForm,
  onSave,
  isPending,
  presentation = "dialog",
}: ClientFormDrawerEditProps) {
  const isDrawer = presentation === "drawer";
  const triggerCls = isDrawer ? drawerControlClass : undefined;
  const inputCls = isDrawer ? drawerInputClass : undefined;
  const description = "Update client information below.";

  const titleField = (
    <Select value={editForm.title} onValueChange={(v) => setEditForm({ ...editForm, title: v })}>
      <SelectTrigger id="edit-title" className={triggerCls} data-testid="select-edit-title">
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
  );

  const badgeField = (
    <Select
      value={editForm.badge || "none"}
      onValueChange={(v) => setEditForm({ ...editForm, badge: v === "none" ? "" : v })}
    >
      <SelectTrigger id="edit-badge" className={triggerCls} data-testid="select-edit-badge">
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
  );

  const firstNameField = (
    <Input
      id="edit-firstName"
      value={editForm.firstName}
      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
      className={inputCls}
      data-testid="input-edit-firstName"
    />
  );

  const surenameField = (
    <Input
      id="edit-surename"
      value={editForm.surename}
      onChange={(e) => setEditForm({ ...editForm, surename: e.target.value })}
      className={inputCls}
      data-testid="input-edit-surename"
    />
  );

  const phoneField = (
    <Input
      id="edit-phone"
      value={editForm.phoneNumber}
      onChange={(e) => setEditForm({ ...editForm, phoneNumber: e.target.value })}
      className={inputCls}
      data-testid="input-edit-phone"
    />
  );

  const emailField = (
    <Input
      id="edit-email"
      type="email"
      value={editForm.email}
      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
      className={inputCls}
      data-testid="input-edit-email"
    />
  );

  const dobField = (
    <DatePicker
      value={editForm.DOB}
      onChange={(v) => setEditForm({ ...editForm, DOB: v })}
      placeholder="Pick a date"
      className={triggerCls}
      data-testid="input-edit-dob"
    />
  );

  const houseNumberField = (
    <Input
      id="edit-houseNumber"
      value={editForm.houseNumber}
      onChange={(e) => setEditForm({ ...editForm, houseNumber: e.target.value })}
      className={inputCls}
      data-testid="input-edit-houseNumber"
    />
  );

  const streetField = (
    <Input
      id="edit-street"
      value={editForm.street}
      onChange={(e) => setEditForm({ ...editForm, street: e.target.value })}
      className={inputCls}
      data-testid="input-edit-street"
    />
  );

  const cityField = (
    <Input
      id="edit-city"
      value={editForm.city}
      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
      className={inputCls}
      data-testid="input-edit-city"
    />
  );

  const countryField = (
    <Input
      id="edit-country"
      value={editForm.country}
      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
      className={inputCls}
      data-testid="input-edit-country"
    />
  );

  const postcodeField = (
    <Input
      id="edit-postcode"
      value={editForm.post_code}
      onChange={(e) => setEditForm({ ...editForm, post_code: e.target.value })}
      className={inputCls}
      data-testid="input-edit-postcode"
    />
  );

  if (isDrawer) {
    return (
      <FormDrawer
        open={open}
        onOpenChange={onOpenChange}
        title="Edit Client"
        description={description}
        data-testid="client-edit-drawer"
      >
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-7 pb-6 pt-6">
          <DrawerField label="Title">{titleField}</DrawerField>
          <DrawerField label="Badge">{badgeField}</DrawerField>
          <DrawerField label="First Name">{firstNameField}</DrawerField>
          <DrawerField label="Surname">{surenameField}</DrawerField>
          <DrawerField label="Phone Number">{phoneField}</DrawerField>
          <DrawerField label="Email">{emailField}</DrawerField>
          <DrawerField label="Date of Birth">{dobField}</DrawerField>
        </div>
        <FormDrawerSection title="Address" data-testid="drawer-section-client-address">
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <DrawerField label="House Number">{houseNumberField}</DrawerField>
            <DrawerField label="Street">{streetField}</DrawerField>
            <DrawerField label="City">{cityField}</DrawerField>
            <DrawerField label="Country">{countryField}</DrawerField>
            <DrawerField label="Postcode">{postcodeField}</DrawerField>
          </div>
        </FormDrawerSection>
        <FormDrawerFooter
          submitLabel="Save Changes"
          isLoading={isPending}
          onSubmit={onSave}
          data-testid="drawer-footer"
        />
      </FormDrawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-3xl" data-testid="dialog-edit-client">
        <DialogHeader>
          <DialogTitle>Edit Client</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-title">Title</Label>
              {titleField}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-badge">Badge</Label>
              {badgeField}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-firstName">First Name</Label>
              {firstNameField}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-surename">Surname</Label>
              {surenameField}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-phone">Phone Number</Label>
              {phoneField}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              {emailField}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-dob">Date of Birth</Label>
            {dobField}
          </div>
          <div className="border-t border-black/10 pt-3">
            <div className="text-xs font-semibold text-black/60 mb-2">Address</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-houseNumber">House Number</Label>
                {houseNumberField}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-street">Street</Label>
                {streetField}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-city">City</Label>
                {cityField}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-country">Country</Label>
                {countryField}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-postcode">Postcode</Label>
                {postcodeField}
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
