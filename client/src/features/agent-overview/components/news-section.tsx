import { Link } from "wouter";
import { MoveRight } from "lucide-react";
import { useAnnouncements } from "@/features/announcement/api/use-announcement-queries";
import { DashboardCard, timeAgo } from "./dashboard-ui";

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function prettyCategory(category?: string | null): string {
  if (!category) return "News";
  return category
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function NewsSection() {
  const { data: announcements, isLoading } = useAnnouncements("latest_news");

  const latest = (announcements || [])
    .slice()
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
    .slice(0, 5);

  return (
    <DashboardCard className="min-w-0" testId="card-dashboard-news">
      <div className="flex items-center justify-between gap-2">
        <div className="text-base font-semibold">Latest News</div>
        <Link
          href="/hub/news"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          data-testid="link-view-all-news"
        >
          View all news <MoveRight className="h-5 w-5 text-[#fe9a00]" strokeWidth={1} />
        </Link>
      </div>

      <div className="mt-4 space-y-4">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading latest news…</div>
        ) : latest.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No latest news yet.</div>
        ) : (
          latest.map((n) => {
            const title = n.title?.trim() || stripHtml(n.content).slice(0, 90);
            const summary = stripHtml(n.content).slice(0, 120);
            return (
              <div key={n.id} className="group" data-testid={`news-item-${n.id}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-md border border-purple-300 bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:border-purple-500/40 dark:bg-purple-500/10 dark:text-purple-300">
                    {prettyCategory((n as any).category)}
                  </span>
                  <span className="shrink-0 text-[11px] text-black/40 dark:text-white/40">
                    {timeAgo(n.createdAt)}
                  </span>
                </div>
                <Link
                  href="/hub/news"
                  className="mt-1.5 block truncate text-sm font-semibold hover:underline"
                >
                  {title}
                </Link>
                {summary && (
                  <div className="mt-0.5 line-clamp-1 text-xs text-black/50 dark:text-white/50">
                    {summary}
                  </div>
                )}
                <Link
                  href="/hub/news"
                  className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-black/45 hover:text-black dark:text-white/45 dark:hover:text-white"
                >
                  Read more <MoveRight className="h-4 w-4 text-[#fe9a00]" strokeWidth={1} />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </DashboardCard>
  );
}
