import { useCallback, useState } from "react";
import { ALL_STAGES, DEFAULT_COLLAPSED_STAGES, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";

type CollapsedState = Partial<Record<PipelineStage, boolean>>;

const COLLAPSE_STORAGE_KEY = "pipeline.collapsed";

function loadCollapsedState(): CollapsedState {
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? (parsed as CollapsedState) : {};
  } catch {
    return {};
  }
}

function saveCollapsedState(state: CollapsedState) {
  try {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable (private mode, quota) — collapse state just won't persist.
  }
}

/** Which board columns are collapsed to a rail, persisted in localStorage. */
export function useCollapsedStages() {
  const [collapsed, setCollapsed] = useState<CollapsedState>(() => {
    const stored = loadCollapsedState();
    const initial: CollapsedState = {};
    for (const stage of ALL_STAGES) initial[stage] = stored[stage] ?? DEFAULT_COLLAPSED_STAGES.includes(stage);
    return initial;
  });

  const toggleCollapse = useCallback((stage: PipelineStage) => {
    setCollapsed((prev) => {
      const next = { ...prev, [stage]: !prev[stage] };
      saveCollapsedState(next);
      return next;
    });
  }, []);

  return { collapsed, toggleCollapse };
}
