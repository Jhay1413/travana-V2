import { useEffect, type ReactNode } from "react";
import { AgencyMark, PortalFooter, PortalThemeScope, loadPortalFonts, type PortalBranding } from "@/features/portal";

/** Floats over the top of the page's hero as the portal's header does, but with no Menu and no tabs: visitors are not signed in. */
function PublicHeader({ branding, staffPreview }: { branding: PortalBranding; staffPreview: boolean }) {
  const hasMark = !!(branding.name || branding.logoUrl || branding.iconUrl);
  return (
    <div className="absolute inset-x-0 top-0 z-20 text-white">
      <header className="mx-auto flex max-w-5xl items-center px-6 py-[22px]" data-testid="public-quote-header">
        {hasMark && <AgencyMark branding={branding} tone="dark" />}
      </header>
      {staffPreview && (
        <div className="border-y border-border bg-background px-6 py-2 text-center text-[11px] uppercase tracking-[0.2em] text-primary" role="status" data-testid="bar-staff-preview">
          Staff preview — customers cannot see this quote
        </div>
      )}
    </div>
  );
}

/**
 * The portal's themed wrapper (cream, navy and amber tokens, Jost and Cormorant, overlays mounted inside it) around a
 * public page: the agency's mark on top, the design's footer at the bottom. Nothing in it is a fixed brand.
 */
export function PublicQuoteShell({ branding, staffPreview = false, children }: { branding: PortalBranding; staffPreview?: boolean; children: ReactNode }) {
  useEffect(() => {
    loadPortalFonts();
  }, []);
  return (
    <PortalThemeScope className="relative flex flex-col bg-background text-foreground">
      <PublicHeader branding={branding} staffPreview={staffPreview} />
      <main className="flex flex-1 flex-col" data-testid="public-quote-main">
        {children}
      </main>
      <PortalFooter branding={branding} />
    </PortalThemeScope>
  );
}
