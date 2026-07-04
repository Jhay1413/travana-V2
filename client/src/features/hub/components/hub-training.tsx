import { useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Check, Settings, Target } from "lucide-react";
import { HubSectionHeader, HubBadge, HubEmptyState, HubProgressBar } from "@/features/hub/components/hub-components";
import { useTrainingCourses, useMyEnrollments } from "@/features/hub/api/use-training-queries";
import { TrainingCourseView } from "@/features/hub/components/training-course-view";
import { COURSE_CATEGORIES, type TrainingCourse, type MyEnrollment } from "@/features/hub/types/training.types";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

/** Special filter tab: courses the current user is enrolled in. */
const MY_COURSES_TAB = "My Courses";

/** Cover placeholder shown when a course has no `thumbnail_url`. */
function CourseCoverPlaceholder({ title }: { title: string }) {
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600">
      {initials ? (
        <span className="text-3xl font-bold tracking-wide text-white/90">{initials}</span>
      ) : (
        <BookOpen className="h-10 w-10 text-white/90" />
      )}
    </div>
  );
}

/** Skeleton matching the catalog card shape (cover + lines) for the loading state. */
function TrainingCourseSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-video w-full animate-pulse bg-slate-200 dark:bg-slate-800" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex gap-1.5">
          <div className="h-5 w-14 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="space-y-1.5">
          <div className="h-3 w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        </div>
        <div className="mt-auto h-8 w-full animate-pulse rounded-md bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}

function TrainingCourseCard({
  course,
  index,
  onSelect,
  enrollment,
}: {
  course: TrainingCourse;
  index: number;
  onSelect: () => void;
  /** The current user's enrollment for this course, if they've taken it. */
  enrollment?: MyEnrollment;
}) {
  const isCompleted = enrollment?.status === "completed";
  const buttonLabel = !enrollment ? "Start course" : isCompleted ? "Completed" : "Continue";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      )}
      data-testid={`card-training-${course.id}`}
    >
      <div className="relative aspect-video w-full shrink-0 overflow-hidden">
        {course.thumbnail_url ? (
          <img
            src={course.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <CourseCoverPlaceholder title={course.title} />
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {course.category ? <HubBadge variant="green">{course.category}</HubBadge> : null}
          <HubBadge variant="blue">{course.visibility === "global" ? "Global" : "Org"}</HubBadge>
          <HubBadge variant="amber">
            <Target className="mr-1 h-3 w-3" /> Pass {course.passing_score}%
          </HubBadge>
        </div>

        <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          {course.title}
        </h3>
        {course.description ? (
          <p className="mt-1.5 line-clamp-3 text-xs text-slate-500 dark:text-slate-400">{course.description}</p>
        ) : (
          <p className="mt-1.5 text-xs italic text-slate-400 dark:text-slate-600">No description available.</p>
        )}

        <div className="mt-4 flex-1" />

        {enrollment ? (
          <div className="mb-3" data-testid={`progress-training-${course.id}`}>
            <div className="mb-1 flex items-center justify-between text-[11px] font-medium">
              <span className={cn(isCompleted ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>
                {isCompleted ? "Completed" : "In progress"}
              </span>
              <span className="text-slate-500 dark:text-slate-400">{enrollment.progressPct}%</span>
            </div>
            <HubProgressBar value={enrollment.progressPct} size="sm" />
          </div>
        ) : null}

        <Button
          size="sm"
          className={cn(
            "w-full text-xs text-white transition-colors",
            isCompleted ? "bg-emerald-600 hover:bg-emerald-700" : "bg-blue-600 hover:bg-blue-700"
          )}
          data-testid={`button-start-${course.id}`}
        >
          {buttonLabel}
          {isCompleted ? (
            <Check className="ml-1.5 h-3.5 w-3.5" />
          ) : (
            <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          )}
        </Button>
      </div>
    </motion.div>
  );
}

export default function HubTraining() {
  // Deep link: arriving from the agent dashboard's "My Courses" tab (or any
  // link) with `?course=<id>` opens that course directly. Read once on mount
  // so tapping "Back" returns to the catalog without the param re-opening it.
  const search = useSearch();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    () => new URLSearchParams(search).get("course"),
  );
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [, navigate] = useLocation();
  const { orgRole } = useRole();
  const isPlatformAdmin = orgRole === "platform_admin";
  const { data: courses = [], isLoading, isError } = useTrainingCourses();
  const { data: myEnrollments = [] } = useMyEnrollments();

  const enrolledCourseIds = useMemo(
    () => new Set(myEnrollments.map((e) => e.courseId)),
    [myEnrollments],
  );

  // Course id → the current user's enrollment, for per-card progress + button label.
  const enrollmentByCourseId = useMemo(
    () => new Map(myEnrollments.map((e) => [e.courseId, e])),
    [myEnrollments],
  );

  // Tabs = "All", then "My Courses" (only if the learner has any enrollment),
  // then the categories actually present — known ones first (in their canonical
  // order), then any custom categories. Category is free text server-side.
  const categoryTabs = useMemo(() => {
    const present = new Set(courses.map((c) => c.category).filter(Boolean));
    const known = COURSE_CATEGORIES.filter((c) => present.has(c));
    const extras = [...present].filter((c) => !COURSE_CATEGORIES.includes(c as (typeof COURSE_CATEGORIES)[number])).sort();
    const mine = enrolledCourseIds.size > 0 ? [MY_COURSES_TAB] : [];
    return ["All", ...mine, ...known, ...extras];
  }, [courses, enrolledCourseIds]);

  const visibleCourses = useMemo(() => {
    if (activeCategory === "All") return courses;
    if (activeCategory === MY_COURSES_TAB) return courses.filter((c) => enrolledCourseIds.has(c.id));
    return courses.filter((c) => c.category === activeCategory);
  }, [courses, activeCategory, enrolledCourseIds]);

  if (selectedCourseId) {
    return (
      <div data-testid="page-hub-training-detail">
        <button
          onClick={() => setSelectedCourseId(null)}
          className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-white"
          data-testid="button-back-training"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Training Centre
        </button>

        <TrainingCourseView courseId={selectedCourseId} />
      </div>
    );
  }

  return (
    <div data-testid="page-hub-training">
      <HubSectionHeader
        title="Training Centre"
        subtitle="Develop your skills and knowledge to close more deals."
        action={
          isPlatformAdmin ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/hub/training/admin")}
              data-testid="button-manage-training"
            >
              <Settings className="mr-1.5 h-4 w-4" /> Manage training
            </Button>
          ) : undefined
        }
      />

      {!isLoading && !isError && courses.length > 0 && categoryTabs.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categoryTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveCategory(tab)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                activeCategory === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
              data-testid={`button-training-tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="training-loading">
          {Array.from({ length: 8 }).map((_, i) => (
            <TrainingCourseSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <HubEmptyState title="Couldn't load training" description="Please refresh the page to try again." />
      ) : courses.length === 0 ? (
        <HubEmptyState title="No training available yet" description="Check back soon for new courses." />
      ) : visibleCourses.length === 0 ? (
        <HubEmptyState title="No courses in this category" description="Try another category tab." />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCourses.map((course, i) => (
            <TrainingCourseCard
              key={course.id}
              course={course}
              index={i}
              onSelect={() => setSelectedCourseId(course.id)}
              enrollment={enrollmentByCourseId.get(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
