import { Clock, Pencil } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import type { SocialPostStatus } from "@/features/social/lib/post-status";
import { cn } from "@/lib/utils";
import { whenLabel } from "./card-fields";

interface PostCardStatusBarProps {
  status: SocialPostStatus;
  postSchedule: string | null | undefined;
  isGenerating: boolean;
  onSchedule: () => void;
  onGenerate: () => void;
}

const BAR = "flex items-center gap-2 rounded-xl text-[13px]";
const DASHED = cn(BAR, "justify-between border-[1.5px] border-dashed border-[#C9D2DF] py-1.5 pl-3 pr-1.5 text-social-muted dark:border-border");
const ACTION = "inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-3 text-[12.5px] font-semibold disabled:opacity-60";

/** One-line schedule state strip at the bottom of a card body. */
export function PostCardStatusBar({ status, postSchedule, isGenerating, onSchedule, onGenerate }: PostCardStatusBarProps) {
  if (status === "scheduled") {
    return (
      <div
        className={cn(
          BAR,
          "border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-[9px] text-[#065F46] dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
        )}
      >
        <Clock className="h-4 w-4 text-[#047857] dark:text-emerald-300" />
        <span className="font-semibold">{whenLabel(postSchedule)}</span>
      </div>
    );
  }
  if (status === "posted") {
    const when = whenLabel(postSchedule);
    return (
      <div
        className={cn(
          BAR,
          "border border-[#BFDBFE] bg-[#EFF6FF] px-3 py-[9px] text-[#1E40AF] dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200",
        )}
      >
        {when ? (
          <span>
            Posted <span className="font-bold">{when}</span>
          </span>
        ) : (
          <span>Posted</span>
        )}
      </div>
    );
  }
  if (status === "draft") {
    return (
      <div className={DASHED}>
        <span className="flex items-center gap-2">
          <Pencil className="h-[15px] w-[15px]" />
          Not scheduled
        </span>
        <button
          type="button"
          onClick={onSchedule}
          className={cn(ACTION, "border-social-orange bg-[#FFFBEB] text-[#92400E] dark:bg-amber-950/40 dark:text-amber-200")}
        >
          Schedule
        </button>
      </div>
    );
  }
  return (
    <div className={DASHED}>
      <span>No post yet</span>
      <button
        type="button"
        disabled={isGenerating}
        onClick={onGenerate}
        className={cn(ACTION, "border-social-border bg-card text-foreground")}
      >
        {isGenerating && <Spinner className="h-3 w-3" />}
        Generate post
      </button>
    </div>
  );
}
