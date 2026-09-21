import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(QUERY).matches;
}

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getPrefersReducedMotion);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;

    const mediaQueryList = window.matchMedia(QUERY);
    const handleChange = () => setPrefersReducedMotion(mediaQueryList.matches);

    handleChange();
    mediaQueryList.addEventListener("change", handleChange);
    return () => mediaQueryList.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}
