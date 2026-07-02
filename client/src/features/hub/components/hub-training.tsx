import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, BookOpen, Settings, Target } from "lucide-react";
import { HubSectionHeader, HubBadge, HubEmptyState } from "@/features/hub/components/hub-components";
import { useTrainingCourses } from "@/features/hub/api/use-training-queries";
import { TrainingCourseView } from "@/features/hub/components/training-course-view";
import type { TrainingCourse } from "@/features/hub/types/training.types";
import { Button } from "@/components/ui/button";
import { useRole } from "@/hooks/use-role";
import { cn } from "@/lib/utils";

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
}: {
  course: TrainingCourse;
  index: number;
  onSelect: () => void;
}) {
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

        <Button
          size="sm"
          className="w-full bg-blue-600 text-xs text-white transition-colors hover:bg-blue-700"
          data-testid={`button-start-${course.id}`}
        >
          Start course
          <ArrowRight className="ml-1.5 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export default function HubTraining() {
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const { orgRole } = useRole();
  const isPlatformAdmin = orgRole === "platform_admin";
  const { data: courses = [], isLoading, isError } = useTrainingCourses();

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
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course, i) => (
            <TrainingCourseCard
              key={course.id}
              course={course}
              index={i}
              onSelect={() => setSelectedCourseId(course.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
