import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { alsoSells, isHomeworkerMember, isSelf, memberStatus } from "../../lib/member-status";
import { HOMEWORKER_ROLE_LOCK_HINT, roleOptionsForMember } from "../../lib/role-helpers";
import type { ProfileDraftApi } from "../../state/use-profile-draft";
import { RoleSelect } from "../shared/role-select";
import { TEAM_CONTROL, TEAM_LABEL } from "../shared/team-styles";
import { BranchMemberships } from "./branch-memberships";

interface DetailsTabProps {
  member: OrgMember;
  profile: ProfileDraftApi;
  isAdmin: boolean;
  currentUserId: string | null;
  onRoleChange: (member: OrgMember, role: string) => void;
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

export function DetailsTab({ member, profile, isAdmin, currentUserId, onRoleChange }: DetailsTabProps) {
  const self = isSelf(member, currentUserId);
  const homeworker = isHomeworkerMember(member);
  const suspended = memberStatus(member) === "suspended";
  const canEditProfile = isAdmin && !self;
  const roleLocked = !isAdmin || self || homeworker || suspended;
  const { draft, errors, setField } = profile;
  const input = cn(TEAM_CONTROL, "h-11");

  return (
    <div className="space-y-5" data-testid="details-tab">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" error={errors.first}>
          <Input value={draft.first} onChange={(e) => setField("first", e.target.value)} disabled={!canEditProfile} aria-label="First name" aria-invalid={!!errors.first || undefined} className={input} data-testid="input-drawer-first" />
        </Field>
        <Field label="Last name" error={errors.last}>
          <Input value={draft.last} onChange={(e) => setField("last", e.target.value)} disabled={!canEditProfile} aria-label="Last name" aria-invalid={!!errors.last || undefined} className={input} data-testid="input-drawer-last" />
        </Field>
        <Field label="Email" className="sm:col-span-2">
          <Input value={member.user.email} readOnly disabled aria-label="Email" className={input} data-testid="input-drawer-email" />
          <p className="mt-1 text-[12px] text-social-muted">Email is their login and can&apos;t be changed here.</p>
        </Field>
        <Field label="Phone" error={errors.phone} className="sm:col-span-2">
          <Input type="tel" aria-label="Phone" value={draft.phone} onChange={(e) => setField("phone", e.target.value)} disabled={!canEditProfile} placeholder={canEditProfile ? "Add a phone number" : "No phone number"} aria-invalid={!!errors.phone || undefined} className={input} data-testid="input-drawer-phone" />
        </Field>
        {self && (
          <p className="text-[12px] text-social-muted sm:col-span-2">Edit your own details from your profile page.</p>
        )}
      </div>

      <Field label="Role">
        <RoleSelect
          label="Role"
          value={member.user.orgRole ?? "agent"}
          options={roleOptionsForMember(member.user.orgRole)}
          onChange={(role) => onRoleChange(member, role)}
          disabled={roleLocked}
          className="h-11"
          testId="select-drawer-role"
        />
        <p className="mt-1 text-[12px] text-social-muted">
          {self
            ? "You can't change your own role."
            : homeworker
              ? HOMEWORKER_ROLE_LOCK_HINT
              : "Access follows the role. Changing it changes what they can do straight away."}
        </p>
      </Field>

      {alsoSells(member) && (
        <div className="rounded-xl border border-social-border px-4 py-3 text-[13px]" data-testid="also-sells">
          <span className="font-semibold">Also sells.</span>{" "}
          <span className="text-social-muted">They hold the Agent role too, so they take bookings themselves.</span>
        </div>
      )}

      <BranchMemberships member={member} canEdit={isAdmin} suspended={suspended} />

      <div className="rounded-xl border border-social-border px-4 py-3.5">
        <div className="mb-1 text-[13px] font-semibold">Sign-in</div>
        <p className="text-[12px] text-social-muted">
          They sign in with their email and password.{" "}
          {suspended ? "Sign-in is blocked while they are suspended." : "Password resets are not available from this screen."}
        </p>
      </div>
    </div>
  );
}
