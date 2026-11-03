import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { CheckCircle2, Clock, Eye, Globe, Pencil, Sparkles, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { EnrichedQuote } from "@/features/quote/types";
import { derivePostStatus, STATUS_META, type SocialPostStatus } from "@/features/social/lib/post-status";
import { getFirstImage, getSubtitle } from "@/features/social/lib/quote-card-fields";
import { cn } from "@/lib/utils";
import { useSocialChannel } from "@/features/social/api/use-social-settings-queries";
import { cardPriceLabel, getCardFields, postPlatforms } from "./card-fields";
import { PostCardMenu } from "./post-card-menu";
import { PostCardStatusBar } from "./post-card-status-bar";

const STATUS_ICONS: Record<SocialPostStatus, LucideIcon> = {
  scheduled: Clock,
  posted: CheckCircle2,
  draft: Pencil,
  not_generated: Sparkles,
};

export interface SocialPostCardProps {
  quote: EnrichedQuote;
  isGenerating: boolean;
  busy: boolean;
  onEdit: (quote: EnrichedQuote) => void;
  onGenerate: (quote: EnrichedQuote) => void;
  onSchedule: (quote: EnrichedQuote) => void;
  onTogglePortal: (quoteId: string, value: boolean) => Promise<boolean>;
  onToggleFeatured: (quoteId: string, value: boolean) => Promise<boolean>;
  onMoveToDrafts: (quote: EnrichedQuote) => void;
  onDelete: (quote: EnrichedQuote) => void;
}

interface FlagProps {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}

function Flag({ label, icon: Icon, iconClass, checked, onChange, testId }: FlagProps) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-normal text-[#374151] dark:text-foreground" data-testid={testId}>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} className="h-4 w-4" />
      <Icon className={cn("h-3.5 w-3.5", iconClass)} />
      {label}
    </label>
  );
}

export function SocialPostCard(props: SocialPostCardProps) {
  const { quote, isGenerating, busy } = props;
  const boardSearch = useSearch();
  const viewQuoteHref = `/social-posts/quotes/${quote.id}${boardSearch ? `?from=${encodeURIComponent(boardSearch)}` : ""}`;
  const status = derivePostStatus(quote);
  const StatusIcon = STATUS_ICONS[status];
  const penLabel = status === "posted" ? "Post again" : status === "not_generated" ? "Generate post" : "Edit post";
  const { data: channel } = useSocialChannel();
  const operator = quote.main_tour_operator_name;

  // Optimistic: flip locally, roll back if the request fails.
  const [portal, setPortal] = useState(!!quote.show_on_portal);
  const [featured, setFeatured] = useState(!!quote.is_featured);
  useEffect(() => setPortal(!!quote.show_on_portal), [quote.show_on_portal]);
  useEffect(() => setFeatured(!!quote.is_featured), [quote.is_featured]);

  const toggle = (set: (v: boolean) => void, request: (id: string, v: boolean) => Promise<boolean>) => async (value: boolean) => {
    set(value);
    if (!(await request(quote.id, value))) set(!value);
  };

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-social-border bg-card text-card-foreground shadow-[0_1px_2px_rgba(30,41,59,.05)]" data-testid={`card-social-post-${quote.id}`}>
      <div className="relative h-[174px] overflow-hidden bg-social-page">
        <img src={getFirstImage(quote) ?? "/images/default-hotel.jpg"} alt={quote.title || "Deal image"} className="h-full w-full object-cover" />
        {operator && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-white/95 px-2.5 py-[3px] text-[11.5px] font-semibold text-[#1F2937]">{operator}</span>
        )}
        <span className={cn("absolute right-3 top-3 inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold shadow-[0_1px_3px_rgba(0,0,0,.18)]", STATUS_META[status].badgeClass)}>
          <StatusIcon className="h-3 w-3" />
          {STATUS_META[status].label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-[11px] px-4 py-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-semibold" data-testid={`text-title-${quote.id}`}>{quote.title || "Untitled"}</h3>
            <p className="mt-0.5 truncate text-[12.5px] text-social-muted">{getSubtitle(quote)}</p>
          </div>
          <span className="shrink-0 whitespace-nowrap rounded-full bg-social-navy-ink px-3 py-1 text-[12.5px] font-semibold text-white" data-testid={`badge-price-${quote.id}`}>
            {cardPriceLabel(quote)}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
          {getCardFields(quote).map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-[11px] text-social-muted">{field.label}</dt>
              <dd className="truncate text-[12.5px] font-semibold">{field.value}</dd>
            </div>
          ))}
        </dl>

        <div className="flex gap-4">
          <Flag label="Add to Portal" icon={Globe} iconClass="text-emerald-500" checked={portal} onChange={toggle(setPortal, props.onTogglePortal)} testId={`checkbox-portal-${quote.id}`} />
          <Flag label="Featured deal" icon={Star} iconClass="text-yellow-500" checked={featured} onChange={toggle(setFeatured, props.onToggleFeatured)} testId={`checkbox-featured-${quote.id}`} />
        </div>

        <div className="mt-auto flex flex-col gap-[11px]">
          <PostCardStatusBar
            status={status}
            postSchedule={quote.postSchedule}
            isGenerating={isGenerating}
            onSchedule={() => props.onSchedule(quote)}
            onGenerate={() => props.onGenerate(quote)}
            platforms={postPlatforms(quote, channel)}
            onOpen={() => props.onEdit(quote)}
          />
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" className="inline-flex h-[38px] flex-1 items-center justify-center gap-2 rounded-[10px] border-social-border bg-card text-[13px] font-semibold" data-testid={`button-view-quote-${quote.id}`}>
              <Link href={viewQuoteHref}>
                <Eye className="h-4 w-4" />
                View quote
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-[10px] border-social-border bg-card text-social-muted"
              aria-label={penLabel}
              title={penLabel}
              disabled={isGenerating}
              onClick={() => (status === "not_generated" ? props.onGenerate(quote) : props.onEdit(quote))}
              data-testid={`button-edit-post-${quote.id}`}
            >
              <Pencil className="h-[18px] w-[18px]" />
            </Button>
            <PostCardMenu
              quoteId={quote.id}
              status={status}
              postSchedule={quote.postSchedule}
              busy={busy}
              onEdit={() => props.onEdit(quote)}
              onSchedule={() => props.onSchedule(quote)}
              onMoveToDrafts={() => props.onMoveToDrafts(quote)}
              onDelete={() => props.onDelete(quote)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
