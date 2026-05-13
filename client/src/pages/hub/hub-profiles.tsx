import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import defaultCoverImage from "@assets/Whats-App-Travel-Deals_1772061964595.jpg";
import { useHubPosts, useCreateHubPost, useToggleHubPostLike, useAddHubPostComment } from "@/hooks/queries/use-hub-post-queries";
import {
  Award,
  BookOpen,
  Bookmark,
  Calendar,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  FileText,
  GraduationCap,
  Heart,
  Image,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pen,
  Pin,
  Plane,
  Plus,
  Repeat2,
  Send,
  Share2,
  Star,
  Target,
  ThumbsUp,
  Trophy,
  TrendingUp,
  Upload,
  Users,
  Video,
  X,
  Zap,
} from "lucide-react";
import { type LeaveType, type LeaveEntry } from "@/api/endpoints/hr.api";
import { useMyHrRecord } from "@/hooks/queries";
import { useRequestMyLeave } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { HubSectionHeader, HubAvatar, HubBadge, HubProgressBar } from "@/components/hub-components";
import { agentProfiles } from "@/data/hub-mock";
import { userProfileApi } from "@/api";
import axiosClient from "@/api/client/axios-client";
import { useCurrentUser, useMyProfit, useUsers } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type ProfileTab = "timeline" | "knowledge" | "training" | "achievements" | "about" | "leave";

interface TimelinePost {
  id: string;
  type: "deal" | "knowledge" | "training" | "blog" | "milestone" | "review";
  content: string;
  date: string;
  pinned?: boolean;
  likes: number;
  comments: { author: string; avatar: string; text: string; date: string }[];
  liked?: boolean;
  image?: string;
  badge?: string;
  destination?: string;
  value?: string;
  authorName?: string;
  authorImage?: string | null;
  authorRole?: string | null;
}

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

const MOCK_TIMELINE: TimelinePost[] = [
  {
    id: "p1",
    type: "deal",
    pinned: true,
    content: "Just closed a luxury Maldives honeymoon package for 2 guests — Soneva Fushi Overwater Villa, 10 nights, seaplane transfers included. One of my biggest deals this quarter!",
    date: "2 hours ago",
    likes: 14,
    destination: "Maldives",
    value: "£15,300",
    badge: "High Value Deal",
    comments: [
      { author: "James Cooper", avatar: "JC", text: "Incredible deal Sarah! Soneva Fushi is a dream property. Well done! 🎉", date: "1 hour ago" },
      { author: "Tina Brown", avatar: "TB", text: "This is exactly the kind of premium booking we love to see. Great work!", date: "45 mins ago" },
    ],
    liked: true,
  },
  {
    id: "p2",
    type: "knowledge",
    pinned: true,
    content: "Published a new destination guide: \"The Complete Agent's Guide to Selling Antalya\". Covers the top 15 hotels, transfer logistics, excursion upsells, and common objections with responses. Feel free to use this with your clients!",
    date: "Yesterday",
    likes: 23,
    badge: "Knowledge Guide",
    destination: "Turkey",
    comments: [
      { author: "Ryan Foster", avatar: "RF", text: "This is gold! Used the objection responses on a call today and it worked perfectly.", date: "12 hours ago" },
    ],
  },
  {
    id: "p3",
    type: "training",
    content: "Just completed the \"Advanced Cruise Selling\" training module with a score of 92%. Really improved my understanding of cabin categories and upgrade strategies.",
    date: "2 days ago",
    likes: 8,
    badge: "Training Complete",
    comments: [],
  },
  {
    id: "p4",
    type: "milestone",
    content: "Hit a major milestone — 50 bookings confirmed this quarter! Thank you to everyone who's helped and to my amazing clients. Here's to the next 50! 🏆",
    date: "3 days ago",
    likes: 31,
    badge: "Milestone",
    comments: [
      { author: "James Cooper", avatar: "JC", text: "Phenomenal achievement! You're absolutely smashing it.", date: "3 days ago" },
      { author: "Casey Ashman", avatar: "CA", text: "Inspiring! I'm at 32 — trying to catch up 😅", date: "2 days ago" },
      { author: "Admin", avatar: "AD", text: "Outstanding performance Sarah. Well deserved recognition!", date: "2 days ago" },
    ],
    liked: true,
  },
  {
    id: "p5",
    type: "review",
    content: "Hotel Review: Titanic Mardan Palace, Antalya ⭐⭐⭐⭐⭐\n\nStayed 5 nights for a site inspection. The grounds are absolutely stunning — think Versailles meets the Mediterranean. The beach is pristine and the food quality across all 9 restaurants was exceptional. Perfect for families and couples seeking a premium AI experience. Commission structure is excellent via Jet2.",
    date: "1 week ago",
    likes: 19,
    badge: "Hotel Review",
    destination: "Turkey",
    comments: [
      { author: "Tom Blake", avatar: "TBL", text: "Great review! How were the kids' clubs?", date: "6 days ago" },
    ],
  },
  {
    id: "p6",
    type: "blog",
    content: "New Blog Post: \"5 Ways to Close a Holiday Sale on the First Call\"\n\nSharing my top techniques that have helped me achieve a 68% first-call close rate this year. Key takeaway: always have three options ready before the call, and lead with the mid-range option.",
    date: "2 weeks ago",
    likes: 42,
    badge: "Blog Post",
    comments: [
      { author: "Ryan Foster", avatar: "RF", text: "The three-option strategy is genius. Already seeing improvement!", date: "1 week ago" },
    ],
  },
];

const MOCK_KNOWLEDGE = [
  { id: "k1", title: "Complete Guide to Selling Antalya", type: "guide", views: 234, saves: 45, date: "Yesterday", destination: "Turkey" },
  { id: "k2", title: "Titanic Mardan Palace — Full Agent Review", type: "review", views: 189, saves: 32, date: "1 week ago", destination: "Turkey" },
  { id: "k3", title: "Cruise Cabin Upgrade Strategies", type: "guide", views: 156, saves: 28, date: "2 weeks ago", destination: "Cruise" },
  { id: "k4", title: "Maldives Honeymoon Selling Points", type: "guide", views: 98, saves: 19, date: "3 weeks ago", destination: "Maldives" },
  { id: "k5", title: "Handling 'Too Expensive' Objection", type: "tip", views: 312, saves: 67, date: "1 month ago", destination: "General" },
  { id: "k6", title: "Lanzarote Family Resort Comparison", type: "review", views: 145, saves: 23, date: "1 month ago", destination: "Canaries" },
];

const MOCK_TRAINING = [
  { id: "t1", title: "Advanced Cruise Selling", progress: 100, score: 92, duration: "2h 15m", mandatory: false },
  { id: "t2", title: "Closing on First Call", progress: 100, score: 88, duration: "1h 30m", mandatory: true },
  { id: "t3", title: "Turkey Destination Deep Dive", progress: 100, score: 95, duration: "3h 00m", mandatory: false },
  { id: "t4", title: "Luxury Resort Positioning", progress: 65, score: null, duration: "2h 45m", mandatory: false },
  { id: "t5", title: "Digital Marketing for Agents", progress: 30, score: null, duration: "1h 45m", mandatory: true },
  { id: "t6", title: "Customer Complaint Handling", progress: 0, score: null, duration: "1h 00m", mandatory: true },
];

const MOCK_ACHIEVEMENTS = [
  { id: "a1", title: "Top Seller", description: "Highest revenue in a single month", icon: Trophy, color: "from-amber-500 to-orange-500", earned: true, date: "Jan 2026" },
  { id: "a2", title: "Knowledge Guru", description: "Published 10+ knowledge articles", icon: BookOpen, color: "from-blue-500 to-indigo-500", earned: true, date: "Dec 2025" },
  { id: "a3", title: "First Call Closer", description: "70%+ first-call close rate", icon: Zap, color: "from-emerald-500 to-teal-500", earned: true, date: "Nov 2025" },
  { id: "a4", title: "Globe Trotter", description: "Sold to 15+ destinations", icon: Plane, color: "from-purple-500 to-pink-500", earned: true, date: "Oct 2025" },
  { id: "a5", title: "Team Player", description: "Helped 5 colleagues close deals", icon: Users, color: "from-cyan-500 to-blue-500", earned: true, date: "Sep 2025" },
  { id: "a6", title: "Diamond Agent", description: "£100k+ in bookings", icon: Award, color: "from-slate-400 to-slate-500", earned: false, date: null },
  { id: "a7", title: "Training Master", description: "Complete all training modules", icon: GraduationCap, color: "from-slate-400 to-slate-500", earned: false, date: null },
  { id: "a8", title: "Review Champion", description: "Write 20+ hotel reviews", icon: Star, color: "from-slate-400 to-slate-500", earned: false, date: null },
];

function PostTypeIcon({ type }: { type: TimelinePost["type"] }) {
  const map = {
    deal: { icon: TrendingUp, color: "text-emerald-500" },
    knowledge: { icon: BookOpen, color: "text-blue-500" },
    training: { icon: GraduationCap, color: "text-purple-500" },
    blog: { icon: Pen, color: "text-indigo-500" },
    milestone: { icon: Trophy, color: "text-amber-500" },
    review: { icon: Star, color: "text-orange-500" },
  };
  const { icon: Icon, color } = map[type];
  return <Icon className={cn("h-4 w-4", color)} />;
}

function PostBadge({ label, type }: { label: string; type: TimelinePost["type"] }) {
  const colors = {
    deal: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
    knowledge: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
    training: "bg-purple-50 text-purple-700 dark:bg-purple-500/10 dark:text-purple-400",
    blog: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400",
    milestone: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
    review: "bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium", colors[type])}>
      <PostTypeIcon type={type} />
      {label}
    </span>
  );
}

function SkillHeatmap({ skills }: { skills: { name: string; level: number }[] }) {
  const getColor = (level: number) => {
    if (level >= 90) return "bg-emerald-500";
    if (level >= 75) return "bg-blue-500";
    if (level >= 50) return "bg-amber-500";
    return "bg-slate-400";
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {skills.map((skill) => (
        <div key={skill.name} className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800/50">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{skill.name}</span>
            <span className="text-[10px] font-bold text-slate-500">{skill.level}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${skill.level}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={cn("h-1.5 rounded-full", getColor(skill.level))}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

interface MentionUser {
  id: string;
  name: string;
  image?: string | null;
  role?: string;
}

function renderMentionContent(content: string): React.ReactNode {
  const mentionRegex = /@(\w[\w\s]*?\w|\w)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    parts.push(
      <span key={match.index} className="inline-flex items-center bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400 rounded px-1 font-medium cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-500/25 transition" data-testid={`mention-${match[1]}`}>
        @{match[1]}
      </span>
    );
    lastIndex = mentionRegex.lastIndex;
  }
  if (lastIndex < content.length) parts.push(content.slice(lastIndex));
  return parts.length > 0 ? parts : content;
}

interface MentionTextareaProps {
  value: string;
  onChange: (val: string) => void;
  users: MentionUser[];
  placeholder?: string;
  className?: string;
  rows?: number;
  "data-testid"?: string;
}

function MentionTextarea({ value, onChange, users, placeholder, className, rows, "data-testid": testId }: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredUsers = useMemo(() => {
    if (!mentionFilter) return users.slice(0, 8);
    const lower = mentionFilter.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(lower)).slice(0, 8);
  }, [users, mentionFilter]);

  const getMentionStartPos = useCallback(() => {
    const before = value.slice(0, cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return -1;
    const between = before.slice(atIdx + 1);
    if (/\n/.test(between)) return -1;
    if (atIdx > 0 && /\S/.test(before[atIdx - 1])) return -1;
    return atIdx;
  }, [value, cursorPos]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    const newPos = e.target.selectionStart || 0;
    onChange(newVal);
    setCursorPos(newPos);

    const before = newVal.slice(0, newPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || /\s/.test(before[atIdx - 1]))) {
      const query = before.slice(atIdx + 1);
      if (!/\n/.test(query) && query.length <= 30) {
        setMentionFilter(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  };

  const insertMention = (user: MentionUser) => {
    const startPos = getMentionStartPos();
    if (startPos === -1) return;
    const beforeAt = value.slice(0, startPos);
    const afterCursor = value.slice(cursorPos);
    const newValue = `${beforeAt}@${user.name} ${afterCursor}`;
    onChange(newValue);
    setShowMentions(false);
    setTimeout(() => {
      const pos = startPos + user.name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showMentions || filteredUsers.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % filteredUsers.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredUsers[mentionIndex]);
    } else if (e.key === "Escape") {
      setShowMentions(false);
    }
  };

  useEffect(() => {
    if (showMentions && dropdownRef.current) {
      const active = dropdownRef.current.querySelector("[data-active='true']");
      active?.scrollIntoView({ block: "nearest" });
    }
  }, [mentionIndex, showMentions]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0)}
        placeholder={placeholder}
        className={className}
        rows={rows}
        data-testid={testId}
      />
      <AnimatePresence>
        {showMentions && filteredUsers.length > 0 && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 bottom-full mb-1 z-50 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 max-h-52 overflow-y-auto"
            data-testid="mention-dropdown"
          >
            <div className="p-1">
              <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Team Members</div>
              {filteredUsers.map((user, i) => (
                <button
                  key={user.id}
                  onClick={() => insertMention(user)}
                  data-active={i === mentionIndex ? "true" : "false"}
                  className={cn(
                    "flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-left text-sm transition",
                    i === mentionIndex
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
                      : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                  )}
                  data-testid={`mention-option-${user.id}`}
                >
                  {user.image ? (
                    <img src={user.image} alt={user.name} className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{user.name}</div>
                    {user.role && <div className="text-[10px] text-slate-400 truncate">{user.role}</div>}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface TimelinePostCardProps {
  post: TimelinePost;
  onLike: (id: string) => void;
  onComment: (id: string, text: string) => void;
  onShare: (id: string) => void;
  onSave: (id: string) => void;
  profileAvatar: string;
  profileName: string;
  profileRole: string;
  profileImage?: string | null;
}

function TimelinePostCard({ post, onLike, onComment, onShare, onSave, profileAvatar, profileName, profileRole, profileImage }: TimelinePostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [saved, setSaved] = useState(false);
  const [shared, setShared] = useState(false);

  const displayName = post.authorName || profileName;
  const displayImage = post.authorImage || (post.authorName ? null : profileImage);
  const displayRole = post.authorRole || (post.authorName ? "" : profileRole);
  const displayAvatar = displayName.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  const handleComment = () => {
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText("");
  };

  const handleShare = () => {
    onShare(post.id);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  const handleSave = () => {
    onSave(post.id);
    setSaved(!saved);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border bg-white dark:bg-slate-900",
        post.pinned
          ? "border-blue-200 dark:border-blue-500/20 ring-1 ring-blue-100 dark:ring-blue-500/10"
          : "border-slate-200 dark:border-slate-800"
      )}
    >
      {post.pinned && (
        <div className="flex items-center gap-1.5 px-4 pt-3 text-[11px] font-medium text-blue-600 dark:text-blue-400">
          <Pin className="h-3 w-3" />
          Pinned Post
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {displayImage ? (
              <img src={displayImage} alt={displayName} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {displayAvatar}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{displayName}</span>
                {displayRole && <HubBadge variant="blue">{displayRole}</HubBadge>}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">{post.date}</span>
                {post.badge && <PostBadge label={post.badge} type={post.type} />}
              </div>
            </div>
          </div>
          <button className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
          {renderMentionContent(post.content)}
        </div>

        {post.image && (
          <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-72">
            <img src={post.image} alt="Post attachment" className="w-full h-full max-h-72 object-contain bg-slate-50 dark:bg-slate-800" />
          </div>
        )}

        {(post.destination || post.value) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {post.destination && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                <MapPin className="h-3 w-3" /> {post.destination}
              </span>
            )}
            {post.value && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                £ {post.value}
              </span>
            )}
          </div>
        )}

        <Separator className="my-3" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button
              onClick={() => onLike(post.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                post.liked
                  ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                  : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              data-testid={`post-like-${post.id}`}
            >
              <ThumbsUp className={cn("h-3.5 w-3.5", post.liked && "fill-blue-500")} />
              {post.likes} {post.likes === 1 ? "Like" : "Likes"}
            </button>
            <button
              onClick={() => setShowComments(!showComments)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              data-testid={`post-comment-toggle-${post.id}`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {post.comments.length} {post.comments.length === 1 ? "Comment" : "Comments"}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                shared ? "bg-emerald-50 text-emerald-600" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              data-testid={`post-share-${post.id}`}
            >
              <Share2 className="h-3.5 w-3.5" />
              {shared ? "Shared!" : "Share"}
            </button>
            <button
              onClick={handleSave}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition",
                saved ? "bg-amber-50 text-amber-600" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              )}
              data-testid={`post-save-${post.id}`}
            >
              <Bookmark className={cn("h-3.5 w-3.5", saved && "fill-amber-500")} />
              {saved ? "Saved" : "Save"}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {showComments && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <Separator className="my-3" />
              <div className="space-y-3">
                {post.comments.map((c, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {c.avatar}
                    </div>
                    <div className="flex-1">
                      <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white">{c.author}</span>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{renderMentionContent(c.text)}</p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 px-1">
                        <span className="text-[10px] text-slate-400">{c.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  {profileImage ? (
                    <img src={profileImage} alt={profileName} className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                      {profileAvatar}
                    </div>
                  )}
                  <div className="flex-1 relative">
                    <Input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleComment(); }}
                      placeholder="Write a comment..."
                      className="h-8 rounded-full bg-slate-100 border-0 text-xs pr-8 dark:bg-slate-800"
                      data-testid={`post-comment-input-${post.id}`}
                    />
                    <button
                      onClick={handleComment}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-500 hover:text-blue-600 transition"
                      data-testid={`post-comment-send-${post.id}`}
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function HubProfiles() {
  const { data: currentUser } = useCurrentUser();
  const { data: myProfit } = useMyProfit();
  const { data: allUsers } = useUsers();
  const mentionUsers: MentionUser[] = useMemo(() => {
    if (!allUsers) return [];
    return allUsers.map((u: any) => ({ id: u.id, name: u.name || `${u.firstName || ""} ${u.lastName || ""}`.trim(), image: u.image || u.profileImageUrl || null, role: u.role || "" }));
  }, [allUsers]);
  const queryClient = useQueryClient();
  const { data: savedProfile } = useQuery({
    queryKey: ["user-profile", "me"],
    queryFn: () => userProfileApi.getMyProfile(),
    enabled: !!currentUser,
    retry: false,
  });

  const saveProfileMutation = useMutation({
    mutationFn: (payload: { bio?: string; extendedBio?: string; location?: string; specialisation?: string; certifications?: string }) =>
      userProfileApi.saveMyProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile", "me"] });
    },
  });

  const defaultBio = agentProfiles[0].bio;
  const defaultExtendedBio = `${defaultBio} Passionate about creating unforgettable holiday experiences and helping clients find their perfect getaway. Completed over 200 site inspections across Europe and beyond. Known for exceptional first-call close rates and deep destination knowledge.`;

  const [profile, setProfile] = useState(() => ({
    ...agentProfiles[0],
    name: currentUser?.name || agentProfiles[0].name,
    role: currentUser?.role || agentProfiles[0].role,
    avatar: currentUser?.name
      ? currentUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
      : agentProfiles[0].avatar,
    location: "Newcastle upon Tyne, United Kingdom",
    joined: "March 2018",
    specialisation: "Turkey & Mediterranean Specialist",
    certifications: "ABTA Certified, IATA Accredited",
    bio: defaultBio,
    extendedBio: defaultExtendedBio,
  }));

  useEffect(() => {
    if (currentUser) {
      setProfile((prev) => ({
        ...prev,
        name: currentUser.name || prev.name,
        role: currentUser.role || prev.role,
        avatar: currentUser.name
          ? currentUser.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
          : prev.avatar,
      }));
      if (currentUser.image) {
        setProfileImage(currentUser.image);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    if (savedProfile) {
      setProfile((prev) => ({
        ...prev,
        bio: savedProfile.bio || prev.bio,
        extendedBio: savedProfile.extendedBio || prev.extendedBio,
        location: savedProfile.location || prev.location,
        specialisation: savedProfile.specialisation || prev.specialisation,
        certifications: savedProfile.certifications || prev.certifications,
      }));
      if (savedProfile.coverImage) {
        setActiveCoverImage(savedProfile.coverImage);
      }
    }
  }, [savedProfile]);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [activeCoverImage, setActiveCoverImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("timeline");
  const { data: dbPosts } = useHubPosts();
  const createPostMutation = useCreateHubPost();
  const toggleLikeMutation = useToggleHubPostLike();
  const addCommentMutation = useAddHubPostComment();
  const timeline: TimelinePost[] = useMemo(() => {
    if (!dbPosts || dbPosts.length === 0) return MOCK_TIMELINE;
    return dbPosts.map((p: any) => ({
      id: p.id,
      type: p.type || "deal",
      content: p.content,
      date: p.date || formatTimeAgo(p.createdAt),
      likes: p.likes || 0,
      liked: p.liked || false,
      badge: p.badge || undefined,
      destination: p.destination || undefined,
      value: p.value || undefined,
      image: p.image || undefined,
      pinned: p.pinned || false,
      authorName: p.authorName || undefined,
      authorImage: p.authorImage || undefined,
      authorRole: p.authorRole || undefined,
      comments: (p.comments || []).map((c: any) => ({
        author: c.author || "Agent",
        avatar: c.avatar || "A",
        text: c.text,
        date: c.date || "",
      })),
    }));
  }, [dbPosts]);
  const [newPostText, setNewPostText] = useState("");
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [editForm, setEditForm] = useState({
    name: profile.name,
    role: profile.role,
    bio: profile.bio,
    extendedBio: profile.extendedBio,
    location: profile.location,
    specialisation: profile.specialisation,
    certifications: profile.certifications,
  });

  const uploadAvatar = async (file: File): Promise<string | null> => {
    const formData = new FormData();
    formData.append("avatar", file);
    try {
      const { data } = await axiosClient.post("/api/auth/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const avatarUrl = data?.avatar || data?.image;
      if (avatarUrl) {
        queryClient.invalidateQueries({ queryKey: ["auth", "currentUser"] });
        return avatarUrl;
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    }
    return null;
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setProfileImage(previewUrl);
    const savedUrl = await uploadAvatar(file);
    if (savedUrl) setProfileImage(savedUrl);
  };

  const handleEditAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setEditImagePreview(previewUrl);
    const savedUrl = await uploadAvatar(file);
    if (savedUrl) setEditImagePreview(savedUrl);
  };

  const handleCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setActiveCoverImage(previewUrl);
    const savedUrl = await uploadAvatar(file);
    if (savedUrl) {
      setActiveCoverImage(savedUrl);
      saveProfileMutation.mutate({ coverImage: savedUrl } as any);
    }
  };

  const openEditProfile = () => {
    setEditForm({
      name: profile.name,
      role: profile.role,
      bio: profile.bio,
      extendedBio: profile.extendedBio,
      location: profile.location,
      specialisation: profile.specialisation,
      certifications: profile.certifications,
    });
    setEditImagePreview(profileImage);
    setShowEditProfile(true);
  };

  const saveProfile = () => {
    setProfile((prev) => ({
      ...prev,
      name: editForm.name,
      role: editForm.role,
      bio: editForm.bio,
      extendedBio: editForm.extendedBio,
      location: editForm.location,
      specialisation: editForm.specialisation,
      certifications: editForm.certifications,
      avatar: editForm.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase(),
    }));
    if (editImagePreview !== profileImage) {
      setProfileImage(editImagePreview);
    }
    saveProfileMutation.mutate({
      bio: editForm.bio,
      extendedBio: editForm.extendedBio,
      location: editForm.location,
      specialisation: editForm.specialisation,
      certifications: editForm.certifications,
    });
    setShowEditProfile(false);
  };

  const [newPostType, setNewPostType] = useState<TimelinePost["type"]>("deal");
  const [newPostImage, setNewPostImage] = useState<string | null>(null);
  const postPhotoInputRef = useRef<HTMLInputElement>(null);

  const toggleLike = (id: string) => {
    toggleLikeMutation.mutate(id);
  };

  const addComment = (postId: string, text: string) => {
    addCommentMutation.mutate({ postId, text });
  };

  const sharePost = (id: string) => {
    const post = timeline.find((p) => p.id === id);
    if (post) {
      navigator.clipboard?.writeText(post.content.slice(0, 100) + "...");
    }
  };

  const savePost = (_id: string) => {};

  const handleCreatePost = () => {
    if (!newPostText.trim()) return;
    const badgeMap: Record<string, string> = {
      deal: "Deal Win",
      knowledge: "Knowledge Guide",
      blog: "Blog Post",
      review: "Hotel Review",
      training: "Training Update",
      milestone: "Milestone",
    };
    createPostMutation.mutate({
      type: newPostType,
      content: newPostText.trim(),
      badge: badgeMap[newPostType] || null,
      image: newPostImage || null,
    });
    setNewPostText("");
    setNewPostImage(null);
    setNewPostType("deal");
  };

  const handlePostPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setNewPostImage(URL.createObjectURL(file));
  };

  const pinnedPosts = timeline.filter((p) => p.pinned);
  const regularPosts = timeline.filter((p) => !p.pinned);

  const tabs: { key: ProfileTab; label: string; icon: React.ElementType }[] = [
    { key: "timeline", label: "Timeline", icon: FileText },
    { key: "knowledge", label: "Knowledge", icon: BookOpen },
    { key: "training", label: "Training", icon: GraduationCap },
    { key: "achievements", label: "Achievements", icon: Trophy },
    { key: "leave", label: "Leave", icon: CalendarDays },
    { key: "about", label: "About", icon: Users },
  ];

  return (
    <div data-testid="page-hub-profiles" className="-mt-4 sm:-mt-6 lg:-mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Cover Photo */}
      <div className="relative h-48 sm:h-56 lg:h-64 overflow-hidden">
        <img src={activeCoverImage || defaultCoverImage} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent" />
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileChange} data-testid="input-cover-upload" />
        <button onClick={() => coverInputRef.current?.click()} className="absolute top-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-black/30 backdrop-blur-sm px-3 py-1.5 text-xs text-white hover:bg-black/40 transition" data-testid="button-edit-cover">
          <Camera className="h-3.5 w-3.5" />
          Edit Cover
        </button>
      </div>

      {/* Profile Header Card */}
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-20 mb-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="relative -mt-16 sm:-mt-20 flex-shrink-0">
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} data-testid="input-avatar-upload" />
                {profileImage ? (
                  <img src={profileImage} alt={profile.name} className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl object-cover border-4 border-white dark:border-slate-900 shadow-lg" data-testid="profile-avatar-large" />
                ) : (
                  <div className="h-28 w-28 sm:h-32 sm:w-32 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl sm:text-4xl font-bold border-4 border-white dark:border-slate-900 shadow-lg" data-testid="profile-avatar-large">
                    {profile.avatar}
                  </div>
                )}
                <button onClick={() => avatarInputRef.current?.click()} className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition" data-testid="button-change-avatar">
                  <Camera className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                </button>
                <div className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Online" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 sm:pt-2">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-profile-name">
                        {profile.name}
                      </h1>
                      <CheckCircle2 className="h-5 w-5 text-blue-500 fill-blue-500" />
                      <HubBadge variant="blue">{profile.role}</HubBadge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-lg">
                      {profile.bio}
                    </p>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <MapPin className="h-3 w-3" /> {profile.location}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Calendar className="h-3 w-3" /> Joined {profile.joined}
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                        <Plane className="h-3 w-3" /> {profile.specialisation}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white gap-1.5 text-xs" data-testid="button-edit-profile" onClick={openEditProfile}>
                      <Edit3 className="h-3.5 w-3.5" />
                      Edit Profile
                    </Button>
                    <Button variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" data-testid="button-share-profile">
                      <Share2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="flex items-center gap-6 mt-4 flex-wrap">
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.contributions}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Posts</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.dealWins}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Deal Wins</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center">
                    <div className="flex items-center gap-1">
                      <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.reputationScore}</p>
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Reputation</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{profile.trainingProgress}%</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Training</p>
                  </div>
                  <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
                  <div className="text-center">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {myProfit && myProfit.profitThisMonth != null
                        ? myProfit.profitThisMonth >= 1000
                          ? `£${(myProfit.profitThisMonth / 1000).toFixed(1)}k`
                          : `£${myProfit.profitThisMonth.toFixed(0)}`
                        : "—"}
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Profit This Month</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 mb-6">
          <div className="flex items-center gap-0 overflow-x-auto px-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition whitespace-nowrap",
                    isActive
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-300"
                  )}
                  data-testid={`profile-tab-${tab.key}`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === "timeline" && (
            <motion.div key="timeline" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                {/* Create Post */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start gap-3">
                    {profileImage ? (
                      <img src={profileImage} alt={profile.name} className="h-10 w-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {profile.avatar}
                      </div>
                    )}
                    <div className="flex-1">
                      <MentionTextarea
                        value={newPostText}
                        onChange={setNewPostText}
                        users={mentionUsers}
                        placeholder="Share a deal win, insight, or knowledge... Use @ to tag team members"
                        className="min-h-[40px] rounded-xl bg-slate-100 border-0 text-sm dark:bg-slate-800 resize-none"
                        rows={newPostText.length > 80 ? 3 : 1}
                        data-testid="input-new-post"
                      />
                    </div>
                  </div>
                  {newPostImage && (
                    <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200">
                      <img src={newPostImage} alt="Attached" className="w-full max-h-48 object-cover" />
                      <button
                        onClick={() => setNewPostImage(null)}
                        className="absolute top-2 right-2 h-6 w-6 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition"
                        data-testid="button-remove-post-image"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <Separator className="my-3" />
                  <input ref={postPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePostPhotoSelect} data-testid="input-post-photo" />
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      {([
                        { type: "deal" as const, icon: TrendingUp, label: "Deal Win", color: "text-emerald-500" },
                        { type: "knowledge" as const, icon: BookOpen, label: "Guide", color: "text-blue-500" },
                        { type: "review" as const, icon: Star, label: "Review", color: "text-orange-500" },
                      ]).map((item) => (
                        <button
                          key={item.type}
                          onClick={() => setNewPostType(item.type)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                            newPostType === item.type
                              ? "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white"
                              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          )}
                          data-testid={`button-post-type-${item.type}`}
                        >
                          <item.icon className={cn("h-3.5 w-3.5", item.color)} /> {item.label}
                        </button>
                      ))}
                      <button
                        onClick={() => postPhotoInputRef.current?.click()}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition",
                          newPostImage
                            ? "bg-purple-100 text-purple-700"
                            : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                        )}
                        data-testid="button-post-photo"
                      >
                        <Image className="h-3.5 w-3.5 text-purple-500" /> Photo
                      </button>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs"
                      data-testid="button-post"
                      disabled={!newPostText.trim()}
                      onClick={handleCreatePost}
                    >
                      Post
                    </Button>
                  </div>
                </div>

                {/* Pinned Posts */}
                {pinnedPosts.length > 0 && (
                  <div className="space-y-4">
                    {pinnedPosts.map((post) => (
                      <TimelinePostCard key={post.id} post={post} onLike={toggleLike} onComment={addComment} onShare={sharePost} onSave={savePost} profileAvatar={profile.avatar} profileName={profile.name} profileRole={profile.role} profileImage={profileImage} />
                    ))}
                  </div>
                )}

                {/* Regular Posts */}
                <div className="space-y-4">
                  {regularPosts.map((post) => (
                    <TimelinePostCard key={post.id} post={post} onLike={toggleLike} onComment={addComment} onShare={sharePost} onSave={savePost} profileAvatar={profile.avatar} profileName={profile.name} profileRole={profile.role} profileImage={profileImage} />
                  ))}
                </div>
              </div>

              {/* Right Sidebar */}
              <div className="space-y-4">
                {/* Skill Heatmap */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Skill Heatmap
                  </h3>
                  <div className="mt-3">
                    <SkillHeatmap skills={profile.skills} />
                  </div>
                </div>

                {/* Recent Achievements */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Recent Achievements
                  </h3>
                  <div className="mt-3 space-y-2">
                    {MOCK_ACHIEVEMENTS.filter((a) => a.earned).slice(0, 4).map((a) => {
                      const Icon = a.icon;
                      return (
                        <div key={a.id} className="flex items-center gap-2.5">
                          <div className={cn("h-8 w-8 rounded-lg bg-gradient-to-br flex items-center justify-center text-white flex-shrink-0", a.color)}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{a.title}</p>
                            <p className="text-[10px] text-slate-500">{a.date}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={() => setActiveTab("achievements")}
                    className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition"
                  >
                    View all achievements →
                  </button>
                </div>

                {/* Training Progress */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-purple-500" />
                    Training Progress
                  </h3>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-slate-500">Overall Completion</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{profile.trainingProgress}%</span>
                    </div>
                    <HubProgressBar value={profile.trainingProgress} />
                    <div className="mt-3 space-y-1.5">
                      {MOCK_TRAINING.filter((t) => t.progress < 100).slice(0, 3).map((t) => (
                        <div key={t.id} className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400 truncate max-w-[180px]">{t.title}</span>
                          <span className="text-[10px] font-medium text-slate-500">{t.progress}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab("training")}
                    className="mt-3 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 transition"
                  >
                    View all training →
                  </button>
                </div>

                {/* Quick Actions */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Quick Actions</h3>
                  <div className="space-y-1.5">
                    <button className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition text-left">
                      <Pen className="h-3.5 w-3.5 text-indigo-500" /> Write Blog Post
                    </button>
                    <button className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition text-left">
                      <Upload className="h-3.5 w-3.5 text-purple-500" /> Upload Training Video
                    </button>
                    <button className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition text-left">
                      <Star className="h-3.5 w-3.5 text-orange-500" /> Write Hotel Review
                    </button>
                    <button className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 transition text-left">
                      <MapPin className="h-3.5 w-3.5 text-emerald-500" /> Add Destination Insight
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "knowledge" && (
            <motion.div key="knowledge" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {MOCK_KNOWLEDGE.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 hover:shadow-md transition-shadow group cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        item.type === "guide" ? "bg-blue-50 dark:bg-blue-500/10" :
                        item.type === "review" ? "bg-orange-50 dark:bg-orange-500/10" :
                        "bg-emerald-50 dark:bg-emerald-500/10"
                      )}>
                        {item.type === "guide" ? <BookOpen className="h-5 w-5 text-blue-500" /> :
                         item.type === "review" ? <Star className="h-5 w-5 text-orange-500" /> :
                         <Zap className="h-5 w-5 text-emerald-500" />}
                      </div>
                      <span className="text-[10px] rounded-full bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-500 dark:bg-slate-800">
                        {item.type}
                      </span>
                    </div>
                    <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <MapPin className="h-2.5 w-2.5" /> {item.destination}
                      </span>
                      <span className="text-[10px] text-slate-400">{item.date}</span>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <ExternalLink className="h-2.5 w-2.5" /> {item.views} views
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                          <Bookmark className="h-2.5 w-2.5" /> {item.saves} saves
                        </span>
                      </div>
                      <button className="text-blue-500 hover:text-blue-600 transition">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === "training" && (
            <motion.div key="training" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <div className="space-y-3">
                  {MOCK_TRAINING.map((t) => (
                    <motion.div
                      key={t.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "h-10 w-10 rounded-lg flex items-center justify-center",
                            t.progress === 100 ? "bg-emerald-50 dark:bg-emerald-500/10" :
                            t.progress > 0 ? "bg-blue-50 dark:bg-blue-500/10" :
                            "bg-slate-100 dark:bg-slate-800"
                          )}>
                            {t.progress === 100 ? (
                              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <GraduationCap className={cn("h-5 w-5", t.progress > 0 ? "text-blue-500" : "text-slate-400")} />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{t.title}</h4>
                              {t.mandatory && (
                                <span className="text-[9px] rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
                                  Mandatory
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-0.5">
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> {t.duration}
                              </span>
                              {t.score !== null && (
                                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                  Score: {t.score}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {t.progress === 100 ? (
                            <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400 border-0 text-[10px]">
                              Completed
                            </Badge>
                          ) : t.progress > 0 ? (
                            <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs">
                              Continue
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" className="rounded-lg text-xs">
                              Start
                            </Button>
                          )}
                        </div>
                      </div>
                      {t.progress > 0 && t.progress < 100 && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-500">Progress</span>
                            <span className="font-medium text-slate-600 dark:text-slate-400">{t.progress}%</span>
                          </div>
                          <HubProgressBar value={t.progress} size="sm" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>

                {/* Training Sidebar */}
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Training Summary</h3>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-500">Overall</span>
                          <span className="font-bold">{profile.trainingProgress}%</span>
                        </div>
                        <HubProgressBar value={profile.trainingProgress} />
                      </div>
                      <Separator />
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                            {MOCK_TRAINING.filter((t) => t.progress === 100).length}
                          </p>
                          <p className="text-[10px] text-slate-500">Completed</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10">
                          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                            {MOCK_TRAINING.filter((t) => t.progress > 0 && t.progress < 100).length}
                          </p>
                          <p className="text-[10px] text-slate-500">In Progress</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">
                            {MOCK_TRAINING.filter((t) => t.mandatory && t.progress < 100).length}
                          </p>
                          <p className="text-[10px] text-slate-500">Required</p>
                        </div>
                        <div className="text-center p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                          <p className="text-lg font-bold text-slate-600 dark:text-slate-400">
                            {MOCK_TRAINING.filter((t) => t.progress === 0).length}
                          </p>
                          <p className="text-[10px] text-slate-500">Not Started</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Avg. Score</h3>
                    <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                      {Math.round(MOCK_TRAINING.filter((t) => t.score !== null).reduce((sum, t) => sum + (t.score || 0), 0) / MOCK_TRAINING.filter((t) => t.score !== null).length)}%
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Across {MOCK_TRAINING.filter((t) => t.score !== null).length} completed modules</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === "achievements" && (
            <motion.div key="achievements" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {MOCK_ACHIEVEMENTS.map((a) => {
                  const Icon = a.icon;
                  return (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={cn(
                        "rounded-xl border p-5 text-center transition-all",
                        a.earned
                          ? "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 hover:shadow-md"
                          : "border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50 opacity-60"
                      )}
                    >
                      <div className={cn(
                        "mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br flex items-center justify-center text-white",
                        a.color
                      )}>
                        <Icon className="h-7 w-7" />
                      </div>
                      <h4 className="mt-3 text-sm font-semibold text-slate-900 dark:text-white">{a.title}</h4>
                      <p className="mt-1 text-xs text-slate-500">{a.description}</p>
                      {a.earned ? (
                        <Badge className="mt-2 bg-emerald-50 text-emerald-700 border-0 dark:bg-emerald-500/10 dark:text-emerald-400 text-[10px]">
                          Earned {a.date}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="mt-2 text-[10px] text-slate-400 border-slate-300">
                          Locked
                        </Badge>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === "leave" && (
            <motion.div key="leave" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <MyLeaveSection />
            </motion.div>
          )}

          {activeTab === "about" && (
            <motion.div key="about" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">About</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <Users className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.role} at Tina's Travel Deals</p>
                        <p className="text-xs text-slate-500">Current Role</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.location}</p>
                        <p className="text-xs text-slate-500">Location</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Calendar className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.joined}</p>
                        <p className="text-xs text-slate-500">Joined</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Plane className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.specialisation}</p>
                        <p className="text-xs text-slate-500">Specialisations</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Award className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{profile.certifications}</p>
                        <p className="text-xs text-slate-500">Certifications</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Bio</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {profile.extendedBio}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-500" />
                    Skill Breakdown
                  </h3>
                  <SkillHeatmap skills={profile.skills} />
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-4">Career Stats</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-500/10">
                      <p className="text-xl font-bold text-blue-600 dark:text-blue-400">204</p>
                      <p className="text-[10px] text-slate-500">Total Bookings</p>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 dark:bg-emerald-500/10">
                      <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">£186k</p>
                      <p className="text-[10px] text-slate-500">Revenue (12mo)</p>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 dark:bg-amber-500/10">
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">68%</p>
                      <p className="text-[10px] text-slate-500">Close Rate</p>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-3 dark:bg-purple-500/10">
                      <p className="text-xl font-bold text-purple-600 dark:text-purple-400">4.8</p>
                      <p className="text-[10px] text-slate-500">Client Rating</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-3">Top Destinations</h3>
                  <div className="space-y-2">
                    {[
                      { name: "Turkey", bookings: 68, pct: 33 },
                      { name: "Spain (Canaries)", bookings: 45, pct: 22 },
                      { name: "Greece", bookings: 32, pct: 16 },
                      { name: "Maldives", bookings: 24, pct: 12 },
                      { name: "Caribbean", bookings: 18, pct: 9 },
                    ].map((d) => (
                      <div key={d.name} className="flex items-center gap-3">
                        <span className="w-28 text-xs text-slate-600 dark:text-slate-400">{d.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                          <div className="h-2 rounded-full bg-blue-500" style={{ width: `${d.pct}%` }} />
                        </div>
                        <span className="text-[10px] font-medium text-slate-500 w-12 text-right">{d.bookings} deals</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-lg rounded-2xl" data-testid="dialog-edit-profile">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid gap-1.5">
              <Label className="text-xs font-medium text-slate-600">Profile Photo</Label>
              <div className="flex items-center gap-4">
                <input ref={editAvatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleEditAvatarFileChange} data-testid="input-edit-avatar-upload" />
                {editImagePreview ? (
                  <img src={editImagePreview} alt="Preview" className="h-16 w-16 rounded-xl object-cover border border-slate-200" data-testid="img-edit-avatar-preview" />
                ) : (
                  <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg font-bold border border-slate-200">
                    {profile.avatar}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="rounded-lg text-xs gap-1.5" onClick={() => editAvatarInputRef.current?.click()} data-testid="button-edit-avatar-upload">
                    <Camera className="h-3.5 w-3.5" />
                    {editImagePreview ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {editImagePreview && (
                    <button type="button" onClick={() => setEditImagePreview(null)} className="text-[10px] text-red-500 hover:text-red-600 transition text-left" data-testid="button-remove-avatar">
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-name" className="text-xs font-medium text-slate-600">Full Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                className="rounded-lg"
                data-testid="input-edit-name"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-role" className="text-xs font-medium text-slate-600">Role</Label>
              <Input
                id="edit-role"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
                className="rounded-lg"
                data-testid="input-edit-role"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-location" className="text-xs font-medium text-slate-600">Location</Label>
              <Input
                id="edit-location"
                value={editForm.location}
                onChange={(e) => setEditForm((p) => ({ ...p, location: e.target.value }))}
                className="rounded-lg"
                data-testid="input-edit-location"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-specialisation" className="text-xs font-medium text-slate-600">Specialisation</Label>
              <Input
                id="edit-specialisation"
                value={editForm.specialisation}
                onChange={(e) => setEditForm((p) => ({ ...p, specialisation: e.target.value }))}
                className="rounded-lg"
                data-testid="input-edit-specialisation"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-certifications" className="text-xs font-medium text-slate-600">Certifications</Label>
              <Input
                id="edit-certifications"
                value={editForm.certifications}
                onChange={(e) => setEditForm((p) => ({ ...p, certifications: e.target.value }))}
                className="rounded-lg"
                data-testid="input-edit-certifications"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-bio" className="text-xs font-medium text-slate-600">Short Bio</Label>
              <Textarea
                id="edit-bio"
                value={editForm.bio}
                onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                rows={2}
                className="rounded-lg resize-none"
                data-testid="input-edit-bio"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-extended-bio" className="text-xs font-medium text-slate-600">Full Bio</Label>
              <Textarea
                id="edit-extended-bio"
                value={editForm.extendedBio}
                onChange={(e) => setEditForm((p) => ({ ...p, extendedBio: e.target.value }))}
                rows={4}
                className="rounded-lg resize-none"
                data-testid="input-edit-extended-bio"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setShowEditProfile(false)} data-testid="button-cancel-edit-profile">
              Cancel
            </Button>
            <Button size="sm" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white" onClick={saveProfile} data-testid="button-save-profile">
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-service Leave section — backed by /api/v2/hr/me + /api/v2/hr/me/leave.
// Branch managers see submitted requests as "Pending" in the manager HR page.
// ─────────────────────────────────────────────────────────────────────────────

const LEAVE_TYPES: LeaveType[] = ["Annual", "Sick", "Unpaid", "Other"];

function formatDateLine(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function leaveStatusClasses(status: LeaveEntry["status"]): string {
  switch (status) {
    case "Approved":  return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Rejected":  return "bg-rose-50 text-rose-700 border-rose-200";
    case "Cancelled": return "bg-slate-100 text-slate-600 border-slate-200";
    default:          return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function MyLeaveSection() {
  const [requestOpen, setRequestOpen] = useState(false);
  const me = useMyHrRecord();

  if (me.isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-12 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-center" data-testid="leave-loading">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 text-sm text-rose-600" data-testid="leave-error">
        Couldn't load your leave record. {(me.error as any)?.response?.data?.message ?? "Please refresh."}
      </div>
    );
  }

  const record = me.data!;
  const allowance = record.holidayAllowance ?? 0;
  const used = record.holidayUsedDays ?? 0;
  const remaining = Math.max(0, allowance - used);
  const pct = allowance ? Math.round((used / allowance) * 100) : 0;

  const sorted = [...record.holidays].sort((a, b) => (a.from < b.from ? 1 : -1));
  const pending = sorted.filter((h) => h.status === "Pending");
  const decided = sorted.filter((h) => h.status !== "Pending");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" data-testid="card-my-allowance">
          <div className="text-xs text-slate-500 mb-1">Holiday allowance</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">
            {used}
            <span className="text-base font-medium text-slate-400"> / {allowance || "—"} days</span>
          </div>
          {allowance > 0 && (
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="text-xs text-slate-500 mt-2">{remaining} days remaining</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900" data-testid="card-my-pending">
          <div className="text-xs text-slate-500 mb-1">Pending requests</div>
          <div className="text-2xl font-semibold text-slate-900 dark:text-white">{pending.length}</div>
          <div className="text-xs text-slate-500 mt-3">Awaiting manager approval</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500 mb-1">Need time off?</div>
            <div className="text-sm font-medium text-slate-900 dark:text-white">
              Submit a request for approval.
            </div>
          </div>
          <Button onClick={() => setRequestOpen(true)} data-testid="button-request-my-leave" className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-1.5 h-4 w-4" /> Request
          </Button>
        </div>
      </div>

      <RequestLeaveDialog
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
      />

      {pending.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Awaiting approval</h3>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {pending.map((h) => (
              <li key={h.id} className="px-5 py-3 flex items-center gap-4" data-testid={`row-my-leave-${h.id}`}>
                <Clock className="h-4 w-4 text-amber-500 flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {h.type} · {formatDateLine(h.from)} – {formatDateLine(h.to)}
                  </div>
                  {h.reason && <div className="text-xs text-slate-500 mt-0.5">{h.reason}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${leaveStatusClasses(h.status)}`}>
                  {h.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">History</h3>
        </div>
        {decided.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-slate-500">No past leave on record.</div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {decided.map((h) => (
              <li key={h.id} className="px-5 py-3 flex items-center gap-4" data-testid={`row-my-leave-history-${h.id}`}>
                <CalendarDays className="h-4 w-4 text-slate-400 flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {h.type} · {formatDateLine(h.from)} – {formatDateLine(h.to)}
                  </div>
                  {h.reason && <div className="text-xs text-slate-500 mt-0.5">{h.reason}</div>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${leaveStatusClasses(h.status)}`}>
                  {h.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RequestLeaveDialog({
  open, onClose,
}: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [type, setType] = useState<LeaveType>("Annual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const submit = useRequestMyLeave();

  const handleSubmit = () => {
    submit.mutate(
      { type, from, to, reason: reason || undefined },
      {
        onSuccess: () => {
          toast({ title: "Leave requested", description: "Your manager has been notified." });
          setFrom(""); setTo(""); setReason(""); setType("Annual");
          onClose();
        },
        onError: (err: any) => {
          toast({
            title: "Couldn't submit request",
            description: err?.response?.data?.message ?? "Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const valid = !!from && !!to && from <= to;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request leave</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <select value={type} onChange={(e) => setType(e.target.value as LeaveType)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              data-testid="select-request-type">
              {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-request-from" />
            </div>
            <div className="space-y-1.5">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-request-to" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} data-testid="input-request-reason" />
          </div>
          {!valid && from && to && (
            <p className="text-xs text-rose-600">'To' must be on or after 'From'.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!valid || submit.isPending}
            data-testid="button-submit-request">
            {submit.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Submit request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
