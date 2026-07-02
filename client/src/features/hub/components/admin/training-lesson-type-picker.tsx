import { ImageIcon, PlayCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LessonType } from "@/features/hub/types/training.types";

interface LessonTypeOption {
  value: LessonType;
  label: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: LessonTypeOption[] = [
  { value: "video", label: "Video", description: "One MP4/WebM/MOV upload", icon: PlayCircle },
  { value: "graphics", label: "Graphics", description: "A set of images or slides", icon: ImageIcon },
];

interface LessonTypePickerProps {
  value: LessonType;
  onChange: (type: LessonType) => void;
  disabled?: boolean;
}

/**
 * Two-card segmented control for choosing a lesson's content type, replacing
 * a plain `<Select>`. Disabled once a lesson (draft or persisted) already
 * exists, since switching type isn't supported after content has been added.
 */
export function LessonTypePicker({ value, onChange, disabled }: LessonTypePickerProps) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Lesson type" data-testid="lesson-type-picker">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            data-testid={`button-lesson-type-${option.value}`}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors",
              selected
                ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:border-blue-500 dark:bg-blue-500/10"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700",
              disabled && !selected && "cursor-not-allowed opacity-50",
              disabled && selected && "cursor-not-allowed",
            )}
          >
            <Icon className={cn("h-5 w-5", selected ? "text-blue-600 dark:text-blue-400" : "text-slate-400")} />
            <span
              className={cn(
                "text-sm font-medium",
                selected ? "text-blue-700 dark:text-blue-300" : "text-slate-700 dark:text-slate-300",
              )}
            >
              {option.label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}
