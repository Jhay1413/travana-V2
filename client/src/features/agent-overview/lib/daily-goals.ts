export interface DailyGoal {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

/** The slice of Storage the goals need, so tests can pass an in-memory fake. */
export type GoalStorage = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const PREFIX = "daily-goals-";
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** Goals are kept per user and per London day, so people sharing a browser do not see each other's. */
export function goalsKey(userId: string, dayKey: string): string {
  return `${PREFIX}${userId}-${dayKey}`;
}

function isGoal(value: unknown): value is DailyGoal {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.text === "string" && typeof v.completed === "boolean";
}

/** Stored goals for the user and day; anything missing, malformed or unreadable is an empty list. */
export function loadGoals(storage: GoalStorage, userId: string, dayKey: string): DailyGoal[] {
  if (!userId) return [];
  try {
    const stored = storage.getItem(goalsKey(userId, dayKey));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter(isGoal) : [];
  } catch {
    return [];
  }
}

/** Writes the goals under the day they belong to. Storage being full or blocked is ignored. */
export function saveGoals(storage: GoalStorage, userId: string, dayKey: string, goals: DailyGoal[]): void {
  if (!userId) return;
  try {
    storage.setItem(goalsKey(userId, dayKey), JSON.stringify(goals));
  } catch {
    // The goals still show for this session; they just will not survive a reload.
  }
}

/** Whether a storage key is a goals key that is stale for this user: an earlier day, or the old per-browser format. */
export function isStaleGoalsKey(key: string, userId: string, dayKey: string): boolean {
  if (!key.startsWith(PREFIX)) return false;
  const rest = key.slice(PREFIX.length);
  if (DAY_KEY.test(rest)) return true; // legacy daily-goals-YYYY-MM-DD, shared by everyone on the browser
  const own = `${userId}-`;
  if (!userId || !rest.startsWith(own)) return false;
  const day = rest.slice(own.length);
  return DAY_KEY.test(day) && day !== dayKey;
}

/** Deletes this user's earlier-day keys and the legacy keys so storage stops growing. Other users' keys are left alone. */
export function pruneGoalKeys(storage: GoalStorage, userId: string, dayKey: string): void {
  try {
    const stale: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key && isStaleGoalsKey(key, userId, dayKey)) stale.push(key);
    }
    for (const key of stale) storage.removeItem(key);
  } catch {
    // Storage unavailable: nothing to clean.
  }
}

const NO_STORAGE: GoalStorage = {
  length: 0,
  key: () => null,
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

/**
 * The browser storage, or an inert stand-in when merely reading `localStorage` throws
 * (blocked cookies, some privacy modes), so blocked storage is ignored instead of crashing.
 */
export function safeGoalStorage(read: () => GoalStorage = () => localStorage): GoalStorage {
  try {
    return read();
  } catch {
    return NO_STORAGE;
  }
}

export type GoalAction =
  | { type: "add"; goal: DailyGoal }
  | { type: "toggle"; id: string }
  | { type: "remove"; id: string };

export interface GoalWrite {
  day: string;
  goals: DailyGoal[];
}

/**
 * Decides what a goal edit writes. The edit lands on the London day it happens in (`nowDay`): when
 * that is still the rendered day the rendered list is the base, but once the day has rolled over
 * the new day's stored list is the base, so a goal added just after midnight is not written under
 * yesterday's key (and pruned). Toggle or remove of a goal absent from that list returns null (no-op).
 */
export function applyGoalAction(
  storage: GoalStorage,
  userId: string,
  renderedDay: string,
  renderedGoals: DailyGoal[],
  nowDay: string,
  action: GoalAction,
): GoalWrite | null {
  const base = nowDay === renderedDay ? renderedGoals : loadGoals(storage, userId, nowDay);
  if (action.type === "add") return { day: nowDay, goals: [...base, action.goal] };
  if (!base.some((g) => g.id === action.id)) return null;
  const goals =
    action.type === "toggle"
      ? base.map((g) => (g.id === action.id ? { ...g, completed: !g.completed } : g))
      : base.filter((g) => g.id !== action.id);
  return { day: nowDay, goals };
}
