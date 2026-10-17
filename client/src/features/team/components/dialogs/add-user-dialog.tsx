import { useEffect } from "react";
import { Loader2, Mail } from "lucide-react";
import { HomeworkerInviteFields } from "@/features/homeworkers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { useOrgSeats } from "@/features/organization/api/use-organization-queries";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import type { ValidationContext, BranchOption } from "../../lib/invite-rows";
import { roleLabel } from "../../lib/role-helpers";
import { PERMISSION_COUNT, REFERRAL_NOTE, permissionCount, roleDisplay } from "../../lib/role-permissions";
import { seatsAfter } from "../../lib/seat-math";
import { useSingleInvite } from "../../state/use-single-invite";
import { BranchSelect } from "../shared/branch-select";
import { RoleSelect } from "../shared/role-select";
import { TEAM_CONTROL, TEAM_LABEL } from "../shared/team-styles";

interface AddUserDialogProps {
  open: boolean;
  onClose: () => void;
  onMore: () => void;
  onUpload: () => void;
  ctx: ValidationContext;
  branchOptions: BranchOption[];
  allowedRoles: readonly InviteOrgRole[];
}

function Field({ label, error, children, className }: { label: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className={TEAM_LABEL}>{label}</div>
      {children}
      {error && (
        <p className="mt-1 text-[12px] text-status-failed-fg" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function AddUserDialog({ open, onClose, onMore, onUpload, ctx, branchOptions, allowedRoles }: AddUserDialogProps) {
  const form = useSingleInvite(ctx, { withNames: true, onSent: onClose });
  const { data: seats } = useOrgSeats({ enabled: open });
  const { reset } = form;

  // Start clean (no old values or errors) each time the dialog opens.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);
  const branchLocked = !!ctx.lockedBranchId;
  const roles = allowedRoles.map((value) => ({ value, label: roleLabel(value) }));
  const role = form.values.role;
  const display = roleDisplay(role);
  const count = permissionCount(role);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !form.pending && onClose()}>
      <DialogContent className="max-h-[calc(100vh-3rem)] max-w-[560px] overflow-y-auto rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="add-user-dialog">
        <div>
          <DialogTitle className="text-[20px] font-semibold">Add a team member</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-social-muted">
            They&apos;ll get an email with a 7-day link to set their password.
          </DialogDescription>
        </div>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            form.submit();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="First name" error={form.errors.first}>
            <Input value={form.values.first} onChange={(e) => form.setFirst(e.target.value)} placeholder="e.g. Sarah" aria-label="First name" autoFocus aria-invalid={!!form.errors.first || undefined} className={cn(TEAM_CONTROL, "h-11")} data-testid="input-add-first" />
          </Field>
          <Field label="Last name" error={form.errors.last}>
            <Input value={form.values.last} onChange={(e) => form.setLast(e.target.value)} placeholder="e.g. Khan" aria-label="Last name" aria-invalid={!!form.errors.last || undefined} className={cn(TEAM_CONTROL, "h-11")} data-testid="input-add-last" />
          </Field>
          <Field label="Email address" error={form.errors.email} className="sm:col-span-2">
            <Input type="email" value={form.values.email} onChange={(e) => form.setEmail(e.target.value)} placeholder="name@company.com" aria-label="Email address" aria-invalid={!!form.errors.email || undefined} className={cn(TEAM_CONTROL, "h-11")} data-testid="input-add-email" />
          </Field>
          <Field label="Role" error={form.errors.role}>
            <RoleSelect label="Role" value={role} options={roles} onChange={(v) => form.setRole(v as InviteOrgRole)} className="h-11" testId="select-add-role" />
          </Field>
          <Field label="Branch" error={form.errors.branch}>
            <BranchSelect
              label="Branch"
              value={form.homeworker ? "" : form.values.branchId}
              options={branchOptions}
              onChange={form.setBranchId}
              disabled={form.homeworker || branchLocked}
              emptyLabel={form.homeworker ? "Own homeworker branch" : "Select branch"}
              invalid={!!form.errors.branch}
              className="h-11"
              testId="select-add-branch"
            />
          </Field>
          {form.homeworker && (
            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2" data-testid="add-homeworker-fields">
              <HomeworkerInviteFields
                share={form.share.value}
                onShareChange={form.share.setValue}
                shareError={form.share.error}
                displayName={form.displayName}
                onDisplayNameChange={form.setDisplayName}
                disabled={form.pending}
              />
            </div>
          )}
          <div className="rounded-xl border border-social-border bg-muted/40 px-4 py-3 sm:col-span-2" data-testid="add-role-info">
            <div className="text-[13px] font-semibold">
              Starts with {display.label} access{role === "referral_agent" ? ` (${REFERRAL_NOTE})` : ""}
            </div>
            <div className="text-[12px] text-social-muted">
              {role === "referral_agent" ? display.blurb : `${count} of ${PERMISSION_COUNT} permissions. ${display.blurb}.`} Access follows the role, so change the role to change access. Need an Owner / Admin? Invite as Branch Manager or Agent, then change the role.
            </div>
          </div>
          {form.formError && !Object.keys(form.errors).length && (
            <p className="text-[12px] text-status-failed-fg sm:col-span-2" role="alert" data-testid="add-error">
              {form.formError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
            <div className="text-[12px] text-social-muted">
              <button type="button" onClick={onUpload} className="font-semibold text-social-orange-text hover:underline">
                Upload a spreadsheet instead
              </button>
              <button type="button" onClick={onMore} className="ml-4 font-semibold text-social-orange-text hover:underline">
                Add several people
              </button>
              {seats && (
                <div className="mt-1" data-testid="add-seat-note">
                  Uses 1 seat ({seats.used} to {seatsAfter(seats.used, 1)}
                  {seats.limit !== null ? ` of ${seats.limit}` : ""})
                </div>
              )}
            </div>
            <div className="flex gap-2.5">
              <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onClose} disabled={form.pending}>
                Cancel
              </Button>
              <Button type="submit" className={PRIMARY_ACTION} disabled={form.pending} data-testid="button-add-send">
                {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Send invite
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
