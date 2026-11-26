import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePortalBranding } from "../api/use-portal-branding";
import { NEUTRAL_BRANDING, type PortalBranding } from "../api/portal-branding";
import { loadPortalFonts } from "./portal-fonts";
import "./portal-theme.css";

interface PortalThemeValue {
  branding: PortalBranding;
}

const PortalThemeContext = createContext<PortalThemeValue>({ branding: NEUTRAL_BRANDING });

/** Where Radix overlays (dialogs, sheets) should mount so they sit inside the themed wrapper. */
const PortalOverlayContainerContext = createContext<HTMLElement | null>(null);

/**
 * Knows the agency's branding for the portal and loads the portal fonts. It renders
 * no wrapper of its own: screens that use the new look wrap themselves in
 * PortalThemeScope, so legacy pages are untouched and :root is never written to.
 */
export function PortalThemeProvider({ children }: { children: ReactNode }) {
  const { branding } = usePortalBranding();

  useEffect(() => {
    loadPortalFonts();
  }, []);

  // The agency's brand colour is deliberately NOT used: every colour in the portal is the design's own.
  const value = useMemo<PortalThemeValue>(() => ({ branding }), [branding]);

  return <PortalThemeContext.Provider value={value}>{children}</PortalThemeContext.Provider>;
}

export function usePortalTheme(): PortalThemeValue {
  return useContext(PortalThemeContext);
}

export function usePortalBrandingValue(): PortalBranding {
  return useContext(PortalThemeContext).branding;
}

/** The element overlays should portal into, or null (Radix then uses document.body). */
export function usePortalOverlayContainer(): HTMLElement | null {
  return useContext(PortalOverlayContainerContext);
}

/**
 * The `.portal-theme` wrapper: redefines the shared tokens for everything inside it (the design's fixed colours,
 * the same for every agency) and gives Radix overlays a container inside itself so they are themed too.
 */
export function PortalThemeScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <div ref={setContainer} className={`portal-theme min-h-dvh ${className}`}>
      <PortalOverlayContainerContext.Provider value={container}>{children}</PortalOverlayContainerContext.Provider>
    </div>
  );
}
