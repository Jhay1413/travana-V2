import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  Flame,
  Plus,
  Target,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DailyGoal = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
};

export function NotesTab() {
  const todayKey = new Date().toISOString().slice(0, 10);
  const [dailyGoals, setDailyGoals] = useState<DailyGoal[]>(() => {
    try {
      const stored = localStorage.getItem(`daily-goals-${todayKey}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [newGoalText, setNewGoalText] = useState("");

  const saveDailyGoals = (goals: DailyGoal[]) => {
    setDailyGoals(goals);
    localStorage.setItem(`daily-goals-${todayKey}`, JSON.stringify(goals));
  };
  const addDailyGoal = () => {
    if (!newGoalText.trim()) return;
    const goal: DailyGoal = {
      id: crypto.randomUUID(),
      text: newGoalText.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };
    saveDailyGoals([...dailyGoals, goal]);
    setNewGoalText("");
  };
  const toggleGoalComplete = (id: string) => {
    saveDailyGoals(
      dailyGoals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g)),
    );
  };
  const removeGoal = (id: string) => {
    saveDailyGoals(dailyGoals.filter((g) => g.id !== id));
  };
  const completedGoals = dailyGoals.filter((g) => g.completed).length;
  const goalProgress =
    dailyGoals.length > 0 ? Math.round((completedGoals / dailyGoals.length) * 100) : 0;

  return (
    <div className="grid gap-4" data-testid="panel-daily-goals-overview">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold">Today's Goals</span>
          {dailyGoals.length > 0 && (
            <span className="text-xs text-black/50 dark:text-white/50">
              {completedGoals}/{dailyGoals.length}
            </span>
          )}
        </div>
        {dailyGoals.length > 0 && goalProgress === 100 && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
            <Trophy className="h-3 w-3" />
            All done!
          </div>
        )}
      </div>

      {dailyGoals.length > 0 && (
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
          <motion.div
            className={`absolute inset-y-0 left-0 rounded-full ${goalProgress === 100 ? "bg-emerald-500" : "bg-indigo-500"}`}
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            data-testid="bar-daily-goals-progress"
          />
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="Add a goal for today..."
          className="h-9 rounded-xl border-black/10 bg-white/70 text-sm dark:border-white/10 dark:bg-white/5"
          value={newGoalText}
          onChange={(e) => setNewGoalText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") addDailyGoal();
          }}
          data-testid="input-add-daily-goal"
        />
        <Button
          size="sm"
          className="h-9 rounded-xl bg-indigo-600 px-3 text-white hover:bg-indigo-700"
          onClick={addDailyGoal}
          disabled={!newGoalText.trim()}
          data-testid="button-add-daily-goal"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>

      {dailyGoals.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
          data-testid="empty-daily-goals"
        >
          <Target className="mx-auto h-8 w-8 text-black/20 dark:text-white/20" />
          <p className="mt-2 text-sm text-black/50 dark:text-white/50">
            No goals set for today
          </p>
          <p className="mt-1 text-xs text-black/35 dark:text-white/35">
            Add goals above to start tracking your day
          </p>
        </div>
      ) : (
        <div className="space-y-2" data-testid="list-daily-goals">
          <AnimatePresence mode="popLayout">
            {dailyGoals.map((goal) => (
              <motion.div
                key={goal.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20, transition: { duration: 0.15 } }}
                className={`group flex items-center gap-3 rounded-2xl border p-3 transition ${goal.completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-black/10 bg-black/5 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"}`}
                data-testid={`card-daily-goal-${goal.id}`}
              >
                <button
                  type="button"
                  className="flex-shrink-0"
                  onClick={() => toggleGoalComplete(goal.id)}
                  data-testid={`button-toggle-goal-${goal.id}`}
                >
                  {goal.completed ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-black/30 transition hover:text-indigo-500 dark:text-white/30" />
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${goal.completed ? "text-black/40 line-through dark:text-white/40" : "text-black/80 dark:text-white/80"}`}
                  data-testid={`text-daily-goal-${goal.id}`}
                >
                  {goal.text}
                </span>
                <button
                  type="button"
                  className="flex-shrink-0 opacity-0 transition group-hover:opacity-100"
                  onClick={() => removeGoal(goal.id)}
                  data-testid={`button-remove-goal-${goal.id}`}
                >
                  <X className="h-4 w-4 text-black/30 transition hover:text-red-500 dark:text-white/30" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {dailyGoals.length > 0 && (
        <div
          className="flex items-center justify-between rounded-2xl border border-black/5 bg-black/[0.02] p-3 dark:border-white/5 dark:bg-white/[0.02]"
          data-testid="card-daily-goals-stats"
        >
          <div className="flex items-center gap-4 text-xs text-black/50 dark:text-white/50">
            <span className="flex items-center gap-1">
              <Flame className="h-3 w-3 text-orange-500" />
              {completedGoals} completed
            </span>
            <span>{dailyGoals.length - completedGoals} remaining</span>
          </div>
          <span
            className={`text-xs font-semibold ${goalProgress === 100 ? "text-emerald-600" : "text-indigo-600"}`}
            data-testid="text-daily-goals-progress"
          >
            {goalProgress}%
          </span>
        </div>
      )}
    </div>
  );
}
