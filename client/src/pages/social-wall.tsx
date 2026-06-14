import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Facebook,
  Instagram,
  Layers,
  Mail,
  MessageCircle,
  Music2,
  Newspaper,
  Twitter,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChannelKey = "facebook" | "instagram" | "twitter" | "tiktok" | "whatsapp" | "email";
type PostStatus = "posted" | "scheduled";

interface ChannelMeta {
  key: ChannelKey;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  facebook: {
    key: "facebook",
    label: "Facebook",
    icon: Facebook,
    badgeClass: "border-blue-500/25 bg-blue-500/10 text-blue-600",
  },
  instagram: {
    key: "instagram",
    label: "Instagram",
    icon: Instagram,
    badgeClass: "border-pink-500/25 bg-pink-500/10 text-pink-600",
  },
  twitter: {
    key: "twitter",
    label: "X / Twitter",
    icon: Twitter,
    badgeClass: "border-sky-500/25 bg-sky-500/10 text-sky-600",
  },
  tiktok: {
    key: "tiktok",
    label: "TikTok",
    icon: Music2,
    badgeClass: "border-black/20 bg-black/[0.06] text-black/80",
  },
  whatsapp: {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    badgeClass: "border-green-500/25 bg-green-500/10 text-green-600",
  },
  email: {
    key: "email",
    label: "Email",
    icon: Mail,
    badgeClass: "border-indigo-500/25 bg-indigo-500/10 text-indigo-600",
  },
};

const CHANNEL_ORDER: ChannelKey[] = [
  "facebook",
  "instagram",
  "twitter",
  "tiktok",
  "whatsapp",
  "email",
];

interface SocialItem {
  id: string;
  channel: ChannelKey;
  author: string;
  handle: string;
  content: string;
  image?: string;
  status: PostStatus;
  timestamp: string; // ISO
}

// Illustrative placeholder data only — no backend, no API calls.
const SAMPLE_ITEMS: SocialItem[] = [
  {
    id: "1",
    channel: "instagram",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "☀️ Last-minute Maldives escape! 7 nights overwater villa, half board, from £1,899pp. Limited cabins left — DM us to book. #Maldives #LuxuryTravel",
    image:
      "https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=400&q=70&auto=format&fit=crop",
    status: "posted",
    timestamp: "2026-06-12T09:30:00Z",
  },
  {
    id: "2",
    channel: "facebook",
    author: "Tina's Travel",
    handle: "Tina's Travel Agency",
    content:
      "Dreaming of a white Christmas? ❄️ Our Lapland family adventures are now open for December 2026 — meet Santa, husky rides & the Northern Lights.",
    image:
      "https://images.unsplash.com/photo-1418985991508-e47386d96a71?w=400&q=70&auto=format&fit=crop",
    status: "scheduled",
    timestamp: "2026-06-20T08:00:00Z",
  },
  {
    id: "3",
    channel: "tiktok",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "POV: you just booked a Mediterranean cruise 🛳️ 8 ports, 7 nights, balcony cabin. Tap the link in bio for the full itinerary!",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=400&q=70&auto=format&fit=crop",
    status: "scheduled",
    timestamp: "2026-06-15T17:45:00Z",
  },
  {
    id: "4",
    channel: "twitter",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "Flash deal ✈️ Return flights to Dubai from £319 this October. Quote DUBAI319 when you enquire. Ends Friday!",
    status: "posted",
    timestamp: "2026-06-11T14:10:00Z",
  },
  {
    id: "5",
    channel: "email",
    author: "Tina's Travel",
    handle: "newsletter@tinastravel.co.uk",
    content:
      "June Newsletter: 10 sun-soaked summer escapes still available, plus our top tips for travelling with little ones. Open to see this month's picks.",
    status: "posted",
    timestamp: "2026-06-10T07:00:00Z",
  },
  {
    id: "6",
    channel: "whatsapp",
    author: "Tina's Travel",
    handle: "Broadcast list",
    content:
      "Hi! 👋 Your Tenerife quote expires tomorrow. Reply YES to lock in the price before it goes up. — Team Tina's Travel",
    status: "scheduled",
    timestamp: "2026-06-14T10:00:00Z",
  },
  {
    id: "7",
    channel: "instagram",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "Reel: 60 seconds in Santorini 🇬🇷 Sunsets, blue domes & the best little taverna we found. Save this for your 2027 trip!",
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=70&auto=format&fit=crop",
    status: "posted",
    timestamp: "2026-06-09T18:20:00Z",
  },
  {
    id: "8",
    channel: "facebook",
    author: "Tina's Travel",
    handle: "Tina's Travel Agency",
    content:
      "Thank you to the Henderson family for these gorgeous photos from their Orlando holiday 🎢 We love seeing your memories!",
    image:
      "https://images.unsplash.com/photo-1597466599360-3b9775841aec?w=400&q=70&auto=format&fit=crop",
    status: "posted",
    timestamp: "2026-06-08T12:00:00Z",
  },
  {
    id: "9",
    channel: "twitter",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "Top tip 🧳 Always check passport validity — many countries need 6 months left from your return date. We'll remind you when you book with us.",
    status: "scheduled",
    timestamp: "2026-06-18T09:00:00Z",
  },
  {
    id: "10",
    channel: "tiktok",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "3 underrated European city breaks under £250 🏰 Which one are you adding to your list? #CityBreak #TravelTok",
    status: "posted",
    timestamp: "2026-06-07T16:30:00Z",
  },
];

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ChannelBadge({ channel }: { channel: ChannelKey }) {
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        meta.badgeClass
      )}
      data-testid={`badge-channel-${channel}`}
    >
      <Icon className="h-3 w-3" />
      {meta.label}
    </span>
  );
}

function StatusPill({ status, timestamp }: { status: PostStatus; timestamp: string }) {
  if (status === "scheduled") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
        data-testid="pill-status-scheduled"
      >
        <CalendarClock className="h-3 w-3" />
        Scheduled · {formatTimestamp(timestamp)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700"
      data-testid="pill-status-posted"
    >
      <CheckCircle2 className="h-3 w-3" />
      Posted
    </span>
  );
}

function PostItemCard({ item }: { item: SocialItem }) {
  return (
    <div
      className="flex gap-3 rounded-2xl border border-black/10 bg-white/70 p-3 transition hover:bg-white/90"
      data-testid={`card-social-item-${item.id}`}
    >
      {item.image && (
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-xl border border-black/10 object-cover"
          data-testid={`img-social-item-${item.id}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ChannelBadge channel={item.channel} />
          <StatusPill status={item.status} timestamp={item.timestamp} />
        </div>
        <p
          className="mt-2 line-clamp-3 text-sm text-black/80"
          data-testid={`text-social-content-${item.id}`}
        >
          {item.content}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-black/50">
          <span className="font-semibold text-black/65" data-testid={`text-social-author-${item.id}`}>
            {item.author}
          </span>
          <span data-testid={`text-social-handle-${item.id}`}>{item.handle}</span>
          <span className="text-black/25">•</span>
          <span data-testid={`text-social-time-${item.id}`}>{formatTimestamp(item.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, count }: { icon: LucideIcon; title: string; count: number }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Icon className="h-4 w-4 text-black/70" />
      <h2 className="text-sm font-semibold text-black">{title}</h2>
      <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-black/55">
        {count}
      </span>
    </div>
  );
}

export default function SocialWallPage() {
  const [activeChannel, setActiveChannel] = useState<ChannelKey | "all">("all");

  const filtered = useMemo(() => {
    if (activeChannel === "all") return SAMPLE_ITEMS;
    return SAMPLE_ITEMS.filter((i) => i.channel === activeChannel);
  }, [activeChannel]);

  const scheduled = useMemo(
    () =>
      filtered
        .filter((i) => i.status === "scheduled")
        .sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp)),
    [filtered]
  );

  const posted = useMemo(
    () =>
      filtered
        .filter((i) => i.status === "posted")
        .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [filtered]
  );

  const combined = useMemo(
    () => filtered.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [filtered]
  );

  return (
    <div className="px-5 pb-8 pt-5" data-testid="page-social-wall">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Newspaper className="h-5 w-5 text-black/70" />
          <div>
            <h1 className="text-lg font-semibold text-black" data-testid="text-page-title">
              Social Wall
            </h1>
            <p className="text-xs text-black/55" data-testid="text-page-subtitle">
              All your channels and email in one place.
            </p>
          </div>
        </div>

        {/* Channel filter chips */}
        <div className="flex flex-wrap gap-1.5" data-testid="filter-channels">
          <button
            type="button"
            onClick={() => setActiveChannel("all")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
              activeChannel === "all"
                ? "border-black/20 bg-black/[0.06] text-black"
                : "border-black/10 bg-white/70 text-black/60 hover:bg-black/[0.03]"
            )}
            data-testid="chip-channel-all"
          >
            All
          </button>
          {CHANNEL_ORDER.map((key) => {
            const meta = CHANNELS[key];
            const Icon = meta.icon;
            const active = activeChannel === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveChannel(key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition",
                  active
                    ? "border-black/20 bg-black/[0.06] text-black"
                    : "border-black/10 bg-white/70 text-black/60 hover:bg-black/[0.03]"
                )}
                data-testid={`chip-channel-${key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Posted / Scheduled */}
        <Card
          className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
          data-testid="card-posted-scheduled"
        >
          <SectionTitle icon={CalendarClock} title="Posted & Scheduled" count={scheduled.length + posted.length} />

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45" data-testid="label-scheduled">
                Scheduled
              </div>
              <div className="space-y-2" data-testid="list-scheduled">
                {scheduled.length === 0 ? (
                  <p className="text-xs text-black/45" data-testid="empty-scheduled">No scheduled posts.</p>
                ) : (
                  scheduled.map((item) => <PostItemCard key={item.id} item={item} />)
                )}
              </div>
            </div>

            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-black/45" data-testid="label-posted">
                Posted
              </div>
              <div className="space-y-2" data-testid="list-posted">
                {posted.length === 0 ? (
                  <p className="text-xs text-black/45" data-testid="empty-posted">No posted items.</p>
                ) : (
                  posted.map((item) => <PostItemCard key={item.id} item={item} />)
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Combined feed */}
        <Card
          className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
          data-testid="card-combined-feed"
        >
          <SectionTitle icon={Layers} title="Combined Feed" count={combined.length} />
          <div className="space-y-2" data-testid="list-combined">
            {combined.length === 0 ? (
              <p className="text-xs text-black/45" data-testid="empty-combined">No items for this channel.</p>
            ) : (
              combined.map((item) => <PostItemCard key={item.id} item={item} />)
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
