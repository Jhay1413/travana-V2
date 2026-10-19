import { useHrEmployee } from "@/hooks/queries";
import type { AgentProfileHeader } from "../../types";
import { SectionHead } from "../shared/profile-bits";
import { CertificatesCard } from "./certificates-card";
import { CoursesCard } from "./courses-card";
import { LeaveCalendarCard } from "./leave-calendar-card";

export function TrainingTab({ header, todayKey }: { header: AgentProfileHeader; todayKey: string }) {
  const { user, isHomeworker } = header;
  const hr = useHrEmployee(user.id);

  return (
    <div className="flex flex-col gap-3" data-testid="agent-profile-training">
      <SectionHead
        title="Training and attendance"
        sub={isHomeworker ? "Courses and certificates from The Hub." : "Courses and certificates from The Hub, and attendance from the leave record."}
      />
      <div className="grid grid-cols-1 gap-4 min-[1101px]:grid-cols-12">
        <CoursesCard userId={user.id} className="min-[1101px]:col-span-7" />
        <CertificatesCard
          userId={user.id}
          employee={hr.data}
          isLoading={hr.isLoading}
          isError={hr.isError}
          todayKey={todayKey}
          className="min-[1101px]:col-span-5"
        />
        <LeaveCalendarCard
          firstName={user.firstName}
          isHomeworker={isHomeworker}
          branches={header.branches}
          employee={hr.data}
          isLoading={hr.isLoading}
          isError={hr.isError}
          todayKey={todayKey}
        />
      </div>
    </div>
  );
}
