import { useMemo } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Facebook,
  Instagram,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ChannelKey = "messenger" | "facebook" | "whatsapp" | "instagram";
type PostStatus = "posted" | "scheduled";

interface ChannelMeta {
  key: ChannelKey;
  label: string;
  icon: LucideIcon;
  badgeClass: string;
}

const CHANNELS: Record<ChannelKey, ChannelMeta> = {
  messenger: {
    key: "messenger",
    label: "Facebook Messenger",
    icon: MessagesSquare,
    badgeClass: "border-blue-500/25 bg-blue-500/10 text-blue-600",
  },
  facebook: {
    key: "facebook",
    label: "Facebook Posts",
    icon: Facebook,
    badgeClass: "border-blue-500/25 bg-blue-500/10 text-blue-600",
  },
  whatsapp: {
    key: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    badgeClass: "border-green-500/25 bg-green-500/10 text-green-600",
  },
  instagram: {
    key: "instagram",
    label: "Instagram Posts",
    icon: Instagram,
    badgeClass: "border-pink-500/25 bg-pink-500/10 text-pink-600",
  },
};

const COLUMN_ORDER: ChannelKey[] = ["messenger", "facebook", "whatsapp", "instagram"];

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
  // Facebook Messenger
  {
    id: "m1",
    channel: "messenger",
    author: "Sarah Jenkins",
    handle: "via Messenger",
    content:
      "Hi! Is the Maldives overwater villa deal still available for October? We're a family of four.",
    status: "posted",
    timestamp: "2026-06-12T09:30:00Z",
  },
  {
    id: "m2",
    channel: "messenger",
    author: "Tina's Travel",
    handle: "Auto-reply",
    content:
      "Thanks for messaging Tina's Travel! 👋 One of our agents will reply within the hour. Meanwhile, browse our latest deals on the website.",
    status: "scheduled",
    timestamp: "2026-06-20T08:00:00Z",
  },
  {
    id: "m3",
    channel: "messenger",
    author: "Mark Doyle",
    handle: "via Messenger",
    content:
      "Can you send over the Tenerife quote again? I think it expired. Ready to book this week.",
    status: "posted",
    timestamp: "2026-06-11T14:10:00Z",
  },
  // Facebook Posts
  {
    id: "f1",
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
    id: "f2",
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
    id: "f3",
    channel: "facebook",
    author: "Tina's Travel",
    handle: "Tina's Travel Agency",
    content:
      "Flash deal ✈️ Return flights to Dubai from £319 this October. Comment DUBAI319 to enquire. Ends Friday!",
    status: "posted",
    timestamp: "2026-06-11T14:10:00Z",
  },
  // WhatsApp
  {
    id: "w1",
    channel: "whatsapp",
    author: "Tina's Travel",
    handle: "Broadcast list",
    content:
      "Hi! 👋 Your Tenerife quote expires tomorrow. Reply YES to lock in the price before it goes up. — Team Tina's Travel",
    status: "scheduled",
    timestamp: "2026-06-14T10:00:00Z",
  },
  {
    id: "w2",
    channel: "whatsapp",
    author: "Tina's Travel",
    handle: "Broadcast list",
    content:
      "New summer deals just dropped ☀️ 7 nights all-inclusive in Turkey from £549pp. Reply INFO for the full list.",
    status: "posted",
    timestamp: "2026-06-10T07:00:00Z",
  },
  {
    id: "w3",
    channel: "whatsapp",
    author: "Tina's Travel",
    handle: "Broadcast list",
    content:
      "Reminder: check-in for the Peterson party opens in 48 hours ✈️ We'll send your boarding passes shortly.",
    status: "scheduled",
    timestamp: "2026-06-18T09:00:00Z",
  },
  // Instagram Posts
  {
    id: "i1",
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
    id: "i2",
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
    id: "i3",
    channel: "instagram",
    author: "Tina's Travel",
    handle: "@tinastravel",
    content:
      "POV: you just booked a Mediterranean cruise 🛳️ 8 ports, 7 nights, balcony cabin. Tap the link in bio for the full itinerary!",
    image:
      "https://images.unsplash.com/photo-1548574505-5e239809ee19?w=400&q=70&auto=format&fit=crop",
    status: "scheduled",
    timestamp: "2026-06-15T17:45:00Z",
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

function StatusPill({ id, status, timestamp }: { id: string; status: PostStatus; timestamp: string }) {
  if (status === "scheduled") {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700"
        data-testid={`pill-status-scheduled-${id}`}
      >
        <CalendarClock className="h-3 w-3" />
        Scheduled · {formatTimestamp(timestamp)}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-green-500/25 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold text-green-700"
      data-testid={`pill-status-posted-${id}`}
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
        <StatusPill id={item.id} status={item.status} timestamp={item.timestamp} />
        <p
          className="mt-2 line-clamp-4 text-sm text-black/80"
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

function ChannelColumn({ channel, items }: { channel: ChannelKey; items: SocialItem[] }) {
  const meta = CHANNELS[channel];
  const Icon = meta.icon;
  const sorted = useMemo(
    () => items.slice().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)),
    [items]
  );

  return (
    <Card
      className="glass ringed grain flex flex-col rounded-3xl border-black/10 bg-white/70 p-4"
      data-testid={`card-column-${channel}`}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
            meta.badgeClass
          )}
        >
          <Icon className="h-3 w-3" />
        </span>
        <h2 className="text-sm font-semibold text-black" data-testid={`title-column-${channel}`}>
          {meta.label}
        </h2>
        <span className="ml-auto rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] font-semibold text-black/55">
          {sorted.length}
        </span>
      </div>

      <div className="space-y-2" data-testid={`list-column-${channel}`}>
        {sorted.length === 0 ? (
          <p className="text-xs text-black/45" data-testid={`empty-column-${channel}`}>
            Nothing here yet.
          </p>
        ) : (
          sorted.map((item) => <PostItemCard key={item.id} item={item} />)
        )}
      </div>
    </Card>
  );
}

export default function SocialWallPage() {
  const byChannel = useMemo(() => {
    const map: Record<ChannelKey, SocialItem[]> = {
      messenger: [],
      facebook: [],
      whatsapp: [],
      instagram: [],
    };
    for (const item of SAMPLE_ITEMS) map[item.channel].push(item);
    return map;
  }, []);

  return (
    <div className="px-5 pb-8 pt-5" data-testid="page-social-wall">
      <div className="mb-4 flex items-center gap-2">
        <Newspaper className="h-5 w-5 text-black/70" />
        <div>
          <h1 className="text-lg font-semibold text-black" data-testid="text-page-title">
            Social Wall
          </h1>
          <p className="text-xs text-black/55" data-testid="text-page-subtitle">
            Messenger, Facebook, WhatsApp and Instagram — all in one view.
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4" data-testid="grid-social-columns">
        {COLUMN_ORDER.map((channel) => (
          <ChannelColumn key={channel} channel={channel} items={byChannel[channel]} />
        ))}
      </div>
    </div>
  );
}
