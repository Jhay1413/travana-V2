import lunaImg from "@assets/Luna-Platform-600-Final_1780477526775.png";
import { useEffect, useRef, useState } from "react";
import { Paperclip, StickyNote } from "lucide-react";
import { cn } from "@/lib/utils";
import { CHANNELS } from "../channels";
import { messagesApi } from "../api/messages.api";
import type { Conversation, ConversationMessage, MessageAttachment } from "../types";

// Shared thread rendering: the message bubble, its attachments, and the
// day-grouping helpers. Used by the unified inbox and by the read-only thread on
// a client's Chats tab, so both render a conversation identically.

// ─── Formatting ───────────────────────────────────────────────────────────────

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_GRADIENTS = [
  "from-emerald-400 to-teal-600",
  "from-violet-400 to-purple-600",
  "from-amber-400 to-orange-600",
  "from-sky-400 to-blue-600",
  "from-pink-400 to-rose-600",
  "from-indigo-400 to-blue-700",
];

export function gradientFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
}

// ─── Attachments ──────────────────────────────────────────────────────────────

// Renders one attachment. Images are fetched as a blob through the shared axios
// client (so auth + the app's configured base URL apply) and shown via an object
// URL — a raw <img src="/api/…"> would bypass that and break off-origin. The blob
// fetch is deferred until the image scrolls near the viewport (IntersectionObserver)
// so opening a long thread renders instantly instead of firing every image request
// at once. Non-image files fetch on click and open in a new tab.
export function AttachmentView({ attachment }: { attachment: MessageAttachment }) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(false);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  // Start loading only when the placeholder is about to enter the viewport.
  useEffect(() => {
    if (!attachment.isImage || inView) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }, // prefetch just before it's visible
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [attachment.isImage, inView]);

  useEffect(() => {
    if (!attachment.isImage || !inView) return;
    let active = true;
    let created: string | null = null;
    messagesApi
      .attachmentBlob(attachment.id)
      .then((blob) => {
        if (!active) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [attachment.id, attachment.isImage, inView]);

  if (attachment.isImage) {
    if (failed) {
      return (
        <div className="rounded-lg bg-black/5 px-2.5 py-1.5 text-xs text-black/50 dark:bg-white/10 dark:text-white/50">
          Couldn't load image
        </div>
      );
    }
    if (!objectUrl) {
      // Reserved box keeps layout stable and is the IntersectionObserver target.
      return <div ref={placeholderRef} className="h-40 w-40 animate-pulse rounded-lg bg-black/10 dark:bg-white/10" />;
    }
    return (
      <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="block">
        <img src={objectUrl} alt={attachment.filename} className="max-h-64 max-w-full rounded-lg object-cover" />
      </a>
    );
  }

  const openFile = async () => {
    try {
      const blob = await messagesApi.attachmentBlob(attachment.id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      /* ignore — the button simply does nothing on failure */
    }
  };
  return (
    <button
      type="button"
      onClick={openFile}
      className="flex items-center gap-2 rounded-lg bg-black/5 px-2.5 py-1.5 text-xs font-medium hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15"
    >
      <Paperclip className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate">{attachment.filename}</span>
    </button>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

export function MessageBubble({ message, conversation }: { message: ConversationMessage; conversation: Conversation }) {
  const outbound = message.direction === "outbound";
  const meta = CHANNELS[conversation.channel];
  const ChannelIcon = meta.icon;

  // Internal notes are teammate-only — render as a centered amber sticky note.
  if (message.isNote) {
    return (
      <div className="flex justify-center">
        <div className="max-w-[80%] rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm text-amber-800 dark:text-amber-200">
          <div className="mb-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-600/80 dark:text-amber-300/80">
            <StickyNote className="h-3 w-3" /> Internal note · {clockTime(message.sentAt)}
          </div>
          <p className="whitespace-pre-wrap">{message.body}</p>
        </div>
      </div>
    );
  }

  // Design: wide soft bubbles with the sender's avatar tucked over the outer
  // top corner and the time sitting inside the bubble's bottom-right.
  const avatar = outbound ? (
    message.isAi ? (
      <span
        className="block h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 ring-2 ring-white dark:ring-[#0b0b0f]"
        title="Luna (AI)"
      >
        <img src={lunaImg} alt="Luna" className="h-full w-full scale-[1.55] object-cover object-[50%_8%]" />
      </span>
    ) : message.authorAvatarUrl ? (
      <img
        src={message.authorAvatarUrl}
        alt=""
        title={message.authorName}
        className="h-10 w-10 rounded-full object-cover ring-2 ring-white dark:ring-[#0b0b0f]"
      />
    ) : (
      <span
        className="grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-[11px] font-bold text-white ring-2 ring-white dark:ring-[#0b0b0f]"
        title={message.authorName}
      >
        {message.authorName ? initials(message.authorName) : <ChannelIcon className="h-4 w-4" />}
      </span>
    )
  ) : (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-indigo-500 text-[11px] font-bold text-white ring-2 ring-white dark:ring-[#0b0b0f]">
      {initials(conversation.contact.displayName)}
    </span>
  );

  return (
    <div className={cn("flex", outbound ? "justify-end pr-3" : "justify-start pl-3")}>
      <div className="relative max-w-[64%] pt-3">
        <span className={cn("absolute top-0 z-10", outbound ? "-right-3" : "-left-3")}>{avatar}</span>
        <div
          className={cn(
            "rounded-xl px-6 pb-2 pt-5 text-[15px] leading-relaxed",
            outbound
              ? "rounded-tr-none bg-sky-100 text-black/85 dark:bg-sky-500/15 dark:text-white/90"
              : "rounded-tl-none bg-slate-200/70 text-black/85 dark:bg-white/[0.08] dark:text-white/90",
          )}
        >
          {message.body && <p className="whitespace-pre-wrap">{message.body}</p>}
          {message.attachments && message.attachments.length > 0 && (
            <div className={cn("flex flex-col gap-1.5", message.body && "mt-2")}>
              {message.attachments.map((a) => (
                <AttachmentView key={a.id} attachment={a} />
              ))}
            </div>
          )}
          {message.cta && (
            <>
              <div className="my-2 h-px bg-black/10" />
              <div className="text-center text-sm font-semibold text-black">{message.cta.label}</div>
            </>
          )}
          <div className="mt-2 text-right text-xs text-black/45 dark:text-white/45">{clockTime(message.sentAt)}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Day grouping ─────────────────────────────────────────────────────────────

export interface MessageDayGroup {
  /** Divider caption, e.g. "Today, 14:32". */
  day: string;
  messages: ConversationMessage[];
}

// Groups a thread's messages into consecutive same-day runs for the dividers.
export function groupMessagesByDay(messages: ConversationMessage[]): MessageDayGroup[] {
  const out: MessageDayGroup[] = [];
  for (const m of messages) {
    const key = dayLabel(m.sentAt);
    const last = out[out.length - 1];
    if (last && last.day.startsWith(key)) last.messages.push(m);
    else out.push({ day: `${key}, ${clockTime(m.sentAt)}`, messages: [m] });
  }
  return out;
}

export function DayDivider({ label }: { label: string }) {
  return (
    <div className="flex justify-center">
      <span className="rounded-lg border border-black/15 bg-white px-6 py-1.5 text-sm text-black/50 dark:border-white/15 dark:bg-transparent dark:text-white/50">
        {label}
      </span>
    </div>
  );
}
