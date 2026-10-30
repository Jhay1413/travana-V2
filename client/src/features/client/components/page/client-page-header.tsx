import { Bot, BotOff, ChevronDown, Ellipsis, Merge, Phone, Pin, Plus, Share2, ShieldUser, SquarePen } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import type { NeonClient } from "@/features/client/types/neon-client";
import { CreateMenu, type CreateKind } from "@/components/shared/create-menu";
import { composeAddress } from "@/features/client/lib/compose-address";
import { useNeonClient } from "@/hooks/queries";
import { RoundButton } from "./round-button";

export const BADGE_OPTIONS = ["New Client", "Repeat Client", "VIP Client", "Family Member", "Time Waster", "Banned"] as const;

const PILL = "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1 text-[13px] font-semibold";

/** "Referred by {name}" under the client name; dashed "+ Add" when nobody referred them. */
function ReferredByPill({ referrerId, readOnly, onChange }: { referrerId: string | null; readOnly: boolean; onChange: () => void }) {
  const { data: referrer, isLoading } = useNeonClient(referrerId ?? "");
  const name = referrer ? `${referrer.firstName} ${referrer.surename}`.trim() : "";
  const base = "mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-dashed border-ticket-dashed px-3 py-1 text-[12px] text-social-muted";

  if (!referrerId) {
    return (
      <button type="button" onClick={onChange} className={`${base} transition hover:text-foreground`} data-testid="button-set-referrer">
        <ShieldUser className="h-3.5 w-3.5 shrink-0 text-sky-500" strokeWidth={1.8} />
        Referred by
        <span className="inline-flex items-center gap-0.5 font-semibold text-social-orange-text">
          <Plus className="h-3 w-3" /> Add
        </span>
      </button>
    );
  }

  const label = name || (isLoading ? "…" : "Unknown");
  return (
    <div className={base} data-testid="client-index-referrer">
      <ShieldUser className="h-3.5 w-3.5 shrink-0 text-sky-500" strokeWidth={1.8} />
      <span className="shrink-0">Referred by</span>
      {readOnly ? (
        <span className="truncate font-semibold text-foreground" data-testid="referrer-field">
          {label}
        </span>
      ) : (
        <button type="button" onClick={onChange} className="truncate font-semibold text-foreground underline-offset-2 hover:underline" title="Change referrer" data-testid="button-change-referrer">
          {label}
        </button>
      )}
    </div>
  );
}

interface ClientPageHeaderProps {
  name: string;
  phone: string;
  clientData: NeonClient | undefined;
  isFavorited: boolean;
  readOnly: boolean;
  aiReplyEnabled: boolean;
  onEdit: () => void;
  onShare: () => void;
  onTogglePin: () => void;
  onChangeBadge: (badge: string | null) => void;
  clientId: string;
  onCreate: (kind: CreateKind) => void;
  onMerge: () => void;
  onToggleAiReply: (enabled: boolean) => void;
  onChangeReferrer: () => void;
}

/**
 * Header: name, click-to-copy phone pill, client tier (the existing client
 * `badge`) and address on the left; Share / Pin / the "+" create menu and
 * the overflow menu on the right. Read-only roles lose every write control.
 */
export function ClientPageHeader({
  name,
  phone,
  clientData,
  isFavorited,
  readOnly,
  aiReplyEnabled,
  onEdit,
  onShare,
  onTogglePin,
  onChangeBadge,
  onCreate,
  onMerge,
  onToggleAiReply,
  onChangeReferrer,
}: ClientPageHeaderProps) {
  const { toast } = useToast();
  const address = composeAddress(clientData);
  const badge = clientData?.badge || null;
  const tierLabel = badge ?? "No tier";
  const referrerId = clientData?.referredByClientId ?? null;

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(phone);
      toast({ title: `${phone} copied` });
    } catch {
      toast({ title: "Could not copy the number", variant: "destructive" });
    }
  };

  return (
    <div
      className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-social-border bg-card px-4 py-5 md:px-8"
      data-testid="client-index-header"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="truncate text-2xl font-semibold" data-testid="client-center-header">
            {name}
          </h1>
          {phone && (
            <button
              type="button"
              onClick={() => void copyPhone()}
              title="Copy number"
              className={`${PILL} bg-social-orange text-slate-900 transition hover:bg-social-orange-text hover:text-white`}
              data-testid="client-index-phone"
            >
              <Phone className="h-3.5 w-3.5" strokeWidth={1.8} />
              {phone}
            </button>
          )}
          {readOnly ? (
            <span className={`${PILL} bg-[#E0F2FE] text-[#075985]`} data-testid="client-index-badge">
              {tierLabel}
            </span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={`${PILL} gap-1 bg-[#E0F2FE] text-[#075985] transition hover:opacity-80`}
                  data-testid="client-index-badge"
                >
                  {tierLabel}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {BADGE_OPTIONS.map((option) => (
                  <DropdownMenuItem
                    key={option}
                    onClick={() => onChangeBadge(option)}
                    className={option === badge ? "font-semibold" : undefined}
                    data-testid={`client-index-badge-option-${option}`}
                  >
                    {option}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onChangeBadge(null)} data-testid="client-index-badge-option-none">
                  No tier
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {(!readOnly || referrerId) && (
          <ReferredByPill referrerId={referrerId} readOnly={readOnly} onChange={onChangeReferrer} />
        )}
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[13px] text-social-muted">
          <span className="truncate" data-testid="client-center-header-contact">
            {address || "No address on file"}
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit address"
              title="Edit details"
              className="shrink-0 transition hover:text-foreground"
              data-testid="client-index-button-edit"
            >
              <SquarePen className="h-3.5 w-3.5" strokeWidth={1.8} />
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <RoundButton label="Share client" tone="sky" onClick={onShare} data-testid="client-index-share">
          <Share2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </RoundButton>
        <RoundButton
          label={isFavorited ? "Unpin client" : "Pin client"}
          tone="orange"
          active={isFavorited}
          onClick={onTogglePin}
          data-testid="client-index-pin"
        >
          <Pin className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </RoundButton>
        {!readOnly && (
          <CreateMenu
            trigger={
              <RoundButton label="Create" tone="sky" data-testid="client-index-create">
                <Plus className="h-[18px] w-[18px]" strokeWidth={2} />
              </RoundButton>
            }
            onCreate={onCreate}
            testId="client-index-create"
          />
        )}
        {!readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions"
                title="More"
                className="grid h-9 w-9 place-items-center rounded-full text-social-muted transition hover:bg-muted hover:text-foreground"
                data-testid="client-index-more"
              >
                <Ellipsis className="h-5 w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onEdit} data-testid="client-index-menu-edit">
                Edit details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleAiReply(!aiReplyEnabled)} className="gap-2" data-testid="client-index-ai-reply">
                {aiReplyEnabled ? <BotOff className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                {aiReplyEnabled ? "Turn AI replies off" : "Turn AI replies on"}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onMerge} className="gap-2" data-testid="client-index-button-merge">
                <Merge className="h-4 w-4" /> Merge client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
