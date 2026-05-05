import { useEffect } from "react";
import { useAgency } from "@/hooks/use-agency";

function hexToHslParts(hex: string): { h: number; s: number; l: number } | null {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0));
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function fmtHsl(h: number, s: number, l: number) {
  return `${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%`;
}

function pickForeground(l: number) {
  return l > 60 ? "240 10% 10%" : "0 0% 100%";
}

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

    const value = fmtHsl(parts.h, parts.s, parts.l);
    vars.forEach((v) => root.style.setProperty(v, value));
    const fg = pickForeground(parts.l);
    fgVars.forEach((v) => root.style.setProperty(v, fg));
  }, [agency.brandColor]);
  return null;
}
