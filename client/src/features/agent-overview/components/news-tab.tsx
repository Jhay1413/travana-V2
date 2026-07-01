import { ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useAnnouncements } from "@/features/announcement/api/use-announcement-queries";

function timeAgo(date?: string | Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function NewsTab() {
  const { data: announcements, isLoading } = useAnnouncements("latest_news");

  const latest = (announcements || [])
    .slice()
    .sort(
      (a, b) =>
        Number(!!b.pinned) - Number(!!a.pinned) ||
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
    )
    .slice(0, 8);

  if (isLoading) {
    return (
      <div className="py-8 text-center text-sm text-black/55 dark:text-white/55">
        Loading latest news…
      </div>
    );
  }

  if (latest.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-black/55 dark:text-white/55">
        No latest news yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {latest.map((n) => {
        const title = n.title?.trim() || stripHtml(n.content).slice(0, 90);
        return (
          <Link
            key={n.id}
            href="/hub/news"
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 p-3 transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            data-testid={`news-item-${n.id}`}
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{title}</div>
              <div className="text-xs text-black/55 dark:text-white/55">
                {n.authorName || "TheHUB"} · {timeAgo(n.createdAt)}
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-black/40 dark:text-white/40" />
          </Link>
        );
      })}
    </div>
  );
}
