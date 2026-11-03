import { HomeCard } from "@/features/agent-overview";
import { AdminProgress, CardHead, CardNote, StatusPill } from "@/features/admin-dashboard";
import { useAgentProfileTraining } from "../../api/use-agent-profile-queries";
import { dayKeyOf, formatDay } from "../../lib/dates";
import { plural } from "../../lib/money";
import type { AgentProfileCourse } from "../../types";
import { EmptyBlock } from "../shared/profile-bits";

function courseMeta(c: AgentProfileCourse): string {
  const lessons = `${c.lessonsCompleted} of ${plural(c.lessonsTotal, "lesson")}`;
  const when = c.completedAt ? `Completed ${formatDay(dayKeyOf(c.completedAt))}` : `Started ${formatDay(dayKeyOf(c.enrolledAt))}`;
  return [lessons, when, c.certificate ? "Certificate issued" : null].filter(Boolean).join(" · ");
}

export function CoursesCard({ userId, className }: { userId: string; className?: string }) {
  const training = useAgentProfileTraining(userId);
  const courses = training.data?.courses ?? [];

  return (
    <HomeCard className={className} testId="agent-profile-courses">
      <CardHead id="courses-title" title="Courses on The Hub" />
      {training.isError ? (
        <CardNote tone="error" testId="courses-error">
          We could not load the courses.
        </CardNote>
      ) : training.isLoading ? (
        <CardNote>Loading...</CardNote>
      ) : courses.length === 0 ? (
        <EmptyBlock title="No courses yet" testId="courses-empty">
          Courses they start on The Hub will be listed here.
        </EmptyBlock>
      ) : (
        <ul className="m-0 list-none divide-y divide-social-border p-0">
          {courses.map((c) => {
            const done = c.status === "completed";
            return (
              <li key={c.enrollmentId} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0" data-testid={`course-${c.enrollmentId}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <b className="text-[14px] font-semibold">{c.title}</b>
                  <StatusPill tone={done ? "good" : "info"}>{done ? "Completed" : "In progress"}</StatusPill>
                </div>
                <div className="text-[12px] text-social-muted xl:text-[13px]">{courseMeta(c)}</div>
                <AdminProgress pct={c.progressPct} tone="navy" label={`${c.title} progress`} />
              </li>
            );
          })}
        </ul>
      )}
    </HomeCard>
  );
}
