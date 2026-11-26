import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/color";
import {
  AA_TEXT,
  MIN_CONTRAST_WITH_CREAM,
  PORTAL_CREAM,
  PORTAL_NAVY,
  normaliseHex,
  paletteToCssVars,
  readableForeground,
  resolveBrandPalette,
} from "./brand-colour";

describe("normaliseHex", () => {
  it("lower-cases and expands", () => {
    expect(normaliseHex("#ABC")).toBe("#aabbcc");
    expect(normaliseHex("1A5FB4")).toBe("#1a5fb4");
  });
  it("rejects junk and empties", () => {
    for (const bad of [null, undefined, "", "blue", "#12", "#zzzzzz"]) expect(normaliseHex(bad)).toBeNull();
  });
});

describe("resolveBrandPalette", () => {
  it("falls back to neutral navy for a missing or invalid colour", () => {
    for (const none of [null, undefined, "", "red", "#12"]) {
      expect(resolveBrandPalette(none)).toEqual({ mode: "navy-with-accent", primary: PORTAL_NAVY, primaryForeground: "#ffffff", accent: null });
    }
  });

  it("lets a dark brand colour drive large surfaces", () => {
    const p = resolveBrandPalette("#1A5FB4");
    expect(p.mode).toBe("brand-surface");
    expect(p.primary).toBe("#1a5fb4");
    expect(p.accent).toBeNull();
    expect(contrastRatio(p.primary, p.primaryForeground) ?? 0).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("keeps navy for surfaces when the colour is too light to carry white text", () => {
    const p = resolveBrandPalette("#f4c430");
    expect(p.mode).toBe("navy-with-accent");
    expect(p.primary).toBe(PORTAL_NAVY);
    expect(p.accent).toBe("#f4c430");
  });

  it("keeps navy for surfaces when the colour is too close to the cream background", () => {
    const p = resolveBrandPalette("#f7ead9");
    expect(p.mode).toBe("navy-with-accent");
    expect(p.accent).toBe("#f7ead9");
  });

  it("uses the colour when it passes both tests and refuses it when it fails the white-text test", () => {
    for (const hex of ["#767676", "#0b6e4f", "#b3261e"]) {
      expect(contrastRatio(hex, "#ffffff") ?? 0).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrastRatio(hex, PORTAL_CREAM) ?? 0).toBeGreaterThanOrEqual(MIN_CONTRAST_WITH_CREAM);
      expect(resolveBrandPalette(hex).mode).toBe("brand-surface");
    }
    for (const hex of ["#9a9a9a", "#e07b39", "#4fb3bf"]) {
      expect(contrastRatio(hex, "#ffffff") ?? 99).toBeLessThan(AA_TEXT);
      expect(resolveBrandPalette(hex).mode).toBe("navy-with-accent");
    }
  });

  it("never puts unreadable text on the primary surface", () => {
    for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#808080", "#fbf3ea", "#002c60"]) {
      const p = resolveBrandPalette(hex);
      expect(contrastRatio(p.primary, p.primaryForeground) ?? 0).toBeGreaterThanOrEqual(AA_TEXT);
    }
  });
});

describe("readableForeground", () => {
  it("picks white on dark and ink on light", () => {
    expect(readableForeground("#002c60")).toBe("#ffffff");
    expect(readableForeground("#f4c430")).toBe("#1b2433");
  });
});

describe("paletteToCssVars", () => {
  it("sets primary and foreground, but no accent variable for a surface colour", () => {
    const vars = paletteToCssVars(resolveBrandPalette("#1a5fb4"));
    expect(vars["--primary"]).toMatch(/^\d+(\.\d)? \d+(\.\d)?% \d+(\.\d)?%$/);
    expect(vars["--primary-foreground"]).toBe("0.0 0.0% 100.0%");
    expect("--portal-brand-accent" in vars).toBe(false);
  });
  it("sets the accent variable when the colour may only accent", () => {
    const vars = paletteToCssVars(resolveBrandPalette("#f4c430"));
    expect(vars["--portal-brand-accent"]).toBeDefined();
    expect(vars["--primary"]).toBe("212.5 100.0% 18.8%");
  });
  it("only ever writes custom properties", () => {
    for (const k of Object.keys(paletteToCssVars(resolveBrandPalette("#1a5fb4")))) expect(k.startsWith("--")).toBe(true);
  });
});

describe("portal token contrast (WCAG AA)", () => {
  const cream = "#fbf3ea";
  const navyDeep = "#001a3a";
  const pairs: [string, string, string, number][] = [
    ["ink on cream", "#1b2433", cream, 4.5],
    ["muted text on cream", "#4e5666", cream, 4.5],
    ["amber-ink on cream", "#a9520f", cream, 4.5],
    ["placeholder on cream", "#656d7c", cream, 4.5],
    ["danger on cream", "#b4261a", cream, 4.5],
    ["white on navy", "#ffffff", "#002c60", 4.5],
    ["amber-soft on navy-deep", "#f2b27a", navyDeep, 4.5],
    ["white on navy-deep", "#ffffff", navyDeep, 4.5],
    ["navy-deep on the amber button", navyDeep, "#de7621", 4.5],
  ];
  for (const [name, fg, bg, min] of pairs) {
    it(name, () => expect(contrastRatio(fg, bg) ?? 0).toBeGreaterThanOrEqual(min));
  }
  it("white at 75% on navy-deep (inactive tab text) stays above 4.5:1", () => {
    const mix = (c: number, base: number) => Math.round(c * 0.75 + base * 0.25);
    const hex = "#" + [mix(255, 0), mix(255, 26), mix(255, 58)].map((v) => v.toString(16).padStart(2, "0")).join("");
    expect(contrastRatio(hex, navyDeep) ?? 0).toBeGreaterThanOrEqual(4.5);
  });
});
