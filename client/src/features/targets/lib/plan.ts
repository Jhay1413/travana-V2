import type { AllocationInput, Plan, TargetsYear } from "../types";
import { agentKey, agentsOf, businessTotal, homeworkersTotal } from "./allocation";
import { gbp, moneyText, parseMoney } from "./money";
import { scaleMonths, sum } from "./months";

/* ---------------------------------------------------------------- building a plan */

export function planFromYear(data: TargetsYear): Plan {
  return {
    business: data.business ? moneyText(businessTotal(data)) : "",
    shops: Object.fromEntries(data.branches.map((b) => [b.id, moneyText(sum(b.months))])),
    agents: Object.fromEntries(data.agents.map((a) => [agentKey(a), moneyText(sum(a.months))])),
  };
}

/**
 * A saved plan laid over today's data. Boxes for shops or agents that no longer exist are dropped, new ones
 * start from what is saved, and inactive agents (who cannot be edited) always read what is saved.
 */
export function reconcilePlan(draft: Plan, data: TargetsYear): Plan {
  const base = planFromYear(data);
  const inactive = new Set(data.agents.filter((a) => a.inactive).map(agentKey));
  return {
    business: typeof draft.business === "string" ? draft.business : base.business,
    shops: Object.fromEntries(Object.entries(base.shops).map(([id, v]) => [id, draft.shops[id] ?? v])),
    agents: Object.fromEntries(Object.entries(base.agents).map(([id, v]) => [id, inactive.has(id) ? v : (draft.agents[id] ?? v)])),
  };
}

const num = (raw: string | undefined): number => {
  const r = parseMoney(raw ?? "");
  return r.ok ? r.value : 0;
};

/** Two boxes mean the same amount ("90000" and "90,000"); unreadable boxes only match if identical. */
export function sameAmount(a: string | undefined, b: string | undefined): boolean {
  const x = parseMoney(a ?? "");
  const y = parseMoney(b ?? "");
  if (x.ok && y.ok) return x.value === y.value;
  return (a ?? "") === (b ?? "");
}

/* ---------------------------------------------------------------- what the person changed */

export type EntityKind = "business" | "shop" | "agent";

function entries(plan: Plan): Array<{ kind: EntityKind; id: string; value: string }> {
  return [
    { kind: "business", id: "business", value: plan.business },
    ...Object.entries(plan.shops).map(([id, value]) => ({ kind: "shop" as const, id, value })),
    ...Object.entries(plan.agents).map(([id, value]) => ({ kind: "agent" as const, id, value })),
  ];
}

const valueOf = (plan: Plan, kind: EntityKind, id: string): string | undefined =>
  kind === "business" ? plan.business : kind === "shop" ? plan.shops[id] : plan.agents[id];

function withValue(plan: Plan, kind: EntityKind, id: string, value: string): Plan {
  if (kind === "business") return { ...plan, business: value };
  if (kind === "shop") return { ...plan, shops: { ...plan.shops, [id]: value } };
  return { ...plan, agents: { ...plan.agents, [id]: value } };
}

/** True when the person typed something different from what they started with. */
export const isEdited = (plan: Plan, snapshot: Plan, kind: EntityKind, id: string): boolean =>
  !sameAmount(valueOf(plan, kind, id), valueOf(snapshot, kind, id));

/**
 * What the wizard shows and checks: boxes the person changed keep their value, every other box shows the
 * latest saved number, so a plan never quietly carries stale figures for things it did not touch.
 */
export function effectivePlan(plan: Plan, snapshot: Plan, live: Plan): Plan {
  let out: Plan = live;
  for (const e of entries(live)) {
    if (isEdited(plan, snapshot, e.kind, e.id)) out = withValue(out, e.kind, e.id, valueOf(plan, e.kind, e.id) ?? e.value);
  }
  return out;
}

export interface PlanConflict {
  kind: EntityKind;
  id: string;
  name: string;
  mine: string;
  /** What it was when the person started. */
  started: string;
  /** What it is now, after someone else changed it. */
  latest: string;
}

/** Things the person changed that someone else has also changed since they started. */
export function findConflicts(plan: Plan, snapshot: Plan, data: TargetsYear): PlanConflict[] {
  const live = planFromYear(data);
  const inactive = new Set(data.agents.filter((a) => a.inactive).map(agentKey));
  const nameOf = (kind: EntityKind, id: string): string =>
    kind === "business"
      ? "The business target"
      : kind === "shop"
        ? (data.branches.find((b) => b.id === id)?.name ?? id)
        : (data.agents.find((a) => agentKey(a) === id)?.name ?? id);
  return entries(live)
    .filter((e) => !(e.kind === "agent" && inactive.has(e.id)))
    .filter((e) => isEdited(plan, snapshot, e.kind, e.id) && !sameAmount(valueOf(snapshot, e.kind, e.id), e.value))
    .map((e) => ({
      kind: e.kind,
      id: e.id,
      name: nameOf(e.kind, e.id),
      mine: valueOf(plan, e.kind, e.id) ?? "",
      started: valueOf(snapshot, e.kind, e.id) ?? "",
      latest: e.value,
    }));
}

/** "Keep mine" moves the starting point onto the latest figure; "use latest" also drops the person's edit. */
export function resolveConflict(plan: Plan, snapshot: Plan, conflict: PlanConflict, choice: "mine" | "latest"): { plan: Plan; snapshot: Plan } {
  const nextSnapshot = withValue(snapshot, conflict.kind, conflict.id, conflict.latest);
  const nextPlan = choice === "latest" ? withValue(plan, conflict.kind, conflict.id, conflict.latest) : plan;
  return { plan: nextPlan, snapshot: nextSnapshot };
}

/* ---------------------------------------------------------------- the numbers behind the steps */

export interface PlanNumbers {
  business: number;
  shops: Record<string, number>;
  agents: Record<string, number>;
}

export const planNumbers = (plan: Plan): PlanNumbers => ({
  business: num(plan.business),
  shops: Object.fromEntries(Object.entries(plan.shops).map(([k, v]) => [k, num(v)])),
  agents: Object.fromEntries(Object.entries(plan.agents).map(([k, v]) => [k, num(v)])),
});

export interface ShopPlanRow {
  branchId: string;
  name: string;
  target: number;
  sum: number;
  drift: number;
  count: number;
  /** True when the agents add up to the shop (or the shop has no agents to share it with). */
  done: boolean;
}

export interface PlanCalc {
  numbers: PlanNumbers;
  /** What homeworkers have set for themselves (not editable here). */
  homeworkers: number;
  bizOk: boolean;
  shopFieldErrors: string[];
  shopsSum: number;
  shopsDrift: number;
  shopsBalanced: boolean;
  /** Agent keys (see agentKey). */
  agentFieldErrors: string[];
  shopRows: ShopPlanRow[];
  agentsBalanced: boolean;
}

export function calcPlan(plan: Plan, data: TargetsYear): PlanCalc {
  const numbers = planNumbers(plan);
  const homeworkers = homeworkersTotal(data);
  const biz = parseMoney(plan.business);
  const bizOk = biz.ok && biz.value > 0 && biz.value >= homeworkers;
  const shopFieldErrors = data.branches.filter((b) => !parseMoney(plan.shops[b.id] ?? "").ok).map((b) => b.id);
  const shopValue = (id: string) => numbers.shops[id] ?? 0;
  const shopsSum = sum(data.branches.map((b) => shopValue(b.id)));
  const shopsDrift = shopsSum + homeworkers - numbers.business;
  const agentFieldErrors = data.agents.filter((a) => !parseMoney(plan.agents[agentKey(a)] ?? "").ok).map(agentKey);
  const shopRows = data.branches.map((b): ShopPlanRow => {
    const list = agentsOf(data, b.id);
    const agentSum = sum(list.map((a) => numbers.agents[agentKey(a)] ?? 0));
    const drift = agentSum - shopValue(b.id);
    return { branchId: b.id, name: b.name, target: shopValue(b.id), sum: agentSum, drift, count: list.length, done: list.length === 0 || drift === 0 };
  });
  return {
    numbers,
    homeworkers,
    bizOk,
    shopFieldErrors,
    shopsSum,
    shopsDrift,
    shopsBalanced: bizOk && shopFieldErrors.length === 0 && shopsDrift === 0,
    agentFieldErrors,
    shopRows,
    agentsBalanced: agentFieldErrors.length === 0 && shopRows.every((r) => r.done),
  };
}

export type StepNo = 1 | 2 | 3 | 4;
export const STEP_LABELS = ["Business total", "Shops", "Agents", "Review"] as const;

/** The furthest step the numbers allow: a typed-in address cannot skip a step that is not balanced. */
export function reachableStep(calc: PlanCalc): StepNo {
  if (!calc.bizOk) return 1;
  if (!calc.shopsBalanced) return 2;
  if (!calc.agentsBalanced) return 3;
  return 4;
}

/** The step to show for an asked-for one: whole numbers 1 to 4, never past what is reachable. */
export function clampStep(asked: number | string | null | undefined, reach: StepNo): StepNo {
  const n = typeof asked === "number" ? asked : Number.parseInt(asked ?? "", 10);
  const wanted = Number.isFinite(n) ? Math.min(4, Math.max(1, Math.trunc(n))) : 1;
  return Math.min(wanted, reach) as StepNo;
}

/** Plain-English reasons "Next" is blocked on a step. Empty when it can go on. */
export function stepProblems(step: StepNo, plan: Plan, data: TargetsYear, calc: PlanCalc): string[] {
  const out: string[] = [];
  if (step === 1) {
    const r = parseMoney(plan.business);
    if (!r.ok) out.push(`${r.error}.`);
    else if (r.value <= 0) out.push("Enter a target above £0.");
    else if (r.value < calc.homeworkers) {
      out.push(`Homeworkers have already planned ${gbp(calc.homeworkers)} for themselves, so the business target cannot be lower than that.`);
    }
  }
  if (step === 2) {
    if (calc.shopFieldErrors.length > 0) {
      const names = data.branches.filter((b) => calc.shopFieldErrors.includes(b.id)).map((b) => b.name);
      out.push(`Check the amount for ${names.join(", ")}. Use whole pounds, for example 90,000.`);
    } else if (calc.shopsDrift !== 0) {
      out.push(
        `The shops and homeworkers add up to ${gbp(calc.shopsSum + calc.homeworkers)}, which is ${gbp(Math.abs(calc.shopsDrift))} ${calc.shopsDrift > 0 ? "over" : "under"} the business target of ${gbp(calc.numbers.business)}.`,
      );
    }
  }
  if (step === 3) {
    if (calc.agentFieldErrors.length > 0) {
      const names = data.agents.filter((a) => calc.agentFieldErrors.includes(agentKey(a))).map((a) => a.name);
      out.push(`Check the amount for ${names.join(", ")}. Use whole pounds, for example 30,000.`);
    }
    for (const r of calc.shopRows.filter((x) => !x.done)) {
      out.push(`${r.name}: agents add up to ${gbp(r.sum)}, which is ${gbp(Math.abs(r.drift))} ${r.drift > 0 ? "over" : "under"} the shop target of ${gbp(r.target)}.`);
    }
  }
  return out;
}

/* ---------------------------------------------------------------- review and save */

export interface ChangeRow {
  key: string;
  kind: EntityKind;
  /** Section title for the review table: "Business", "Shops" or the shop an agent works in. */
  group: string;
  name: string;
  before: number;
  after: number;
}

export function changeRows(plan: Plan, data: TargetsYear): ChangeRow[] {
  const n = planNumbers(plan);
  const branchName = (id: string) => data.branches.find((b) => b.id === id)?.name ?? "Agents";
  const rows: ChangeRow[] = [];
  if (data.business) {
    rows.push({ key: "business", kind: "business", group: "Business", name: "Business target", before: businessTotal(data), after: n.business });
  }
  for (const b of data.branches) {
    rows.push({ key: `shop-${b.id}`, kind: "shop", group: "Shops", name: b.name, before: sum(b.months), after: n.shops[b.id] ?? sum(b.months) });
  }
  for (const a of data.agents) {
    rows.push({ key: `agent-${agentKey(a)}`, kind: "agent", group: branchName(a.branchId), name: a.name, before: sum(a.months), after: n.agents[agentKey(a)] ?? sum(a.months) });
  }
  return rows;
}

export const changedRows = (rows: ChangeRow[]): ChangeRow[] => rows.filter((r) => r.after !== r.before);

/**
 * Only what the person changed (against what they started from), each with months rescaled to the new yearly
 * total. Anything they did not touch is left out, so saving never overwrites someone else's newer figure.
 * Null when nothing changed.
 */
export function buildAllocationInput(plan: Plan, snapshot: Plan, data: TargetsYear): AllocationInput | null {
  const n = planNumbers(plan);
  const input: AllocationInput = { year: data.year };
  let changed = 0;

  if (isEdited(plan, snapshot, "business", "business") && n.business !== businessTotal(data)) {
    input.business = { months: scaleMonths(data.business?.months ?? [], n.business) };
    changed++;
  }
  const shops = data.branches
    .filter((b) => isEdited(plan, snapshot, "shop", b.id) && n.shops[b.id] !== undefined && n.shops[b.id] !== sum(b.months))
    .map((b) => ({ branchId: b.id, months: scaleMonths(b.months, n.shops[b.id]) }));
  if (shops.length > 0) {
    input.shops = shops;
    changed += shops.length;
  }
  const agents = data.agents
    .filter((a) => !a.inactive && isEdited(plan, snapshot, "agent", agentKey(a)) && n.agents[agentKey(a)] !== undefined && n.agents[agentKey(a)] !== sum(a.months))
    .map((a) => ({ branchId: a.branchId, userId: a.userId, months: scaleMonths(a.months, n.agents[agentKey(a)]) }));
  if (agents.length > 0) {
    input.agents = agents;
    changed += agents.length;
  }
  return changed === 0 ? null : input;
}
