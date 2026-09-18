import { useState } from "react";
import {
  Bot,
  BotOff,
  CalendarCheck,
  ChevronDown,
  Ellipsis,
  Eye,
  FileText,
  ListTodo,
  Merge,
  MessageSquare,
  Phone,
  Pin,
  Share2,
  SquarePen,
  SquarePlus,
  Ticket,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { NeonClient } from "@/features/client/types/neon-client";
import type { Client } from "@/features/client/components/client-types";
import { composeAddress } from "@/features/client/lib/compose-address";
import { CircleAction } from "@/features/client/components/circle-action";

export type ClientCreateKind = "enquiry" | "quote" | "booking" | "task" | "ticket";

const BADGE_OPTIONS = ["New Client", "Repeat Client", "VIP Client", "Family Member", "Time Waster", "Banned"] as const;

// Rows of the badge dropdown: square-edged, grey text, generous left inset.
const BADGE_ITEM_CLASS =
  "cursor-pointer rounded-none px-6 py-1.5 text-sm font-normal text-[#5b6770] focus:bg-[#f2f6f8] focus:text-[#2f3a41] dark:text-white/70 dark:focus:bg-white/10 dark:focus:text-white";

interface ClientIndexHeaderProps {
  client: Client;
  clientData: NeonClient | undefined;
  isFavorited: boolean;
  onToggleFavorite: () => void;
  onChangeBadge: (badge: string | null) => void;
  onEdit: () => void;
  onMerge: () => void;
  aiReplyEnabled: boolean;
  onToggleAiReply: (enabled: boolean) => void;
  onCreate: (kind: ClientCreateKind) => void;
}

/**
 * Client page header for the overview: name, phone pill, badge chooser and
 * address on the left; View / Share / Pin circles and the "+" create menu on
 * the right. Merge and the AI auto-reply toggle live in the overflow menu.
 */
export function ClientIndexHeader({
  client,
  clientData,
  isFavorited,
  onToggleFavorite,
  onChangeBadge,
  onEdit,
  onMerge,
  aiReplyEnabled,
  onToggleAiReply,
  onCreate,
}: ClientIndexHeaderProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const address = composeAddress(clientData);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast({ title: "Link copied", description: "The client page link is on your clipboard." });
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Couldn't copy the link", variant: "destructive" });
    }
  };

  // Left padding = the page content padding (1rem, 2rem from md) + 13px, the
  // grey container's 1px border and p-3, so the name starts flush with the white
  // cards below rather than with the grey container.
  return (
    <div
      className="flex h-[76px] shrink-0 items-center justify-between gap-4 border-b border-black/10 bg-white pl-[calc(1rem_+_13px)] pr-6 md:pl-[calc(2rem_+_13px)] dark:border-white/10 dark:bg-white/[0.04]"
      data-testid="client-index-header"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <h2 className="truncate text-lg font-semibold text-black/90 dark:text-white" data-testid="client-center-header">
            {client.name}
          </h2>
          {client.phone && (
            <span
              className="inline-flex shrink-0 items-center gap-1.5 rounded-[6px] bg-[#fe9a00] px-3 py-1 text-[13px] font-semibold text-white"
              data-testid="client-index-phone"
            >
              <Phone className="h-3.5 w-3.5" />
              {client.phone}
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-[#07a9f4] pl-3.5 pr-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[#0596db]"
                data-testid="client-index-badge"
              >
                {clientData?.badge || "No Badge"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            {/* Plain white panel per the design: thin blue-grey border, no icons,
                roomy grey rows, left edge flush with the badge. */}
            <DropdownMenuContent
              align="start"
              sideOffset={6}
              className="min-w-[176px] rounded-[5px] border border-[#cfdde2] bg-white px-0 py-2 shadow-sm dark:border-white/15 dark:bg-[#1b2530]"
            >
              {BADGE_OPTIONS.map((option) => (
                <DropdownMenuItem key={option} onClick={() => onChangeBadge(option)} className={BADGE_ITEM_CLASS} data-testid={`client-index-badge-option-${option}`}>
                  {option}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => onChangeBadge(null)} className={cn(BADGE_ITEM_CLASS, "text-[#5b6770]/60")} data-testid="client-index-badge-option-none">
                No Badge
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-black/50 dark:text-white/50">
          <span className="truncate" data-testid="client-center-header-contact">
            {address || "No address on file"}
          </span>
          <button
            type="button"
            onClick={onEdit}
            title="Edit client"
            className="shrink-0 text-[#a3a3a3] transition hover:text-black/70"
            data-testid="client-index-button-edit"
          >
            <SquarePen className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {/* View / Share / Pin sit as one group; the create button stands apart. */}
        <div className="flex items-center gap-2">
        <CircleAction icon={Eye} label="View client" size="sm" testId="client-index-view-button" />
        <CircleAction icon={Share2} label={copied ? "Link copied" : "Share client link"} onClick={() => void share()} size="sm" testId="client-index-share" />
        <CircleAction
          icon={Pin}
          label={isFavorited ? "Unpin client" : "Pin client"}
          onClick={onToggleFavorite}
          active={isFavorited}
          size="sm"
          testId="client-index-pin"
        />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Create…"
              aria-label="Create"
              className="ml-5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#07a9f4] text-white transition hover:bg-[#0596db]"
              data-testid="client-index-create"
            >
              <SquarePlus className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-sm">
            <DropdownMenuItem onClick={() => onCreate("enquiry")} className="gap-2 rounded-sm text-sm" data-testid="client-index-create-enquiry">
              <MessageSquare className="h-4 w-4" /> Create Enquiry
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("quote")} className="gap-2 rounded-sm text-sm" data-testid="client-index-create-quote">
              <FileText className="h-4 w-4" /> Create Quote
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("booking")} className="gap-2 rounded-sm text-sm" data-testid="client-index-create-booking">
              <CalendarCheck className="h-4 w-4" /> Create Booking
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onCreate("task")} className="gap-2 rounded-sm text-sm" data-testid="client-index-create-task">
              <ListTodo className="h-4 w-4" /> Create Task
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreate("ticket")} className="gap-2 rounded-sm text-sm" data-testid="client-index-create-ticket">
              <Ticket className="h-4 w-4" /> Create Ticket
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="More"
              aria-label="More actions"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-black/50 transition hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/10"
              data-testid="client-index-more"
            >
              <Ellipsis className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-sm">
            <DropdownMenuItem onClick={() => onToggleAiReply(!aiReplyEnabled)} className="gap-2 rounded-sm text-sm" data-testid="client-index-ai-reply">
              {aiReplyEnabled ? <BotOff className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              {aiReplyEnabled ? "Turn AI replies off" : "Turn AI replies on"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMerge} className="gap-2 rounded-sm text-sm" data-testid="client-index-button-merge">
              <Merge className="h-4 w-4" /> Merge client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
