import { describe, expect, it } from "vitest";
import { applyGoalAction, goalsKey, isStaleGoalsKey, loadGoals, pruneGoalKeys, safeGoalStorage, saveGoals, type DailyGoal, type GoalStorage } from "./daily-goals";

function fakeStorage(initial: Record<string, string> = {}): GoalStorage & { keys: () => string[] } {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    keys: () => [...data.keys()].sort(),
  };
}

const goal = (id: string): DailyGoal => ({ id, text: id, completed: false, createdAt: "2026-10-30T09:00:00Z" });

describe("goalsKey", () => {
  it("is keyed by user and day", () => {
    expect(goalsKey("u1", "2026-10-31")).toBe("daily-goals-u1-2026-10-31");
  });
});

describe("loadGoals and saveGoals", () => {
  it("round-trips per user and day", () => {
    const s = fakeStorage();
    saveGoals(s, "u1", "2026-10-31", [goal("a")]);
    expect(loadGoals(s, "u1", "2026-10-31")).toEqual([goal("a")]);
    expect(loadGoals(s, "u2", "2026-10-31")).toEqual([]);
    expect(loadGoals(s, "u1", "2026-11-01")).toEqual([]);
  });
  it("returns an empty list for corrupt data, wrong shapes or a missing user", () => {
    const s = fakeStorage({ [goalsKey("u1", "d")]: "{nope", [goalsKey("u2", "d")]: '{"a":1}', [goalsKey("u3", "d")]: '[{"id":1},{"id":"x","text":"t","completed":true}]' });
    expect(loadGoals(s, "u1", "d")).toEqual([]);
    expect(loadGoals(s, "u2", "d")).toEqual([]);
    expect(loadGoals(s, "u3", "d")).toEqual([{ id: "x", text: "t", completed: true }]);
    expect(loadGoals(s, "", "d")).toEqual([]);
  });
  it("does not throw when storage throws", () => {
    const broken: GoalStorage = {
      length: 0,
      key: () => null,
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadGoals(broken, "u1", "d")).toEqual([]);
    expect(() => saveGoals(broken, "u1", "d", [goal("a")])).not.toThrow();
    expect(() => pruneGoalKeys(broken, "u1", "d")).not.toThrow();
  });
  it("saves under the day the goals belong to after a rollover", () => {
    const s = fakeStorage();
    saveGoals(s, "u1", "2026-10-30", [goal("old")]);
    // Midnight passes: the next day starts empty, and yesterday's goals are not copied across.
    expect(loadGoals(s, "u1", "2026-10-31")).toEqual([]);
    saveGoals(s, "u1", "2026-10-31", [goal("new")]);
    expect(loadGoals(s, "u1", "2026-10-30")).toEqual([goal("old")]);
    expect(loadGoals(s, "u1", "2026-10-31")).toEqual([goal("new")]);
  });
});

describe("isStaleGoalsKey", () => {
  it("flags earlier days for this user and legacy keys, not today or other users", () => {
    expect(isStaleGoalsKey("daily-goals-u1-2026-10-30", "u1", "2026-10-31")).toBe(true);
    expect(isStaleGoalsKey("daily-goals-u1-2026-10-31", "u1", "2026-10-31")).toBe(false);
    expect(isStaleGoalsKey("daily-goals-u2-2026-10-30", "u1", "2026-10-31")).toBe(false);
    expect(isStaleGoalsKey("daily-goals-2026-10-31", "u1", "2026-10-31")).toBe(true);
    expect(isStaleGoalsKey("other-u1-2026-10-30", "u1", "2026-10-31")).toBe(false);
  });
});

describe("pruneGoalKeys", () => {
  it("removes this user's old days and legacy keys, keeping today, other users and unrelated keys", () => {
    const s = fakeStorage({
      "daily-goals-u1-2026-10-29": "[]",
      "daily-goals-u1-2026-10-30": "[]",
      "daily-goals-u1-2026-10-31": "[]",
      "daily-goals-u2-2026-10-30": "[]",
      "daily-goals-2026-10-28": "[]",
      "daily-goals-2026-10-31": "[]",
      theme: "dark",
    });
    pruneGoalKeys(s, "u1", "2026-10-31");
    expect(s.keys()).toEqual(["daily-goals-u1-2026-10-31", "daily-goals-u2-2026-10-30", "theme"]);
  });
});

describe("safeGoalStorage", () => {
  it("returns an inert storage when reading localStorage throws, so nothing crashes", () => {
    const s = safeGoalStorage(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(loadGoals(s, "u1", "2026-10-31")).toEqual([]);
    expect(() => saveGoals(s, "u1", "2026-10-31", [goal("a")])).not.toThrow();
    expect(() => pruneGoalKeys(s, "u1", "2026-10-31")).not.toThrow();
  });
  it("returns the real storage when it is readable", () => {
    const real = fakeStorage();
    expect(safeGoalStorage(() => real)).toBe(real);
  });
});

describe("applyGoalAction", () => {
  const D1 = "2026-10-30";
  const D2 = "2026-10-31";
  it("uses the rendered list on the same day", () => {
    const s = fakeStorage();
    expect(applyGoalAction(s, "u1", D1, [goal("a")], D1, { type: "add", goal: goal("b") })).toEqual({ day: D1, goals: [goal("a"), goal("b")] });
  });
  it("writes an add after midnight to the new day, on top of the new day's stored list", () => {
    const s = fakeStorage();
    saveGoals(s, "u1", D2, [goal("x")]);
    expect(applyGoalAction(s, "u1", D1, [goal("a")], D2, { type: "add", goal: goal("b") })).toEqual({ day: D2, goals: [goal("x"), goal("b")] });
  });
  it("toggles and removes against the new day's list after rollover", () => {
    const s = fakeStorage();
    saveGoals(s, "u1", D2, [goal("x")]);
    expect(applyGoalAction(s, "u1", D1, [], D2, { type: "toggle", id: "x" })?.goals[0].completed).toBe(true);
    expect(applyGoalAction(s, "u1", D1, [], D2, { type: "remove", id: "x" })).toEqual({ day: D2, goals: [] });
  });
  it("is a no-op for toggle or remove of a goal missing from the new day", () => {
    const s = fakeStorage();
    expect(applyGoalAction(s, "u1", D1, [goal("a")], D2, { type: "toggle", id: "a" })).toBeNull();
    expect(applyGoalAction(s, "u1", D1, [goal("a")], D2, { type: "remove", id: "a" })).toBeNull();
  });
});
