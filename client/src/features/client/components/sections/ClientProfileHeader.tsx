import { Bot, BotOff, ChevronDown, Phone, Pin, PinOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const BADGE_OPTIONS = [
  "New Client",
  "Repeat Client",
  "VIP Client",
  "Family Member",
  "Time Waster",
  "Banned",
] as const;

function badgePill(badge: string | null | undefined): string {
  switch (badge) {
    case "VIP Client":
      return "border-blue-200 bg-blue-50 text-blue-600";
    case "Banned":
    case "Time Waster":
      return "border-red-200 bg-red-50 text-red-600";
    case "Repeat Client":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "Family Member":
      return "border-violet-200 bg-violet-50 text-violet-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

interface ClientProfileHeaderProps {
  name: string;
  phone?: string | null;
  badge?: string | null;
  isFavorited: boolean;
  // Opt-in for the SendSeven AI auto-reply on this client's conversations
  // (default OFF — the bot stays silent until an agent enables it here or
  // per-conversation from the inbox).
  aiReplyEnabled: boolean;
  onToggleFavorite: () => void;
  onChangeBadge: (badge: string | null) => void;
  onToggleAiReply: (enabled: boolean) => void;
}

export function ClientProfileHeader({
  name,
  phone,
  badge,
  isFavorited,
  aiReplyEnabled,
  onToggleFavorite,
  onChangeBadge,
  onToggleAiReply,
}: ClientProfileHeaderProps) {
  return (
    <div className="mb-4" data-testid="section-client-profile-header">
      <div className="flex flex-wrap items-center gap-3">
        <h1
          className="font-serif text-xl font-bold leading-none text-black"
          data-testid="text-client-name"
        >
          {name}
        </h1>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95 ${badgePill(
                badge,
              )}`}
              data-testid="button-client-badge"
            >
              {badge || "No Badge"}
              <ChevronDown className="h-3 w-3 opacity-70" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="z-[500]">
            {BADGE_OPTIONS.map((option) => (
              <DropdownMenuItem
                key={option}
                onClick={() => onChangeBadge(option)}
                data-testid={`badge-option-${option}`}
              >
                {option}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              onClick={() => onChangeBadge(null)}
              className="text-black/60"
              data-testid="badge-option-none"
            >
              No Badge
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <button
          type="button"
          onClick={onToggleFavorite}
          aria-pressed={isFavorited}
          title={isFavorited ? "Unpin client" : "Pin client"}
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
            isFavorited
              ? "border-amber-400 bg-amber-400/20 text-amber-700"
              : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
          }`}
          data-testid="button-client-pin"
        >
          {isFavorited ? (
            <Pin className="h-3.5 w-3.5 fill-current" />
          ) : (
            <PinOff className="h-3.5 w-3.5" />
          )}
        </button>

        <button
          type="button"
          onClick={() => onToggleAiReply(!aiReplyEnabled)}
          aria-pressed={aiReplyEnabled}
          title={
            aiReplyEnabled
              ? "AI auto-reply is ON for this client's conversations — click to turn off"
              : "AI auto-reply is OFF for this client's conversations — click to turn on"
          }
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95 ${
            aiReplyEnabled
              ? "border-emerald-300 bg-emerald-50 text-emerald-700"
              : "border-black/10 bg-black/[0.03] text-black/50"
          }`}
          data-testid="button-client-ai-reply"
        >
          {aiReplyEnabled ? <Bot className="h-3.5 w-3.5" /> : <BotOff className="h-3.5 w-3.5" />}
          {aiReplyEnabled ? "AI replies on" : "AI replies off"}
        </button>
      </div>

      {phone && (
        <a
          href={`tel:${phone.replace(/\s/g, "")}`}
          className="mt-2 inline-flex items-center gap-2 text-base font-semibold text-black/80 transition-colors hover:text-blue-600"
          data-testid="text-client-phone"
        >
          <Phone className="h-4 w-4 text-black/60" />
          {phone}
        </a>
      )}
    </div>
  );
}
