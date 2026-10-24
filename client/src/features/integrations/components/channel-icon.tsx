import { RadioTower, Send } from "lucide-react";
import { CHANNELS } from "@/features/conversations";
import type { ConversationChannel } from "@/features/conversations";
import { cn } from "@/lib/utils";

const KNOWN: ConversationChannel[] = ["whatsapp", "messenger", "instagram", "email", "sms"];

/** Round channel badge; Telegram and unknown types get a neutral fallback. */
export function ChannelIcon({ type, size = "md" }: { type: string; size?: "md" | "lg" }) {
  const t = type.toLowerCase();
  const box = size === "lg" ? "h-10 w-10" : "h-9 w-9";
  const known = KNOWN.find((k) => k === t);
  if (known) {
    const Icon = CHANNELS[known].icon;
    return (
      <span className={cn("grid shrink-0 place-items-center rounded-full", box, CHANNELS[known].badge)} aria-hidden>
        <Icon className="h-4 w-4" />
      </span>
    );
  }
  const Icon = t === "telegram" ? Send : RadioTower;
  const tone = t === "telegram" ? "bg-sky-500 text-white" : "bg-muted text-social-muted";
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", box, tone)} aria-hidden>
      <Icon className="h-4 w-4" />
    </span>
  );
}
