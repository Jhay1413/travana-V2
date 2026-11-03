import { CalendarClock, ChevronRight, Copy, ExternalLink, Pencil, Trash2, TreePalm } from "lucide-react";
import { Link } from "wouter";
import { StatusPill, type PillTone } from "@/components/shared/status-pill";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HOLIDAY_BTN, HOLIDAY_BTN_PRIMARY, HOLIDAY_ICON_BTN } from "@/features/client/components/holiday/holiday-styles";
import { TopBarIconButton, TopBarPinButton } from "@/features/client/components/holiday/top-bar-parts";

/**
 * Header of the social quote page: breadcrumb, title, pills and the action row.
 *
 * Props:
 * - title: the quote title (falls back to "Social quote").
 * - status: quote status; shown as a pill only when it is a state worth flagging (lost, in play, archived).
 * - boardPath: where "Social posts" in the breadcrumb goes (keeps the board's filters).
 * - supplierUrl: quote_ref; the "Supplier page" link shows only for http(s) URLs.
 * - hasGuru: shows the Destination Guru icon.
 * - pinned / onTogglePin: favourite state.
 * - onOpenGuru / onCopy / onEdit / onUpdateExpiry / onDelete: the matching actions.
 */
export interface SocialQuoteTopBarProps {
  title: string;
  status: string;
  boardPath: string;
  supplierUrl?: string | null;
  hasGuru: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onOpenGuru: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onUpdateExpiry: () => void;
  onDelete: () => void;
}

const STATUS_TONE: Record<string, PillTone> = { lost: "bad", rejected: "bad", in_play: "warn", archived: "plain" };

function statusLabel(status: string): string {
  const text = status.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const LINK = "font-medium text-social-navy hover:underline";

export function SocialQuoteTopBar({
  title,
  status,
  boardPath,
  supplierUrl,
  hasGuru,
  pinned,
  onTogglePin,
  onOpenGuru,
  onCopy,
  onEdit,
  onUpdateExpiry,
  onDelete,
}: SocialQuoteTopBarProps) {
  const tone = STATUS_TONE[status];
  const showSupplier = !!supplierUrl && /^https?:\/\//i.test(supplierUrl);
  return (
    <TooltipProvider>
      <header
        className="col-span-full flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-social-border bg-card px-[18px] py-3.5"
        data-testid="row-social-quote-header"
      >
        <div className="min-w-0">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[13px] text-qp-muted">
            <Link href="/" className={LINK}>
              Home
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <Link href={boardPath} className={LINK} data-testid="button-back-social-posts">
              Social posts
            </Link>
            <ChevronRight className="size-3" aria-hidden />
            <span aria-current="page">Quote</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-semibold leading-tight" data-testid="text-social-quote-title">
              {title || "Social quote"}
            </h1>
            <StatusPill tone="info">Social quote</StatusPill>
            {tone && (
              <span data-testid={`pill-quote-status-${status}`}>
                <StatusPill tone={tone}>{statusLabel(status)}</StatusPill>
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-testid="row-social-quote-actions">
          {showSupplier && (
            <a href={supplierUrl ?? undefined} target="_blank" rel="noopener noreferrer" className={HOLIDAY_BTN} data-testid="link-view-social-quote">
              Supplier page
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
          {hasGuru && (
            <TopBarIconButton label="Destination Guru" onClick={onOpenGuru} testId="button-destination-guru-social-quote">
              <TreePalm className="size-[18px]" />
            </TopBarIconButton>
          )}
          <TopBarPinButton pinned={pinned} onToggle={onTogglePin} />
          <button type="button" className={HOLIDAY_BTN} onClick={onEdit} data-testid="button-edit-social-quote">
            <Pencil className="size-4" />
            Edit
          </button>
          <button type="button" className={HOLIDAY_BTN} onClick={onUpdateExpiry} data-testid="button-expiry-social-quote">
            <CalendarClock className="size-4" />
            Update expiry
          </button>
          <button type="button" className={HOLIDAY_BTN_PRIMARY} onClick={onCopy} data-testid="button-copy-social-quote">
            <Copy className="size-4" />
            Copy to client
          </button>
          <button
            type="button"
            className={`${HOLIDAY_ICON_BTN} hover:border-status-failed-fg hover:bg-status-failed-bg hover:text-status-failed-fg`}
            aria-label="Delete quote"
            title="Delete quote"
            onClick={onDelete}
            data-testid="button-delete-social-quote"
          >
            <Trash2 className="size-[18px]" />
          </button>
        </div>
      </header>
    </TooltipProvider>
  );
}
