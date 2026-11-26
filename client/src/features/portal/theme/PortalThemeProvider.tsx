import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePortalBranding } from "../api/use-portal-branding";
import { NEUTRAL_BRANDING, type PortalBranding } from "../api/portal-branding";
import { paletteToCssVars, resolveBrandPalette, type BrandPalette } from "./brand-colour";
import { loadPortalFonts } from "./portal-fonts";
import "./portal-theme.css";

interface PortalThemeValue {
  branding: PortalBranding;
  palette: BrandPalette;
  /** CSS variables for the agency's colour; applied by PortalThemeScope, never to :root. */
  cssVars: CSSProperties;
}

const PortalThemeContext = createContext<PortalThemeValue>({
  branding: NEUTRAL_BRANDING,
  palette: resolveBrandPalette(null),
  cssVars: {},
});

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

  const value = useMemo<PortalThemeValue>(() => {
    const palette = resolveBrandPalette(branding.brandColor);
    return { branding, palette, cssVars: paletteToCssVars(palette) as CSSProperties };
  }, [branding]);

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
 * The `.portal-theme` wrapper: redefines the shared tokens for everything inside it, applies
 * the agency colour, and gives Radix overlays a container inside itself so they are themed too.
 */
export function PortalThemeScope({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { cssVars } = usePortalTheme();
  const [container, setContainer] = useState<HTMLElement | null>(null);
  return (
    <div ref={setContainer} className={`portal-theme min-h-dvh ${className}`} style={cssVars}>
      <PortalOverlayContainerContext.Provider value={container}>{children}</PortalOverlayContainerContext.Provider>
    </div>
  );
}
