import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  Filter,
  Heart,
  Search,
  User,
} from "lucide-react";
import { HubSectionHeader, HubBadge, HubAvatar } from "@/components/hub-components";
import { knowledgeEntries } from "@/data/hub-mock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const TABS = ["All", "Destination Guides", "Hotel Insights", "Sales Playbooks", "Supplier Notes", "Blogs"] as const;

export default function HubKnowledge() {
  const [activeTab, setActiveTab] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "popular">("recent");
  const [savedItems, setSavedItems] = useState<Set<string>>(
    new Set(knowledgeEntries.filter((e) => e.saved).map((e) => e.id))
  );

  const filtered = useMemo(() => {
    let items = [...knowledgeEntries];
    if (activeTab !== "All") items = items.filter((e) => e.category === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q) ||
          e.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (sortBy === "popular") items.sort((a, b) => b.likes - a.likes);
    return items;
  }, [activeTab, searchQuery, sortBy]);

  const toggleSave = (id: string) => {
    setSavedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div data-testid="page-hub-knowledge">
      <HubSectionHeader title="Knowledge Vault" subtitle="Shared knowledge from the team. Learn, contribute, grow." />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition-all",
                activeTab === tab
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              )}
              data-testid={`button-tab-${tab.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by title, author, or tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 dark:border-slate-700 dark:bg-slate-900"
            data-testid="input-knowledge-search"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={sortBy === "recent" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("recent")}
            className={cn(sortBy === "recent" && "bg-blue-600 text-white")}
            data-testid="button-sort-recent"
          >
            Recent
          </Button>
          <Button
            variant={sortBy === "popular" ? "default" : "outline"}
            size="sm"
            onClick={() => setSortBy("popular")}
            className={cn(sortBy === "popular" && "bg-blue-600 text-white")}
            data-testid="button-sort-popular"
          >
            Most Popular
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((entry, i) => (
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
            data-testid={`card-knowledge-${entry.id}`}
          >
            <div className="flex items-start justify-between">
              <HubBadge variant="blue">{entry.category}</HubBadge>
              <button
                onClick={() => toggleSave(entry.id)}
                className="text-slate-400 transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                data-testid={`button-save-${entry.id}`}
              >
                {savedItems.has(entry.id) ? (
                  <BookmarkCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Bookmark className="h-4 w-4" />
                )}
              </button>
            </div>

            <h3 className="mt-3 text-sm font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
              {entry.title}
            </h3>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{entry.excerpt}</p>

            <div className="mt-3 flex flex-wrap gap-1">
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                  {tag}
                </span>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <HubAvatar initials={entry.author.split(" ").map((w) => w[0]).join("")} size="sm" />
                <div>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{entry.author}</p>
                  <p className="text-[10px] text-slate-400">{entry.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <Heart className="h-3 w-3" /> {entry.likes}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <Filter className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600" />
          <p className="mt-4 text-sm text-slate-500">No entries match your filters.</p>
        </div>
      )}
    </div>
  );
}
