import type { PortalBranding } from "../api/portal-branding";
import { AgencyMark } from "./brand";

/** Agency logo (or serif name) on the left; the customer's agent on the right when known. */
export function PortalHeader({ branding, onHome }: { branding: PortalBranding; onHome: () => void }) {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex min-h-16 max-w-3xl items-center justify-between gap-4 px-6 py-2.5">
        <button type="button" onClick={onHome} className="min-h-11 text-left" aria-label="Home" data-testid="portal-header-home">
          <AgencyMark branding={branding} />
        </button>
        {branding.agentName && (
          <p className="text-right leading-tight" data-testid="portal-header-agent">
            <span className="portal-caps-label block">Your travel agent</span>
            <span className="portal-serif text-[20px] text-primary">{branding.agentName}</span>
          </p>
        )}
      </div>
    </header>
  );
}
