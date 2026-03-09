import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  Pin,
  PinOff,
  Plus,
  Send,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { HubSectionHeader, HubAvatar, HubBadge } from "@/components/hub-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextEditor, RichTextDisplay } from "@/components/rich-text-editor";
import { useAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useToggleAnnouncementPin, useDeleteAnnouncement } from "@/hooks/queries/use-announcement-queries";
import { useRole } from "@/hooks/use-role";
import type { HubAnnouncement } from "@shared/schema";
import type { HubRole } from "@/data/hub-mock";

const CATEGORY_COLORS: Record<string, "blue" | "green" | "amber" | "red"> = {
  supplier: "blue",
  target: "red",
  incentive: "green",
  training: "amber",
  general: "blue",
};

const CATEGORIES = ["general", "supplier", "target", "incentive", "training"];

function formatTimeAgo(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function HubNews({ role: hubRole = "Senior Agent" }: { role?: HubRole }) {
  const [activeFilter, setActiveFilter] = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [editingPost, setEditingPost] = useState<HubAnnouncement | null>(null);

  const { data: announcements, isLoading } = useAnnouncements();
  const { role: actualRole } = useRole();

  const canManage = actualRole === "Admin" || actualRole === "Manager";

  const filtered = activeFilter === "All"
    ? announcements || []
    : (announcements || []).filter((p) => p.category.toLowerCase() === activeFilter.toLowerCase());

  const sortedPosts = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });

  return (
    <div data-testid="page-hub-news">
      <HubSectionHeader
        title="News & Announcements"
        subtitle="Stay up to date with the latest from the team."
        action={
          canManage ? (
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              data-testid="button-post-news"
              onClick={() => setShowCreate(true)}
            >
              <Plus className="mr-2 h-4 w-4" /> Post Announcement
            </Button>
          ) : null
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {["All", "General", "Supplier", "Target", "Incentive", "Training"].map((cat) => (
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

      {isLoading && (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      )}

      {!isLoading && sortedPosts.length === 0 && (
        <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-slate-300 bg-white/50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
          <p className="text-sm text-slate-500 dark:text-slate-400">No announcements yet.</p>
          {canManage && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowCreate(true)}
              data-testid="button-post-news-empty"
            >
              <Plus className="mr-2 h-4 w-4" /> Post the first one
            </Button>
          )}
        </div>
      )}

      <div className="mx-auto max-w-2xl space-y-4">
        {sortedPosts.map((post, i) => (
          <AnnouncementCard
            key={post.id}
            post={post}
            index={i}
            canManage={canManage}
            onEdit={(p) => setEditingPost(p)}
          />
        ))}
      </div>

      <AnnouncementDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        mode="create"
      />

      <AnnouncementDialog
        open={!!editingPost}
        onOpenChange={(open) => { if (!open) setEditingPost(null); }}
        mode="edit"
        post={editingPost || undefined}
      />
    </div>
  );
}

function AnnouncementCard({
  post,
  index,
  canManage,
  onEdit,
}: {
  post: HubAnnouncement;
  index: number;
  canManage: boolean;
  onEdit: (p: HubAnnouncement) => void;
}) {
  const { toast } = useToast();
  const togglePin = useToggleAnnouncementPin();
  const deleteAnnouncement = useDeleteAnnouncement();
  const initials = (post.authorName || "??")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900",
        post.pinned
          ? "border-blue-200 dark:border-blue-500/20"
          : "border-slate-200 dark:border-slate-800"
      )}
      data-testid={`card-news-${post.id}`}
    >
      <div className="flex items-start gap-3">
        <HubAvatar initials={initials} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{post.authorName || "Unknown"}</span>
            <HubBadge variant={CATEGORY_COLORS[post.category] || "blue"}>
              {post.category.charAt(0).toUpperCase() + post.category.slice(1)}
            </HubBadge>
            {post.pinned && (
              <Pin className="h-3 w-3 text-blue-500" />
            )}
          </div>
          <p className="text-xs text-slate-400">{formatTimeAgo(post.createdAt)}</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => togglePin.mutate(post.id, {
                onSuccess: () => toast({ title: post.pinned ? "Unpinned" : "Pinned" }),
                onError: () => toast({ title: "Failed to update pin", variant: "destructive" }),
              })}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
              title={post.pinned ? "Unpin" : "Pin"}
              data-testid={`button-toggle-pin-${post.id}`}
            >
              {post.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            <button
              onClick={() => onEdit(post)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-amber-600 dark:hover:bg-slate-800"
              title="Edit"
              data-testid={`button-edit-news-${post.id}`}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                if (window.confirm("Delete this announcement?")) {
                  deleteAnnouncement.mutate(post.id, {
                    onSuccess: () => toast({ title: "Announcement deleted" }),
                    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
                  });
                }
              }}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
              title="Delete"
              data-testid={`button-delete-news-${post.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {post.title && (
        <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{post.title}</h3>
      )}

      <div className="mt-2">
        <RichTextDisplay
          content={post.content}
          className="text-sm leading-relaxed text-slate-700 dark:text-slate-300"
        />
      </div>
    </motion.div>
  );
}

function AnnouncementDialog({
  open,
  onOpenChange,
  mode,
  post,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  post?: HubAnnouncement;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [pinned, setPinned] = useState(false);
  const { toast } = useToast();

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  const isLoading = createMutation.isPending || updateMutation.isPending;

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && post && mode === "edit") {
      setTitle(post.title || "");
      setContent(post.content);
      setCategory(post.category);
      setPinned(post.pinned);
    } else if (isOpen && mode === "create") {
      setTitle("");
      setContent("");
      setCategory("general");
      setPinned(false);
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = () => {
    if (!content.trim()) return;

    if (mode === "create") {
      createMutation.mutate(
        { title: title.trim() || undefined, content, category, pinned },
        {
          onSuccess: () => { toast({ title: "Announcement posted" }); handleOpen(false); },
          onError: () => toast({ title: "Failed to post", variant: "destructive" }),
        }
      );
    } else if (post) {
      updateMutation.mutate(
        { id: post.id, title: title.trim() || undefined, content, category, pinned },
        {
          onSuccess: () => { toast({ title: "Announcement updated" }); handleOpen(false); },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Post Announcement" : "Edit Announcement"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Title (optional)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Announcement title..."
              className="dark:border-slate-700 dark:bg-slate-800"
              data-testid="input-announcement-title"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-slate-500 mb-1 block">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="dark:border-slate-700 dark:bg-slate-800" data-testid="select-announcement-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c.charAt(0).toUpperCase() + c.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant={pinned ? "default" : "outline"}
                size="sm"
                className={cn("h-10", pinned && "bg-blue-600 text-white")}
                onClick={() => setPinned(!pinned)}
                data-testid="button-toggle-pinned"
              >
                <Pin className="mr-1.5 h-4 w-4" />
                {pinned ? "Pinned" : "Pin"}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Content</label>
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder="Write your announcement..."
              className="min-h-[180px] dark:border-slate-700 dark:bg-slate-800"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => handleOpen(false)} data-testid="button-cancel-announcement">
              Cancel
            </Button>
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={handleSubmit}
              disabled={!content.trim() || isLoading}
              data-testid="button-submit-announcement"
            >
              {isLoading ? "Saving..." : mode === "create" ? "Post" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
