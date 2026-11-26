import type { PortalBranding } from "../api/portal-branding";
import { AgencyMark, PortalButton } from "./brand";

/**
 * The header floats, white, over the top of the page's hero (no bar, no border): the agency's logo (or name) as the Home
 * button on the left, or a "back" link on a quote or booking; a "Menu" link on the right.
 */
export function PortalHeader({
  branding,
  onHome,
  onMenu,
  back,
}: {
  branding: PortalBranding;
  onHome: () => void;
  onMenu: () => void;
  back?: { label: string; onClick: () => void };
}) {
  return (
    <header className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-5xl items-center justify-between px-6 py-[22px] text-white" data-testid="portal-header">
      {back ? (
        <PortalButton variant="link" className="text-white hover:text-white/80" onClick={back.onClick} data-testid="button-header-back">
          <span aria-hidden>←</span> {back.label}
        </PortalButton>
      ) : (
        <button type="button" onClick={onHome} className="flex min-h-11 min-w-0 max-w-[65%] items-center text-left" aria-label="Home" data-testid="portal-header-home">
          <AgencyMark branding={branding} tone="dark" />
        </button>
      )}
      <PortalButton variant="link" className="text-white hover:text-white/80" aria-haspopup="dialog" onClick={onMenu} data-testid="button-portal-menu">
        Menu
      </PortalButton>
    </header>
  );
}
