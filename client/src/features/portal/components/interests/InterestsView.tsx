import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Check } from "lucide-react";
import { usePortalAllTags, usePortalMyTags, useSavePortalTags } from "@/hooks/use-portal-api";
import { cn } from "@/lib/utils";
import { portalNextTarget } from "../../portal-nav";
import { canSaveInterests, selectionText, toggleId } from "../../lib/interests";
import { usePortalBrandingValue } from "../../theme/PortalThemeProvider";
import { AgencyMark, Eyebrow, PortalButton, PortalHero } from "../brand";

/**
 * Travel interests. Customers land here on first login (the shell sends them, carrying `next` and a pending
 * `change-pin=1`), and can come back from Account to change them. Saving returns to `next`, else Home.
 */
export function InterestsView() {
  const [, setLocation] = useLocation();
  const branding = usePortalBrandingValue();
  const { data: allTags = [], isLoading: allLoading } = usePortalAllTags();
  const { data: myTags = [], isLoading: myLoading } = usePortalMyTags();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialised, setInitialised] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveTags = useSavePortalTags();

  const isEditMode = myTags.length > 0;

  useEffect(() => {
    if (!myLoading && !initialised) {
      setSelected(new Set(myTags.map((t) => t.id)));
      setInitialised(true);
    }
  }, [myTags, myLoading, initialised]);

  async function handleContinue() {
    setSaveFailed(false);
    try {
      await saveTags.mutateAsync(Array.from(selected));
    } catch {
      setSaveFailed(true);
      return;
    }
    // A forced visit can carry a pending destination (e.g. the new-PIN form from a reset link).
    setLocation(portalNextTarget(window.location.search));
  }

  const isLoading = allLoading || myLoading;

  return (
    <div className="relative flex min-h-dvh flex-col bg-background" data-testid="portal-interests">
      <PortalHero className="h-[480px] md:h-[480px]">
        <Eyebrow className="text-accent">Travel interests</Eyebrow>
        <h1 className="portal-serif w-full max-w-full text-[50px] font-light leading-none text-white [overflow-wrap:anywhere]">
          {isEditMode ? "Travel" : "What are"}
          <br />
          <em className="italic">{isEditMode ? "interests." : "you into?"}</em>
        </h1>
        <p className="max-w-[290px] text-[15px] leading-[1.7] text-white/80" data-testid="text-interests-intro">
          {isEditMode
            ? "Update your interests to get the most relevant deals."
            : "Pick your travel interests so we can show you the most relevant deals and recommendations."}
        </p>
      </PortalHero>
      <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-5xl items-center justify-between px-6 py-[22px] text-white">
        <AgencyMark branding={branding} tone="dark" />
        {isEditMode && (
          <PortalButton variant="link" className="text-white hover:text-white/80" onClick={() => setLocation("/portal")} data-testid="button-interests-back">
            ← Back
          </PortalButton>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-7 pb-8 pt-10">
        {isLoading ? (
          <div role="status" aria-label="Loading interests" className="mt-10 flex animate-pulse flex-wrap gap-2.5" data-testid="interests-loading">
            {[96, 120, 80, 140, 104, 90].map((w, i) => (
              <div key={i} className="h-11 bg-secondary" style={{ width: w }} />
            ))}
          </div>
        ) : allTags.length === 0 ? (
          <p className="mt-10 text-[15px] text-muted-foreground" data-testid="interests-none">
            There are no interests to choose from yet.
          </p>
        ) : (
          <ul className="mt-10 flex flex-wrap gap-2.5" aria-label="Travel interests" data-testid="interests-list">
            {allTags.map((tag) => {
              const on = selected.has(tag.id);
              return (
                <li key={tag.id} className="max-w-full">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setSelected((prev) => toggleId(prev, tag.id))}
                    className={cn(
                      "inline-flex min-h-11 max-w-full items-center gap-2 border px-4 text-[11px] font-normal uppercase tracking-[0.16em] transition-colors [overflow-wrap:anywhere]",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent text-primary hover:bg-secondary",
                    )}
                    data-testid={`button-interest-tag-${tag.id}`}
                  >
                    {on && <Check className="size-4 flex-none" strokeWidth={1.75} aria-hidden />}
                    {tag.name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-border bg-background pb-[max(16px,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-3xl flex-col gap-3 px-7 pt-4">
          <p className="text-center text-[15px] text-muted-foreground" aria-live="polite" data-testid="text-interests-count">
            {selectionText(selected.size)}
          </p>
          {saveFailed && (
            <p role="alert" className="portal-text-danger text-center text-[15px]" data-testid="text-interests-error">
              We couldn&apos;t save your interests. Please try again.
            </p>
          )}
          <PortalButton size="lg" className="w-full" onClick={handleContinue} disabled={!canSaveInterests(selected.size, saveTags.isPending)} data-testid="button-save-interests">
            {saveTags.isPending ? "Saving…" : isEditMode ? "Save interests" : "Continue"}
          </PortalButton>
        </div>
      </div>
    </div>
  );
}
