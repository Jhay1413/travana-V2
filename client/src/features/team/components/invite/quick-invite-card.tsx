import { Loader2, Mail } from "lucide-react";
import { useLocation } from "wouter";
import { HomeworkerInviteFields } from "@/features/homeworkers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { roleLabel } from "../../lib/role-helpers";
import { useSingleInvite } from "../../state/use-single-invite";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import type { BranchOption, ValidationContext } from "../../lib/invite-rows";
import { BranchSelect } from "../shared/branch-select";
import { RoleSelect } from "../shared/role-select";
import { TEAM_CARD, TEAM_CONTROL } from "../shared/team-styles";

export const INVITE_PAGE_PATH = "/agency/team/invite";

interface QuickInviteCardProps {
  ctx: ValidationContext;
  branchOptions: BranchOption[];
  allowedRoles: readonly InviteOrgRole[];
}

/** "Invite a teammate": email, branch and role in one row. Names are filled in when they set up their profile. */
export function QuickInviteCard({ ctx, branchOptions, allowedRoles }: QuickInviteCardProps) {
  const [, navigate] = useLocation();
  const form = useSingleInvite(ctx, { withNames: false });
  const branchLocked = !!ctx.lockedBranchId;
  const noBranches = branchOptions.length === 0 && !form.homeworker;
  const roles = allowedRoles.map((value) => ({ value, label: roleLabel(value) }));

  return (
    <section className={cn(TEAM_CARD, "p-5 xl:p-6")} aria-label="Invite a teammate" data-testid="quick-invite">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold">Invite a teammate</h2>
        <button
          type="button"
          onClick={() => navigate(INVITE_PAGE_PATH)}
          className="text-[13px] font-semibold text-social-orange-text hover:underline"
          data-testid="link-more-options"
        >
          More options
        </button>
      </div>
      {noBranches && (
        <p className="mb-3 rounded-[10px] bg-ticket-amber-bg px-3 py-2 text-[12px] text-ticket-amber-fg" role="status">
          {branchLocked
            ? "Your branch is no longer active. Ask an admin to reactivate it before inviting."
            : "You need at least one active branch before inviting members."}
        </p>
      )}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          form.submit();
        }}
        className="flex flex-wrap items-center gap-3"
      >
        <Input
          type="email"
          value={form.values.email}
          onChange={(e) => form.setEmail(e.target.value)}
          placeholder="email@company.com"
          aria-label="Email address to invite"
          aria-invalid={!!form.errors.email || undefined}
          disabled={form.pending || noBranches}
          className={cn(TEAM_CONTROL, "h-11 min-w-[220px] flex-[1_1_240px]", form.errors.email && "border-status-failed-fg")}
          data-testid="input-invite-email"
        />
        <div className="min-w-[180px] flex-[0_1_230px]">
          <BranchSelect
            label="Branch for the invite"
            value={form.homeworker ? "" : form.values.branchId}
            options={branchOptions}
            onChange={form.setBranchId}
            disabled={form.pending || form.homeworker || branchLocked}
            emptyLabel={form.homeworker ? "Own homeworker branch" : "Select branch"}
            title={branchLocked ? "You can only invite to your own branch" : undefined}
            invalid={!!form.errors.branch}
            className="h-11"
            testId="select-invite-branch"
          />
        </div>
        <div className="min-w-[180px] flex-[0_1_230px]">
          <RoleSelect
            label="Role for the invite"
            value={form.values.role}
            options={roles}
            onChange={(v) => form.setRole(v as InviteOrgRole)}
            disabled={form.pending}
            className="h-11"
            testId="select-invite-role"
          />
        </div>
        <Button type="submit" className={cn(PRIMARY_ACTION, "h-11")} disabled={form.pending || noBranches} data-testid="button-send-invite">
          {form.pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Send invite
        </Button>
      </form>
      {form.homeworker && (
        <div className="mt-3 grid gap-3 md:grid-cols-2" data-testid="quick-homeworker-fields">
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
      {form.formError ? (
        <p className="mt-2 text-[12px] text-status-failed-fg" role="alert" data-testid="invite-error">
          {form.formError}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-social-muted">
          They&apos;ll get an email with a 7-day link to set their password and finish their profile. Need an Owner / Admin? Invite as Branch Manager or Agent, then change the role.
        </p>
      )}
    </section>
  );
}
