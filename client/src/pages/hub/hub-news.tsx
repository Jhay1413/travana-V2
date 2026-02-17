import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Pin,
  Plus,
  Send,
} from "lucide-react";
import { HubSectionHeader, HubAvatar, HubBadge } from "@/components/hub-components";
import { newsPosts } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HubRole } from "@/data/hub-mock";

const CATEGORY_COLORS: Record<string, "blue" | "green" | "amber" | "red"> = {
  Supplier: "blue",
  Target: "red",
  Incentive: "green",
  Training: "amber",
};

export default function HubNews({ role = "Senior Agent" }: { role?: HubRole }) {
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? newsPosts
    : newsPosts.filter((p) => p.category === activeFilter);

  const sortedPosts = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  return (
    <div data-testid="page-hub-news">
      <HubSectionHeader
        title="News & Announcements"
        subtitle="Stay up to date with the latest from the team."
        action={
          role === "Owner" ? (
            <Button className="bg-blue-600 text-white hover:bg-blue-700" data-testid="button-post-news">
              <Plus className="mr-2 h-4 w-4" /> Post Announcement
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {["All", "Supplier", "Target", "Incentive", "Training"].map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveFilter(cat)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-all",
              activeFilter === cat
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
            data-testid={`button-filter-${cat.toLowerCase()}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mx-auto max-w-2xl space-y-4">
        {sortedPosts.map((post, i) => (
          <motion.div
            key={post.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900",
              post.pinned
                ? "border-blue-200 dark:border-blue-500/20"
                : "border-slate-200 dark:border-slate-800"
            )}
            data-testid={`card-news-${post.id}`}
          >
            <div className="flex items-start gap-3">
              <HubAvatar initials={post.avatar} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{post.author}</span>
                  <span className="text-xs text-slate-400">{post.role}</span>
                  <HubBadge variant={CATEGORY_COLORS[post.category] || "default"}>{post.category}</HubBadge>
                  {post.pinned && (
                    <Pin className="h-3 w-3 text-blue-500" />
                  )}
                </div>
                <p className="text-xs text-slate-400">{post.date}</p>
              </div>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">{post.content}</p>

            {post.comments.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                  <MessageCircle className="h-3 w-3" /> {post.comments.length} Comments
                </div>
                {post.comments.map((c, j) => (
                  <div key={j} className="flex gap-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
                    <HubAvatar initials={c.author.split(" ").map((w) => w[0]).join("")} size="sm" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{c.author}</span>
                        <span className="text-[10px] text-slate-400">{c.date}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3 flex gap-2">
              <Input
                placeholder="Add a comment..."
                value={commentText[post.id] || ""}
                onChange={(e) => setCommentText({ ...commentText, [post.id]: e.target.value })}
                className="text-xs dark:border-slate-700 dark:bg-slate-800"
                data-testid={`input-comment-${post.id}`}
              />
              <Button size="sm" variant="ghost" className="shrink-0 text-blue-600 dark:text-blue-400" data-testid={`button-send-comment-${post.id}`}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
