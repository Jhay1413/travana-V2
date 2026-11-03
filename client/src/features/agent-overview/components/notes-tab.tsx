import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { londonDayKey } from "@/lib/london-day";
import { applyGoalAction, loadGoals, pruneGoalKeys, safeGoalStorage, saveGoals, type DailyGoal, type GoalAction } from "../lib/daily-goals";
import { useLondonDay } from "../lib/use-london-day";
import { currency } from "./helpers";
import { EmptyLine } from "./home/home-ui";

function Bar({ pct, testId }: { pct: number; testId?: string }) {
  return (
    <div className="my-2 h-1.5 overflow-hidden rounded-[3px] bg-social-border" data-testid={testId}>
      <div className="h-full rounded-[3px] bg-social-orange" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** Read-only first row: this month's profit against the agent's own target. */
function MonthlyProfitRow({ monthProfit, target }: { monthProfit: number; target: number }) {
  const pct = target > 0 ? Math.round((monthProfit / target) * 100) : 0;
  return (
    <div className="border-t border-social-border py-3" data-testid="goal-monthly-profit">
      <div className="flex justify-between gap-3 text-[13px] xl:text-[14px]">
        <b className="font-semibold">Monthly profit</b>
        <span className="whitespace-nowrap text-social-muted">
          {currency.format(monthProfit)} of {target > 0 ? currency.format(target) : "no target set"}
        </span>
      </div>
      <Bar pct={pct} testId="bar-monthly-profit" />
      <div className="text-[11px] text-social-muted xl:text-[12px]">
        {target > 0 ? `${Math.min(pct, 100)}% of this month's target` : "Your target will show here once one is set"}
      </div>
    </div>
  );
}

interface GoalsState {
  userId: string;
  day: string;
  goals: DailyGoal[];
}

export function NotesTab({ userId, monthProfit = 0, target = 0 }: { userId: string; monthProfit?: number; target?: number }) {
  const today = useLondonDay();
  const [state, setState] = useState<GoalsState>(() => ({ userId, day: today, goals: loadGoals(safeGoalStorage(), userId, today) }));
  // The goals belong to one user and one London day: when the user changes or UK midnight passes
  // while the page stays open, reload instead of carrying the old list into the new key. A write
  // may already have moved the state to a newer day than the polled one, which is not a rollover.
  let current = state;
  if (state.userId !== userId || today > state.day) {
    current = { userId, day: today, goals: loadGoals(safeGoalStorage(), userId, today) };
    setState(current);
  }
  const dailyGoals = current.goals;
  const [newGoalText, setNewGoalText] = useState("");

  useEffect(() => {
    pruneGoalKeys(safeGoalStorage(), userId, today);
  }, [userId, today]);

  // Every write re-checks the London day: the polled day can be up to 30s behind midnight.
  const applyGoal = (action: GoalAction) => {
    const storage = safeGoalStorage();
    const write = applyGoalAction(storage, current.userId, current.day, current.goals, londonDayKey(new Date()), action);
    if (!write) return;
    setState({ userId: current.userId, day: write.day, goals: write.goals });
    saveGoals(storage, current.userId, write.day, write.goals);
  };
  const addDailyGoal = () => {
    if (!newGoalText.trim()) return;
    const goal: DailyGoal = {
      id: crypto.randomUUID(),
      text: newGoalText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    applyGoal({ type: "add", goal });
    setNewGoalText("");
  };
  const toggleGoalComplete = (id: string) => applyGoal({ type: "toggle", id });
  const removeGoal = (id: string) => applyGoal({ type: "remove", id });

  const completedGoals = dailyGoals.filter((g) => g.completed).length;
  const goalProgress = dailyGoals.length > 0 ? Math.round((completedGoals / dailyGoals.length) * 100) : 0;

  return (
    <div data-testid="panel-daily-goals-overview">
      <MonthlyProfitRow monthProfit={monthProfit} target={target} />

      <div className="border-t border-social-border py-3">
        <div className="flex justify-between gap-3 text-[13px] xl:text-[14px]">
          <b className="font-semibold">Today&apos;s goals</b>
          <span className="whitespace-nowrap text-social-muted" data-testid="text-daily-goals-progress">
            {dailyGoals.length > 0 ? `${completedGoals} of ${dailyGoals.length} done` : "None yet"}
          </span>
        </div>
        {dailyGoals.length > 0 && <Bar pct={goalProgress} testId="bar-daily-goals-progress" />}

        <div className="mt-2.5 flex gap-2">
          <input
            placeholder="Add a goal for today..."
            className="h-9 min-w-0 flex-1 rounded-lg border border-social-border bg-card px-3 text-[13px] outline-none focus:border-social-orange"
            value={newGoalText}
            onChange={(e) => setNewGoalText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addDailyGoal();
            }}
            data-testid="input-add-daily-goal"
          />
          <button
            type="button"
            onClick={addDailyGoal}
            disabled={!newGoalText.trim()}
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-social-orange px-3 text-[13px] font-semibold text-slate-900 hover:bg-social-orange/90 disabled:opacity-50"
            data-testid="button-add-daily-goal"
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>

        {dailyGoals.length === 0 ? (
          <EmptyLine testId="empty-daily-goals">No goals set for today. Add one above to start tracking your day.</EmptyLine>
        ) : (
          <div className="mt-1.5" data-testid="list-daily-goals">
            {dailyGoals.map((goal) => (
              <div
                key={goal.id}
                className="group flex items-center gap-3 py-2"
                data-testid={`card-daily-goal-${goal.id}`}
              >
                <button
                  type="button"
                  aria-label={goal.completed ? "Mark goal not done" : "Mark goal done"}
                  onClick={() => toggleGoalComplete(goal.id)}
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border-[1.5px] transition",
                    goal.completed ? "border-emerald-500 bg-emerald-500 text-white" : "border-dashboard-check bg-card hover:border-emerald-500",
                  )}
                  data-testid={`button-toggle-goal-${goal.id}`}
                >
                  {goal.completed && <Check className="h-3 w-3" strokeWidth={3.5} />}
                </button>
                <span
                  className={cn("flex-1 text-[13px] xl:text-[14px]", goal.completed && "text-social-muted line-through")}
                  data-testid={`text-daily-goal-${goal.id}`}
                >
                  {goal.text}
                </span>
                <button
                  type="button"
                  aria-label="Remove goal"
                  className="shrink-0 text-social-muted opacity-0 transition hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                  onClick={() => removeGoal(goal.id)}
                  data-testid={`button-remove-goal-${goal.id}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
