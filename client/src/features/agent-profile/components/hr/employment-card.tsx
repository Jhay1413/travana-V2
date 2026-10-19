import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CARD_BUTTON, CardHead } from "@/features/admin-dashboard";
import { formatDay } from "../../lib/dates";
import type { AgentProfileHeader } from "../../types";
import { DlRow } from "../shared/profile-bits";

const NONE = "—";
const day = (v: string | null | undefined): string => (v ? formatDay(v) : NONE);

function salaryText(employee: EmployeeDetail): string {
  if (!employee.salary) return NONE;
  return `${employee.salary} ${employee.salaryCurrency ?? ""}`.trim();
}

/** Employees see Employment; homeworkers see Engagement. Edit opens the HR edit dialog. */
export function EmploymentCard({
  header,
  employee,
  onEdit,
  className,
}: {
  header: AgentProfileHeader;
  employee: EmployeeDetail;
  onEdit: () => void;
  className?: string;
}) {
  const { isHomeworker, viewer, homeworker } = header;
  const share = viewer.canSeePay ? (homeworker?.profitSharePercent ?? null) : null;

  return (
    <HomeCard className={className} testId="hr-employment-card">
      <CardHead
        id="employment-title"
        title={isHomeworker ? "Engagement" : "Employment"}
        right={
          <button type="button" className={CARD_BUTTON} onClick={onEdit} data-testid="button-hr-edit-employment">
            Edit
          </button>
        }
      />
      <dl className="m-0">
        {isHomeworker ? (
          <>
            <DlRow label="Engagement">Self-employed homeworker</DlRow>
            {viewer.canSeePay && (
              <DlRow label="Commission split">{share === null ? NONE : `${share}% to the homeworker, ${100 - share}% to the agency`}</DlRow>
            )}
            <DlRow label="Manager">{employee.managerName || NONE}</DlRow>
            <DlRow label="Start date">{day(employee.startDate)}</DlRow>
          </>
        ) : (
          <>
            <DlRow label="Contract">{employee.contractType || NONE}</DlRow>
            <DlRow label="Employment type">{employee.employmentType || NONE}</DlRow>
            <DlRow label="Reports to">{employee.managerName || NONE}</DlRow>
            <DlRow label="Start date">{day(employee.startDate)}</DlRow>
            <DlRow label="Probation ends">{day(employee.probationEnd)}</DlRow>
            <DlRow label="Contract ends">{day(employee.contractEndDate)}</DlRow>
            {viewer.canSeePay && <DlRow label="Salary">{salaryText(employee)}</DlRow>}
          </>
        )}
      </dl>
    </HomeCard>
  );
}
