interface DraftBannerProps {
  onResume: () => void;
  onDiscard: () => void;
}

/** Shown above the tabs when "Save and finish later" left a half-finished allocation behind. */
export function DraftBanner({ onResume, onDiscard }: DraftBannerProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-ticket-amber-bg px-5 py-3.5" role="status" data-testid="draft-banner">
      <div>
        <div className="text-[13px] font-semibold">You have an unfinished allocation</div>
        <div className="text-[12px] text-social-muted">Nothing has changed yet. Pick up where you left off, or throw the draft away.</div>
      </div>
      <div className="flex items-center gap-4">
        <button type="button" onClick={onResume} className="text-[14px] font-semibold text-social-orange-text hover:underline" data-testid="button-resume-draft">
          Resume
        </button>
        <button type="button" onClick={onDiscard} className="text-[14px] text-social-muted hover:text-foreground hover:underline" data-testid="button-discard-draft">
          Discard draft
        </button>
      </div>
    </div>
  );
}
