import { Link } from "wouter";
import { useAnnouncements } from "@/features/announcement/api/use-announcement-queries";
import { timeAgo } from "./dashboard-ui";
import { EmptyLine, HomeCard, HomeLink, HomePill } from "./home/home-ui";

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
    .slice(0, 3);

  return (
    <HomeCard
      title="Latest News"
      testId="card-dashboard-news"
      right={
        <HomeLink href="/hub/news" testId="link-view-all-news">
          View all news
        </HomeLink>
      }
    >
      {isLoading ? (
        <EmptyLine>Loading latest news…</EmptyLine>
      ) : latest.length === 0 ? (
        <EmptyLine>No latest news yet.</EmptyLine>
      ) : (
        <div className="space-y-4">
          {latest.map((n) => {
            const title = n.title?.trim() || stripHtml(n.content).slice(0, 90);
            const category = (n as { category?: string | null }).category;
            return (
              <div key={n.id} data-testid={`news-item-${n.id}`}>
                <HomePill className="bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                  {prettyCategory(category)}
                </HomePill>
                <Link href="/hub/news" className="mb-1 mt-2.5 block truncate text-[13px] font-semibold hover:underline xl:text-[14px]">
                  {title}
                </Link>
                <div className="text-[11px] text-social-muted xl:text-[12px]">
                  {timeAgo(n.createdAt)} · <HomeLink href="/hub/news">Read more</HomeLink>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </HomeCard>
  );
}
