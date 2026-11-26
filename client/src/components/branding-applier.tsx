import { useEffect } from "react";
import { useAgency } from "@/hooks/use-agency";
import { formatHsl, hexToHslParts, pickForegroundHsl } from "@/lib/color";

export function BrandingApplier() {
  const { agency } = useAgency();
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--agency-brand", agency.brandColor);

    const parts = hexToHslParts(agency.brandColor);
    const vars = [
      "--primary",
      "--ring",
      "--sidebar-primary",
      "--sidebar-ring",
    ];
    const fgVars = ["--primary-foreground", "--sidebar-primary-foreground"];

    if (!parts) {
      vars.forEach((v) => root.style.removeProperty(v));
      fgVars.forEach((v) => root.style.removeProperty(v));
      return;
    }

    const value = formatHsl(parts.h, parts.s, parts.l);
    vars.forEach((v) => root.style.setProperty(v, value));
    const fg = pickForegroundHsl(parts.l);
    fgVars.forEach((v) => root.style.setProperty(v, fg));
  }, [agency.brandColor]);
  return null;
}
