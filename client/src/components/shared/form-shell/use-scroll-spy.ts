import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { computeActiveSection } from "./lib/active-section";

/**
 * Tracks which section (by DOM id) is in view inside the scrolling `containerRef`.
 * Returns the current key and `jump(key)` which scrolls to it and marks it current.
 * A jumped-to section stays current (even if it cannot reach the top) until the user scrolls again.
 */
export function useScrollSpy(containerRef: RefObject<HTMLElement | null>, keys: readonly string[]) {
  const [current, setCurrent] = useState<string>(keys[0] ?? "");
  const keyList = keys.join("|");
  const lockedRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ids = keyList ? keyList.split("|") : [];
    const onScroll = () => {
      const top = container.getBoundingClientRect().top;
      const sections = ids.flatMap((id) => {
        const el = document.getElementById(id);
        return el ? [{ id, top: el.getBoundingClientRect().top - top }] : [];
      });
      const atBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
      const active = computeActiveSection(sections, atBottom, lockedRef.current) || (ids[0] ?? "");
      setCurrent((prev) => (prev === active ? prev : active));
    };
    // Real user scrolling releases the lock (programmatic scroll events do not).
    const release = () => {
      lockedRef.current = null;
    };
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    container.addEventListener("wheel", release, { passive: true });
    container.addEventListener("touchmove", release, { passive: true });
    container.addEventListener("pointerdown", release, { passive: true });
    container.addEventListener("keydown", release);
    return () => {
      container.removeEventListener("scroll", onScroll);
      container.removeEventListener("wheel", release);
      container.removeEventListener("touchmove", release);
      container.removeEventListener("pointerdown", release);
      container.removeEventListener("keydown", release);
    };
  }, [containerRef, keyList]);

  const jump = useCallback((key: string) => {
    lockedRef.current = key;
    setCurrent(key);
    document.getElementById(key)?.scrollIntoView({ block: "start" });
  }, []);

  return { current, jump };
}
