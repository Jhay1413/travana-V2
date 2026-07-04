import { useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Gauge,
  GraduationCap,
  PlayCircle,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useMyEnrollments,
  useTrainingCourses,
} from "@/features/hub/api/use-training-queries";
import type {
  MyEnrollment,
  TrainingCourse,
} from "@/features/hub/types/training.types";

/** An enrollment joined with its course row for rendering. */
type EnrolledCourse = { course: TrainingCourse; enrollment: MyEnrollment };

/** Small initials tile used when a course has no thumbnail. */
function CourseThumb({ course }: { course: TrainingCourse }) {
  const initials = course.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  if (course.thumbnail_url) {
    return (
      <img
        src={course.thumbnail_url}
        alt=""
        className="h-full w-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600">
      {initials ? (
        <span className="text-lg font-bold tracking-wide text-white/90">{initials}</span>
      ) : (
        <BookOpen className="h-6 w-6 text-white/90" />
      )}
    </div>
  );
}

/** Compact overview pill (Enrolled / In progress / Completed). */
function StatPill({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  tone: "blue" | "amber" | "emerald";
}) {
  const tones = {
    blue: "text-blue-600 dark:text-blue-400",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
  } as const;
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
      <Icon className={cn("h-4 w-4 shrink-0", tones[tone])} />
      <div className="leading-none">
        <div className="text-base font-bold" data-testid={`stat-value-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {value}
        </div>
        <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-black/45 dark:text-white/45">
          {label}
        </div>
      </div>
    </div>
  );
}

function CourseRow({
  item,
  index,
  onOpen,
}: {
  item: EnrolledCourse;
  index: number;
  onOpen: () => void;
}) {
  const { course, enrollment } = item;
  const isCompleted = enrollment.status === "completed";
  const pct = Math.min(100, Math.max(0, enrollment.progressPct));

  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onOpen}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-black/5 text-left transition",
        "hover:-translate-y-0.5 hover:bg-black/[0.07] hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/[0.07]",
      )}
      data-testid={`card-my-course-${course.id}`}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden">
        <CourseThumb course={course} />
        <span
          className={cn(
            "absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold backdrop-blur-sm",
            isCompleted
              ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-50"
              : "border-amber-500/30 bg-amber-500/20 text-amber-50",
          )}
        >
          {isCompleted ? (
            <>
              <Check className="h-2.5 w-2.5" /> Completed
            </>
          ) : (
            <>
              <PlayCircle className="h-2.5 w-2.5" /> In progress
            </>
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-3">
        {course.category ? (
          <span className="inline-flex w-fit items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
            {course.category}
          </span>
        ) : null}

        <div className="mt-1.5 line-clamp-2 text-sm font-semibold leading-snug text-black/85 group-hover:text-blue-600 dark:text-white/90 dark:group-hover:text-blue-400">
          {course.title}
        </div>

        <div className="mt-auto pt-3">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold tabular-nums">
            <span className={cn(isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-black/45 dark:text-white/45")}>
              {isCompleted ? "Done" : "Progress"}
            </span>
            <span className="text-black/55 dark:text-white/55">{pct}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className={cn(
                "h-full rounded-full",
                isCompleted ? "bg-emerald-500" : "bg-blue-600 dark:bg-blue-500",
              )}
            />
          </div>
        </div>
      </div>
    </motion.button>
  );
}

function CourseCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
      <div className="aspect-video w-full animate-pulse bg-black/10 dark:bg-white/10" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="h-3 w-14 animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-black/10 dark:bg-white/10" />
        <div className="mt-auto h-1.5 w-full animate-pulse rounded-full bg-black/10 dark:bg-white/10" />
      </div>
    </div>
  );
}

export function MyCoursesTab() {
  const [, navigate] = useLocation();
  const { data: enrollments = [], isLoading: loadingEnrollments } = useMyEnrollments();
  const { data: courses = [], isLoading: loadingCourses } = useTrainingCourses();
  const isLoading = loadingEnrollments || loadingCourses;

  const courseById = useMemo(
    () => new Map(courses.map((c) => [c.id, c])),
    [courses],
  );

  // Join enrollments → course rows, dropping any enrollment whose course is no
  // longer published/visible. Completed courses sink below in-progress ones,
  // then the least-finished appear first so the next thing to do is on top.
  const items = useMemo<EnrolledCourse[]>(() => {
    return enrollments
      .map((enrollment) => {
        const course = courseById.get(enrollment.courseId);
        return course ? { course, enrollment } : null;
      })
      .filter((x): x is EnrolledCourse => x !== null)
      .sort((a, b) => {
        const aDone = a.enrollment.status === "completed" ? 1 : 0;
        const bDone = b.enrollment.status === "completed" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.enrollment.progressPct - b.enrollment.progressPct;
      });
  }, [enrollments, courseById]);

  const stats = useMemo(() => {
    const total = items.length;
    const completed = items.filter((i) => i.enrollment.status === "completed").length;
    const inProgress = total - completed;
    const avg =
      total === 0
        ? 0
        : Math.round(items.reduce((s, i) => s + i.enrollment.progressPct, 0) / total);
    return { total, completed, inProgress, avg };
  }, [items]);

  const openCourse = (courseId: string) => navigate(`/hub/training?course=${courseId}`);

  if (isLoading) {
    return (
      <div
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
        data-testid="my-courses-loading"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-6 py-12 text-center dark:border-white/10 dark:bg-white/[0.02]"
        data-testid="my-courses-empty"
      >
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <GraduationCap className="h-6 w-6" />
        </div>
        <div className="mt-3 text-sm font-semibold text-black/80 dark:text-white/85">
          You're not enrolled in any courses yet
        </div>
        <p className="mt-1 max-w-xs text-xs text-black/45 dark:text-white/45">
          Level up your skills — browse the Training Centre and enroll in a course to see your
          progress here.
        </p>
        <button
          type="button"
          onClick={() => navigate("/hub/training")}
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-blue-700"
          data-testid="button-browse-training"
        >
          Browse Training Centre
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="my-courses-tab">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatPill icon={GraduationCap} label="Enrolled" value={stats.total} tone="blue" />
        <StatPill icon={PlayCircle} label="In progress" value={stats.inProgress} tone="amber" />
        <StatPill icon={Trophy} label="Completed" value={stats.completed} tone="emerald" />
        <StatPill icon={Gauge} label="Avg progress" value={`${stats.avg}%`} tone="blue" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {items.map((item, i) => (
          <CourseRow
            key={item.course.id}
            item={item}
            index={i}
            onOpen={() => openCourse(item.course.id)}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => navigate("/hub/training")}
        className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-black/10 bg-black/5 py-2.5 text-xs font-semibold text-black/60 transition hover:bg-black/[0.07] dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/[0.07]"
        data-testid="button-view-all-training"
      >
        View all in Training Centre
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
