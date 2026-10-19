import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { CardNote } from "@/features/admin-dashboard";
import { EmployeeEditDialog } from "@/features/hr-v2";
import { useHrEmployee } from "@/hooks/queries";
import { agentProfileKeys } from "../../api/use-agent-profile-queries";
import type { AgentProfileHeader } from "../../types";
import { SectionHead } from "../shared/profile-bits";
import { ContactCard } from "./contact-card";
import { DocumentsCard } from "./documents-card";
import { EmploymentCard } from "./employment-card";
import { HolidayCard } from "./holiday-card";
import { LockLine } from "./lock-line";
import { NotesCard } from "./notes-card";

/** Owners, admins and branch managers only. Pay and payout details are for owners and admins. */
export function HrTab({ header, todayKey }: { header: AgentProfileHeader; todayKey: string }) {
  const { user, viewer } = header;
  const hr = useHrEmployee(user.id);
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const employee = hr.data;

  return (
    <div className="flex flex-col gap-3" data-testid="agent-profile-hr">
      <SectionHead title="HR" />
      <LockLine firstName={user.firstName} canSeePay={viewer.canSeePay} />
      {hr.isError ? (
        <CardNote tone="error" testId="hr-error">
          We could not load the HR record for {user.firstName}. They may not have one yet.
        </CardNote>
      ) : !employee ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 min-[1101px]:grid-cols-12">
            <ContactCard employee={employee} firstName={user.firstName} className="min-[1101px]:col-span-5" />
            <EmploymentCard header={header} employee={employee} onEdit={() => setEditing(true)} className="min-[1101px]:col-span-7" />
            <DocumentsCard userId={user.id} employee={employee} todayKey={todayKey} className="min-[1101px]:col-span-7" />
            <HolidayCard header={header} employee={employee} todayKey={todayKey} className="min-[1101px]:col-span-5" />
            <NotesCard userId={user.id} employee={employee} className="min-[1101px]:col-span-12" />
          </div>
          <EmployeeEditDialog open={editing} employee={employee} onClose={(changed) => {
              setEditing(false);
              // Start date and contract can change the profile header (started line).
              if (changed) qc.invalidateQueries({ queryKey: agentProfileKeys.header(user.id) });
            }} />
        </>
      )}
    </div>
  );
}
