import { useLocation } from "wouter";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { HubSectionHeader, HubBadge, HubEmptyState } from "@/features/hub/components/hub-components";
import { Button } from "@/components/ui/button";
import { useAdminCourses, usePublishCourse, useArchiveCourse, useDeleteCourse } from "@/features/hub/api/use-training-admin-mutations";
import { useToast } from "@/hooks/use-toast";
import type { CourseStatus } from "@/features/hub/types/training.types";

const STATUS_VARIANT: Record<CourseStatus, "green" | "amber" | "red"> = {
  published: "green",
  draft: "amber",
  archived: "red",
};

/** Admin landing page: every course in scope (any status) + lifecycle actions. */
export default function TrainingAdmin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: courses = [], isLoading, isError } = useAdminCourses();
  const publishCourse = usePublishCourse();
  const archiveCourse = useArchiveCourse();
  const deleteCourse = useDeleteCourse();

  const handlePublish = (id: string) => {
    publishCourse.mutate(id, {
      onSuccess: () => toast({ title: "Course published" }),
      onError: () => toast({ title: "Failed to publish course", variant: "destructive" }),
    });
  };

  const handleArchive = (id: string) => {
    if (!window.confirm("Archive this course? Learners will no longer be able to enroll.")) return;
    archiveCourse.mutate(id, {
      onSuccess: () => toast({ title: "Course archived" }),
      onError: () => toast({ title: "Failed to archive course", variant: "destructive" }),
    });
  };

  const handleDelete = (id: string, title: string) => {
    if (
      !window.confirm(
        `Permanently delete “${title}”?\n\nThis cannot be undone. It removes the course and all its lessons, quiz, and every learner's enrollment, progress and certificate.`,
      )
    )
      return;
    deleteCourse.mutate(id, {
      onSuccess: () => toast({ title: "Course deleted" }),
      onError: () => toast({ title: "Failed to delete course", variant: "destructive" }),
    });
  };

  return (
    <div data-testid="page-training-admin">
      <HubSectionHeader
        title="Training Admin"
        subtitle="Create and manage training courses."
        action={
          <Button onClick={() => navigate("/hub/training/admin/new")} data-testid="button-new-course">
            <Plus className="mr-1.5 h-4 w-4" /> New course
          </Button>
        }
      />

      {isLoading ? (
        <div
          className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-16 dark:border-slate-800 dark:bg-slate-900"
          data-testid="training-admin-loading"
        >
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : isError ? (
        <HubEmptyState title="Couldn't load courses" description="Please refresh the page to try again." />
      ) : courses.length === 0 ? (
        <HubEmptyState title="No courses yet" description="Create your first training course to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Visibility</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((course) => (
                <tr
                  key={course.id}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  data-testid={`row-course-${course.id}`}
                >
                  <td className="px-5 py-3 font-medium text-slate-900 dark:text-white">{course.title}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-400">
                    {course.visibility === "global" ? "Global" : "Org"}
                  </td>
                  <td className="px-5 py-3">
                    <HubBadge variant={STATUS_VARIANT[course.status]}>{course.status}</HubBadge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/hub/training/admin/${course.id}`)}
                        data-testid={`button-edit-course-${course.id}`}
                      >
                        Edit
                      </Button>
                      {course.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => handlePublish(course.id)}
                          disabled={publishCourse.isPending}
                          data-testid={`button-publish-course-${course.id}`}
                        >
                          Publish
                        </Button>
                      )}
                      {course.status !== "archived" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchive(course.id)}
                          disabled={archiveCourse.isPending}
                          data-testid={`button-archive-course-${course.id}`}
                        >
                          Archive
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(course.id, course.title)}
                        disabled={deleteCourse.isPending}
                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
                        data-testid={`button-delete-course-${course.id}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
