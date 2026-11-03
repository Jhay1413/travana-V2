import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CardHead } from "@/features/admin-dashboard";
import { DlRow, SubHead } from "../shared/profile-bits";

const NONE = "—";

/** Contact details come from the person's own profile, so this card is read-only. */
export function ContactCard({ employee, firstName, className }: { employee: EmployeeDetail; firstName: string; className?: string }) {
  return (
    <HomeCard className={className} testId="hr-contact-card">
      <CardHead id="contact-title" title="Contact" sub={`${firstName} edits contact details on their own profile.`} />
      <dl className="m-0">
        <DlRow label="Email">{employee.email || NONE}</DlRow>
        <DlRow label="Mobile">{employee.phone || NONE}</DlRow>
        <DlRow label="Home address">{employee.address || NONE}</DlRow>
      </dl>
      <SubHead>Emergency contact</SubHead>
      <dl className="m-0 mt-3">
        <DlRow label="Name">{employee.emergencyContactName || NONE}</DlRow>
        <DlRow label="Relationship">{employee.emergencyContactRelationship || NONE}</DlRow>
        <DlRow label="Phone">{employee.emergencyContactPhone || NONE}</DlRow>
      </dl>
    </HomeCard>
  );
}
