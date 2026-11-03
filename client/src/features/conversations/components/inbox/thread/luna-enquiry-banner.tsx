import { Sparkles, X } from "lucide-react";

export interface LunaEnquiryBannerProps {
  onReview(): void;
  onDismiss(): void;
}

export function LunaEnquiryBanner({ onReview, onDismiss }: LunaEnquiryBannerProps) {
  return (
    <div
      className="mx-5 mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-luna-border bg-luna-bg px-3.5 py-3"
      data-testid="luna-enquiry-banner"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-luna-tile text-luna-fg">
        <Sparkles className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-luna-title">Luna spotted a holiday request</div>
        <div className="truncate text-[12px] text-social-muted">Review the chat and create an enquiry in one step.</div>
      </div>
      <button
        type="button"
        onClick={onReview}
        className="h-[34px] shrink-0 rounded-xl bg-social-orange px-3.5 text-[13px] font-semibold text-slate-900 hover:bg-social-orange-text"
        data-testid="luna-enquiry-review"
      >
        Review enquiry
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg text-social-muted hover:bg-black/5 dark:hover:bg-white/10"
        data-testid="luna-enquiry-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
