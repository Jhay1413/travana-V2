import { CalendarDays, LayoutGrid, Plus, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SEGMENTED, SEGMENT_ITEM } from "@/components/ui/segmented";

export type SocialView = "grid" | "calendar";

export interface SocialPageHeaderProps {
  view: SocialView;
  /** e.g. "24 posts · 12 scheduled · 4 drafts · 3 posted". */
  countsLine: string;
  onCreate: () => void;
}

const VIEW_PATHS: Record<SocialView, string> = {
  grid: "/social-posts",
  calendar: "/social-posts/calendar",
};

export { SEGMENTED, SEGMENT_ITEM };

/** Title, counts, Grid/Calendar switch, settings link and the primary Create button. */
export function SocialPageHeader({ view, countsLine, onCreate }: SocialPageHeaderProps) {
  const [, setLocation] = useLocation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-[220px] flex-1">
        <h1 className="text-[24px] font-semibold leading-[1.2]" data-testid="text-social-title">
          Social Posts
        </h1>
        <p className="mt-0.5 min-h-4 text-[12px] text-social-muted" data-testid="text-social-counts">
          {countsLine}
        </p>
      </div>

      <ToggleGroup
        type="single"
        value={view}
        onValueChange={(next) => {
          if (next === "grid" || next === "calendar") setLocation(VIEW_PATHS[next]);
        }}
        className={SEGMENTED}
        aria-label="Switch view"
      >
        <ToggleGroupItem value="grid" aria-label="Grid view" className={SEGMENT_ITEM} data-testid="toggle-view-grid">
          <LayoutGrid className={cn("h-4 w-4", view === "grid" ? "text-social-orange-text" : "text-social-muted")} />
          Grid
        </ToggleGroupItem>
        <ToggleGroupItem value="calendar" aria-label="Calendar view" className={SEGMENT_ITEM} data-testid="toggle-view-calendar">
          <CalendarDays className={cn("h-4 w-4", view === "calendar" ? "text-social-orange-text" : "text-social-muted")} />
          Calendar
        </ToggleGroupItem>
      </ToggleGroup>

      <Button
        asChild
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-[10px] border-social-border bg-card text-social-muted"
        data-testid="link-social-settings"
      >
        <Link href="/social-posts/settings" aria-label="Accounts and defaults">
          <Settings className="h-[18px] w-[18px]" />
        </Link>
      </Button>

      <Button
        type="button"
        onClick={onCreate}
        className="h-10 gap-2 rounded-[10px] border border-social-orange bg-social-orange px-[18px] text-[14px] font-semibold text-[#1F2937] hover:bg-social-orange-text"
        data-testid="button-create-social-post"
      >
        <Plus className="h-4 w-4" />
        Create Social Post
      </Button>
    </div>
  );
}
