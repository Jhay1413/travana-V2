import { useCallback, useState } from "react";

export type GuruView = "globe" | "list";

const STORAGE_KEY = "destination-guru:view";

function readStoredView(): GuruView {
  try {
    return localStorage.getItem(STORAGE_KEY) === "list" ? "list" : "globe";
  } catch {
    return "globe";
  }
}

// Persists the user's globe/list view choice across sessions in
// localStorage. Falls back to "globe" (and silently no-ops on write) when
// localStorage is unavailable, e.g. private browsing.
export function useGlobeViewPreference() {
  const [view, setViewState] = useState<GuruView>(readStoredView);

  const setView = useCallback((next: GuruView) => {
    setViewState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore — preference just won't persist this session
    }
  }, []);

  return [view, setView] as const;
}
