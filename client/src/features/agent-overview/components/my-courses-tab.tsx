import { useMemo } from "react";
import { useLocation } from "wouter";
import { useMyEnrollments, useTrainingCourses } from "@/features/hub/api/use-training-queries";
import type { MyEnrollment, TrainingCourse } from "@/features/hub/types/training.types";
import { EmptyLine, HomeLink, RowButton } from "./home/home-ui";

const SHOWN = 4;

/** An enrollment joined with its course row for rendering. */
type EnrolledCourse = { course: TrainingCourse; enrollment: MyEnrollment };

function CourseRow({ item, onOpen }: { item: EnrolledCourse; onOpen: () => void }) {
  const { course, enrollment } = item;
  const pct = Math.min(100, Math.max(0, enrollment.progressPct));
  return (
    <RowButton
      onActivate={onOpen}
      className="flex items-center gap-3.5 rounded-none border-t border-social-border py-3 hover:bg-social-page"
      testId={`card-my-course-${course.id}`}
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold xl:text-[14px]">{course.title}</div>
        {course.category && <div className="text-[11px] text-social-muted xl:text-[12px]">{course.category}</div>}
        <div className="mt-2 h-[5px] max-w-[260px] overflow-hidden rounded-[3px] bg-social-border">
          <div className="h-full bg-social-orange" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="whitespace-nowrap text-[12px] font-semibold text-social-orange-text xl:text-[13px]">
        {pct > 0 ? `Resume · ${pct}%` : "Start"}
      </span>
    </RowButton>
  );
}

export function MyCoursesTab() {
  const [, navigate] = useLocation();
  const { data: enrollments = [], isLoading: loadingEnrollments } = useMyEnrollments();
  const { data: courses = [], isLoading: loadingCourses } = useTrainingCourses();
  const isLoading = loadingEnrollments || loadingCourses;

  const courseById = useMemo(() => new Map(courses.map((c) => [c.id, c])), [courses]);

  // Join enrollments to course rows (dropping courses that are no longer visible),
  // keep what is still to finish, most-progressed first so the next thing to resume is on top.
  const items = useMemo<EnrolledCourse[]>(
    () =>
      enrollments
        .map((enrollment) => {
          const course = courseById.get(enrollment.courseId);
          return course ? { course, enrollment } : null;
        })
        .filter((x): x is EnrolledCourse => x !== null && x.enrollment.status !== "completed")
        .sort((a, b) => b.enrollment.progressPct - a.enrollment.progressPct)
        .slice(0, SHOWN),
    [enrollments, courseById],
  );

  if (isLoading) {
    return <EmptyLine testId="my-courses-loading">Loading courses…</EmptyLine>;
  }

  return (
    <div className="flex flex-col" data-testid="my-courses-tab">
      {items.length === 0 ? (
        <div data-testid="my-courses-empty">
          <EmptyLine>You have no courses in progress.</EmptyLine>
          <button
            type="button"
            onClick={() => navigate("/hub/training")}
            className="rounded-lg bg-social-orange px-3.5 py-2 text-[13px] font-semibold text-slate-900 hover:bg-social-orange/90"
            data-testid="button-browse-training"
          >
            Browse Training Centre
          </button>
        </div>
      ) : (
        items.map((item) => (
          <CourseRow key={item.course.id} item={item} onOpen={() => navigate(`/hub/training?course=${item.course.id}`)} />
        ))
      )}
      <div className="mt-3.5">
        <HomeLink href="/hub/training" testId="button-view-all-training">
          All courses
        </HomeLink>
      </div>
    </div>
  );
}
