import { ArrowDown, ArrowUp, ImageIcon, PlayCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HubBadge } from "@/features/hub/components/hub-components";
import type { LessonType } from "@/features/hub/types/training.types";

interface LessonRowProps {
  /** Persisted lesson id, or a draft lesson's `tempId` — used for keys/testids. */
  id: string;
  title: string;
  type: LessonType;
  isRequired: boolean;
  /** e.g. "3 image(s)" for graphics lessons; omitted for video lessons. */
  mediaBadge?: string;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Disable reorder buttons while a reorder mutation is in flight (persisted list only). */
  reordering?: boolean;
}

/**
 * A single row in a lesson list: reorder arrows, type icon, title/badges,
 * edit/delete actions. Shared by the persisted lesson list (`TrainingLessonEditor`)
 * and the create-mode draft lesson list (`TrainingCourseEditor`).
 */
export function LessonRow({
  id,
  title,
  type,
  isRequired,
  mediaBadge,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  reordering,
}: LessonRowProps) {
  const LessonIcon = type === "video" ? PlayCircle : ImageIcon;

  return (
    <div
      className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
      data-testid={`row-lesson-${id}`}
    >
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0 || reordering}
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
          data-testid={`button-lesson-up-${id}`}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1 || reordering}
          className="text-slate-400 hover:text-slate-700 disabled:opacity-30 dark:hover:text-white"
          data-testid={`button-lesson-down-${id}`}
        >
          <ArrowDown className="h-4 w-4" />
        </button>
      </div>

      <LessonIcon className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{title}</p>
        <div className="mt-0.5 flex items-center gap-1.5">
          <HubBadge>{type}</HubBadge>
          {!isRequired && <HubBadge variant="amber">Optional</HubBadge>}
          {mediaBadge && <HubBadge variant="blue">{mediaBadge}</HubBadge>}
        </div>
      </div>

      <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-lesson-${id}`}>
        Edit
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="text-red-600 hover:text-red-700"
        onClick={onDelete}
        data-testid={`button-delete-lesson-${id}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
