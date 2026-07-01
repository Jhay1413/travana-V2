import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Pin,
  PinOff,
  Plus,
  Pencil,
  Trash2,
  Heart,
  Share2,
  ImagePlus,
  Users,
  EyeOff,
  MoreHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { HubSectionHeader, HubAvatar, HubBadge } from "@/features/hub/components/hub-components";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RichTextDisplay } from "@/components/shared/rich-text-editor";
import { MentionEditor } from "@/components/shared/mention-editor";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useToggleAnnouncementPin,
  useDeleteAnnouncement,
  useBulkLikes,
  useToggleLike,
  useSharePost,
} from "@/features/announcement/api/use-announcement-queries";
import { useRole } from "@/hooks/use-role";
import { announcementApi } from "@/features/announcement/api/announcement.api";
import type { HubAnnouncement } from "@shared/schema";
import type { HubRole } from "@/data/hub-mock";

const CATEGORY_COLORS: Record<string, "blue" | "green" | "amber" | "red"> = {
  latest_news: "blue",
  supplier_codes: "green",
  club_travana: "amber",
};

const CATEGORY_LABELS: Record<string, string> = {
  latest_news: "Latest News",
  supplier_codes: "Supplier Codes",
  club_travana: "Club Travana",
};

const CATEGORIES = ["latest_news", "supplier_codes", "club_travana"];

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
  const { data: likesMap } = useBulkLikes();
  const { role: actualRole } = useRole();

  const canManage = actualRole === "Admin" || actualRole === "Manager";

  const filtered = activeFilter === "All"
    ? announcements || []
    : (announcements || []).filter((p) => p.category === activeFilter);

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
        {[{ key: "All", label: "All" }, ...CATEGORIES.map((key) => ({ key, label: CATEGORY_LABELS[key] }))].map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveFilter(cat.key)}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-medium transition-all",
              activeFilter === cat.key
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
            )}
            data-testid={`button-filter-${cat.key.toLowerCase()}`}
          >
            {cat.label}
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
            likeData={likesMap?.[post.id]}
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

export function AnnouncementCard({
  post,
  index,
  canManage,
  onEdit,
  likeData,
  onHide,
}: {
  post: HubAnnouncement;
  index: number;
  canManage: boolean;
  onEdit: (p: HubAnnouncement) => void;
  likeData?: { count: number; userLiked: boolean };
  onHide?: (id: string) => void;
}) {
  const { toast } = useToast();
  const togglePin = useToggleAnnouncementPin();
  const deleteAnnouncement = useDeleteAnnouncement();
  const toggleLike = useToggleLike();
  const sharePost = useSharePost();
  const initials = (post.authorName || "??")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const likeCount = likeData?.count || 0;
  const userLiked = likeData?.userLiked || false;

  const handleShare = () => {
    const url = `${window.location.origin}/hub/news`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied to clipboard" });
    }).catch(() => {
      toast({ title: "Failed to copy link", variant: "destructive" });
    });
    sharePost.mutate(post.id);
  };

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
              {CATEGORY_LABELS[post.category] || post.category}
            </HubBadge>
            {post.pinned && (
              <Pin className="h-3 w-3 text-blue-500" />
            )}
          </div>
          <p className="text-xs text-slate-400">{formatTimeAgo(post.createdAt)}</p>
        </div>

        {(canManage || onHide) && (
          <div className="flex items-center gap-1 shrink-0">
            {canManage && (
              <>
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
              </>
            )}
            {onHide && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    title="More"
                    data-testid={`button-news-menu-${post.id}`}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onHide(post.id)} data-testid={`button-hide-news-${post.id}`}>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Hide from my wall
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>

      {post.title && (
        <h3 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{post.title}</h3>
      )}

      <div className="mt-2">
        <RichTextDisplay
          content={post.content}
          className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 [&_.mention]:text-blue-600 [&_.mention]:font-semibold"
        />
      </div>

      {post.imageUrl && (
        <div className="mt-3 overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800">
          <img
            src={post.imageUrl}
            alt={post.title || "Post image"}
            className="w-full object-cover"
            style={{ maxHeight: "400px" }}
            data-testid={`img-news-${post.id}`}
          />
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 dark:border-slate-800">
        <button
          onClick={() => toggleLike.mutate(post.id)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
            userLiked
              ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
              : "text-slate-400 hover:bg-slate-50 hover:text-red-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
          )}
          data-testid={`button-like-${post.id}`}
        >
          <Heart className={cn("h-4 w-4", userLiked && "fill-current")} />
          {likeCount > 0 && <span>{likeCount}</span>}
          {!likeCount && <span>Like</span>}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-400 hover:bg-slate-50 hover:text-blue-500 dark:hover:bg-slate-800 dark:hover:text-blue-400 transition-all"
          data-testid={`button-share-${post.id}`}
        >
          <Share2 className="h-4 w-4" />
          <span>Share</span>
        </button>
      </div>
    </motion.div>
  );
}

type MentionUser = { id: string; name: string; role: string };


function ImageUploadPreview({
  imageUrl,
  onRemove,
  imageFile,
  onScaleChange,
  scale,
}: {
  imageUrl: string;
  onRemove: () => void;
  imageFile?: File | null;
  onScaleChange?: (s: number) => void;
  scale: number;
}) {
  return (
    <div className="relative mt-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 overflow-hidden">
      <div className="relative flex items-center justify-center bg-slate-100 dark:bg-slate-900" style={{ maxHeight: "300px", overflow: "hidden" }}>
        <img
          src={imageUrl}
          alt="Preview"
          className="transition-transform"
          style={{
            transform: `scale(${scale})`,
            maxHeight: "300px",
            objectFit: "contain",
            width: "100%",
          }}
          data-testid="img-preview-announcement"
        />
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onScaleChange?.(Math.max(0.3, scale - 0.1))}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Zoom out"
            data-testid="button-zoom-out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-slate-500 w-10 text-center">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            onClick={() => onScaleChange?.(Math.min(2, scale + 0.1))}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
            title="Zoom in"
            data-testid="button-zoom-in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
          data-testid="button-remove-image"
        >
          <X className="h-3 w-3" /> Remove
        </button>
      </div>
    </div>
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
  const [category, setCategory] = useState("latest_news");
  const [pinned, setPinned] = useState(false);
  const [postToAll, setPostToAll] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageScale, setImageScale] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [mentionUsers, setMentionUsers] = useState<MentionUser[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();

  const isLoading = createMutation.isPending || updateMutation.isPending || uploading;

  useEffect(() => {
    if (open) {
      announcementApi.getMentionableUsers().then(setMentionUsers).catch(() => {});
    }
  }, [open]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen && post && mode === "edit") {
      setTitle(post.title || "");
      setContent(post.content);
      setCategory(post.category);
      setPinned(post.pinned);
      setPostToAll(post.postToAll);
      setImageUrl(post.imageUrl || null);
      setImageFile(null);
      setImageScale(1);
    } else if (isOpen && mode === "create") {
      setTitle("");
      setContent("");
      setCategory("latest_news");
      setPinned(false);
      setPostToAll(false);
      setImageUrl(null);
      setImageFile(null);
      setImageScale(1);
    }
    onOpenChange(isOpen);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Image must be under 5MB", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setImageScale(1);
  };

  const handleRemoveImage = () => {
    setImageUrl(null);
    setImageFile(null);
    setImageScale(1);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;

    let finalImageUrl = imageUrl;
    if (imageFile) {
      try {
        setUploading(true);
        const result = await announcementApi.uploadImage(imageFile);
        finalImageUrl = result.imageUrl;
      } catch {
        toast({ title: "Failed to upload image", variant: "destructive" });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    if (mode === "create") {
      createMutation.mutate(
        { title: title.trim() || undefined, content, category, pinned, postToAll, imageUrl: finalImageUrl || undefined },
        {
          onSuccess: () => { toast({ title: "Announcement posted" }); handleOpen(false); },
          onError: () => toast({ title: "Failed to post", variant: "destructive" }),
        }
      );
    } else if (post) {
      updateMutation.mutate(
        { id: post.id, title: title.trim() || undefined, content, category, pinned, postToAll, imageUrl: finalImageUrl || undefined },
        {
          onSuccess: () => { toast({ title: "Announcement updated" }); handleOpen(false); },
          onError: () => toast({ title: "Failed to update", variant: "destructive" }),
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto">
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
                      {CATEGORY_LABELS[c] || c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-2">
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
              <Button
                type="button"
                variant={postToAll ? "default" : "outline"}
                size="sm"
                className={cn("h-10", postToAll && "bg-blue-600 text-white")}
                onClick={() => setPostToAll(!postToAll)}
                title="Show this announcement on every user's profile wall"
                data-testid="button-toggle-post-to-all"
              >
                <Users className="mr-1.5 h-4 w-4" />
                {postToAll ? "Posted to all" : "Post to all"}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Content <span className="text-slate-400">(type @ to mention someone)</span></label>
            <MentionEditor
              content={content}
              onChange={setContent}
              placeholder="Write your announcement... Type @ to mention someone"
              users={mentionUsers}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 mb-1 block">Image (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleImageSelect}
              className="hidden"
              data-testid="input-announcement-image"
            />
            {!imageUrl && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 dark:border-slate-700 dark:bg-slate-800/50 dark:hover:border-blue-500"
                data-testid="button-add-image"
              >
                <ImagePlus className="h-5 w-5" />
                Click to add an image
              </button>
            )}
            {imageUrl && (
              <ImageUploadPreview
                imageUrl={imageUrl}
                onRemove={handleRemoveImage}
                imageFile={imageFile}
                scale={imageScale}
                onScaleChange={setImageScale}
              />
            )}
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
              {uploading ? "Uploading image..." : isLoading ? "Saving..." : mode === "create" ? "Post" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
