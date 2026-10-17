import { businessDrift, driftMessage, profitSoFar, shopDrift, unbalancedMonths, agentKey, liveMonth, isBusinessSet } from "./allocation";
import { buildAllocationInput, calcPlan, changeRows, changedRows, clampStep, effectivePlan, findConflicts, planFromYear, reachableStep, reconcilePlan, resolveConflict, stepProblems } from "./plan";
import { evenMonths, sum } from "./months";
import { makeAgent, makeBranch, makeYear } from "./targets-fixtures";

describe("drift", () => {
  it("is zero when shops plus homeworkers equal the business target", () => {
    expect(businessDrift(makeYear())).toBe(0);
  });

  it("is negative when money is not allocated yet and positive when it is over", () => {
    const short = makeYear({ branches: [makeBranch({ id: "hetton", name: "Hetton" }, 50000), makeBranch({ id: "durham", name: "Durham" }, 30000)] });
    expect(businessDrift(short)).toBe(-10000);
    const over = makeYear({ branches: [makeBranch({ id: "hetton", name: "Hetton" }, 70000), makeBranch({ id: "durham", name: "Durham" }, 30000)] });
    expect(businessDrift(over)).toBe(10000);
  });

  it("works out the drift of a shop from its agents", () => {
    expect(shopDrift(makeYear(), "hetton")).toBe(0);
    const data = makeYear({ agents: [makeAgent({ userId: "sarah", branchId: "hetton" }, 45000)] });
    expect(shopDrift(data, "hetton")).toBe(-15000);
  });

  it("words it for people", () => {
    expect(driftMessage(0)).toEqual({ tone: "ok", text: "Fully allocated" });
    expect(driftMessage(-2000).text).toBe("£2,000 not allocated yet");
    expect(driftMessage(2000).text).toBe("£2,000 over");
    expect(driftMessage(2000).tone).toBe("bad");
  });

  it("finds months where the levels do not add up", () => {
    expect(unbalancedMonths(makeYear())).toEqual([]);
    const biz = evenMonths(100000);
    biz[3] += 100;
    expect(unbalancedMonths(makeYear({ business: { months: biz, actual: [] } }))).toEqual([3]);
  });

  it("adds profit up to the current month only", () => {
    expect(profitSoFar([1, 2, 3, 4, 5], 3)).toBe(6);
    expect(profitSoFar([1, 2, 3], 12)).toBe(6);
    expect(profitSoFar([1, 2, 3], 0)).toBe(0);
  });
});

describe("wizard step gating", () => {
  const data = makeYear();

  it("lets a balanced plan through every step", () => {
    const calc = calcPlan(planFromYear(data), data);
    expect(reachableStep(calc)).toBe(4);
  });

  it("stops at step 1 until the business target is a positive amount", () => {
    const plan = { ...planFromYear(data), business: "" };
    expect(reachableStep(calcPlan(plan, data))).toBe(1);
    expect(reachableStep(calcPlan({ ...plan, business: "0" }, data))).toBe(1);
  });

  it("stops at step 1 when the business target is below what homeworkers planned", () => {
    const plan = { ...planFromYear(data), business: "5,000" };
    const calc = calcPlan(plan, data);
    expect(calc.bizOk).toBe(false);
    expect(reachableStep(calc)).toBe(1);
  });

  it("cannot skip past an unbalanced shops step", () => {
    const plan = { ...planFromYear(data), business: "120,000" };
    const calc = calcPlan(plan, data);
    expect(calc.shopsDrift).toBe(-20000);
    expect(reachableStep(calc)).toBe(2);
    expect(clampStep(4, reachableStep(calc))).toBe(2);
    expect(clampStep("3", reachableStep(calc))).toBe(2);
  });

  it("cannot skip past an unbalanced agents step", () => {
    const base = planFromYear(data);
    const plan = { ...base, agents: { ...base.agents, "hetton|tom": "10,000" } };
    const calc = calcPlan(plan, data);
    expect(calc.shopRows.find((r) => r.branchId === "hetton")?.drift).toBe(-10000);
    expect(reachableStep(calc)).toBe(3);
    expect(clampStep(4, 3)).toBe(3);
  });

  it("treats a shop with no agents as done", () => {
    const noAgents = makeYear({ agents: [] });
    expect(reachableStep(calcPlan(planFromYear(noAgents), noAgents))).toBe(4);
  });

  it("flags a box that is not a whole-pound amount", () => {
    const base = planFromYear(data);
    const calc = calcPlan({ ...base, shops: { ...base.shops, hetton: "6o,000" } }, data);
    expect(calc.shopFieldErrors).toEqual(["hetton"]);
    expect(reachableStep(calc)).toBe(2);
  });

  it("clamps a typed-in step into 1 to 4", () => {
    expect(clampStep("abc", 4)).toBe(1);
    expect(clampStep(null, 4)).toBe(1);
    expect(clampStep(0, 4)).toBe(1);
    expect(clampStep(9, 4)).toBe(4);
    expect(clampStep(2.7, 4)).toBe(2);
  });

  it("explains what is wrong on a blocked step", () => {
    const base = planFromYear(data);
    const calc = calcPlan({ ...base, business: "120,000" }, data);
    const problems = stepProblems(2, { ...base, business: "120,000" }, data, calc);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("£20,000 under");
    expect(stepProblems(1, base, data, calcPlan(base, data))).toEqual([]);
  });
});

describe("review and save", () => {
  const data = makeYear();

  it("lists only what changed", () => {
    const base = planFromYear(data);
    const plan = { ...base, business: "110,000", shops: { ...base.shops, hetton: "70,000" } };
    const changed = changedRows(changeRows(plan, data));
    expect(changed.map((r) => r.key)).toEqual(["business", "shop-hetton"]);
    expect(changed[0]).toMatchObject({ before: 100000, after: 110000 });
  });

  it("sends nothing when nothing changed", () => {
    expect(buildAllocationInput(planFromYear(data), planFromYear(data), data)).toBeNull();
    expect(changedRows(changeRows(planFromYear(data), data))).toHaveLength(0);
  });

  it("sends only changed entities, with months rescaled to the new total", () => {
    const base = planFromYear(data);
    const plan = {
      business: "110,000",
      shops: { ...base.shops, hetton: "70,000" },
      agents: { ...base.agents, "hetton|sarah": "50,000" },
    };
    const input = buildAllocationInput(plan, base, data);
    expect(input?.year).toBe(2026);
    expect(sum(input?.business?.months ?? [])).toBe(110000);
    expect(input?.shops).toHaveLength(1);
    expect(input?.shops?.[0].branchId).toBe("hetton");
    expect(sum(input?.shops?.[0].months ?? [])).toBe(70000);
    expect(input?.agents).toHaveLength(1);
    expect(input?.agents?.[0]).toMatchObject({ branchId: "hetton", userId: "sarah" });
    expect(sum(input?.agents?.[0].months ?? [])).toBe(50000);
  });

  it("never sends inactive agents", () => {
    const withInactive = makeYear({ agents: [makeAgent({ userId: "gone", branchId: "hetton", inactive: true }, 60000)] });
    const base = planFromYear(withInactive);
    const input = buildAllocationInput({ ...base, agents: { "hetton|gone": "1" } }, base, withInactive);
    expect(input).toBeNull();
  });
});

describe("reconcilePlan", () => {
  it("drops people who have left and adds new ones from what is saved", () => {
    const data = makeYear();
    const draft = { business: "130,000", shops: { hetton: "80,000", closed: "9,999" }, agents: { "hetton|sarah": "55,000", "hetton|leaver": "1,000" } };
    const plan = reconcilePlan(draft, data);
    expect(plan.business).toBe("130,000");
    expect(plan.shops).toEqual({ hetton: "80,000", durham: "30,000" });
    expect(plan.agents).toEqual({ "hetton|sarah": "55,000", "hetton|tom": "20,000", "durham|maya": "30,000" });
  });
});

describe('reconcilePlan inactive agents', () => {
  it('resets inactive agents to the saved value', () => {
    const data = makeYear({ agents: [makeAgent({ userId: 'gone', branchId: 'hetton', inactive: true }, 60000)] });
    const plan = reconcilePlan({ ...planFromYear(data), agents: { 'hetton|gone': '1' } }, data);
    expect(plan.agents['hetton|gone']).toBe('60,000');
  });
});

describe('agent keys', () => {
  it('keeps the same person in two shops apart', () => {
    const data = makeYear({ agents: [makeAgent({ userId: 'x', branchId: 'hetton' }, 1000), makeAgent({ userId: 'x', branchId: 'durham' }, 2000)] });
    expect(Object.keys(planFromYear(data).agents)).toEqual(['hetton|x', 'durham|x']);
    expect(agentKey(data.agents[0])).not.toBe(agentKey(data.agents[1]));
  });
});

describe('edits against the starting snapshot', () => {
  const start = makeYear();
  const snapshot = planFromYear(start);

  it('treats untouched boxes as live values', () => {
    const live = makeYear({ branches: [makeBranch({ id: 'hetton', name: 'Hetton' }, 65000), makeBranch({ id: 'durham', name: 'Durham' }, 30000)] });
    const plan = { ...snapshot, business: '110,000' };
    const eff = effectivePlan(plan, snapshot, planFromYear(live));
    expect(eff.business).toBe('110,000');
    expect(eff.shops.hetton).toBe('65,000');
  });

  it('sends only what the person changed, never stale untouched numbers', () => {
    const live = makeYear({ branches: [makeBranch({ id: 'hetton', name: 'Hetton' }, 65000), makeBranch({ id: 'durham', name: 'Durham' }, 30000)] });
    const plan = { ...snapshot, shops: { ...snapshot.shops, durham: '35,000' } };
    const input = buildAllocationInput(effectivePlan(plan, snapshot, planFromYear(live)), snapshot, live);
    expect(input?.shops?.map((x) => x.branchId)).toEqual(['durham']);
    expect(input?.business).toBeUndefined();
  });

  it('flags a clash when someone else changed what the person also changed', () => {
    const live = makeYear({ branches: [makeBranch({ id: 'hetton', name: 'Hetton' }, 65000), makeBranch({ id: 'durham', name: 'Durham' }, 30000)] });
    const mine = { ...snapshot, shops: { ...snapshot.shops, hetton: '70,000' } };
    const conflicts = findConflicts(mine, snapshot, live);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: 'shop', id: 'hetton', name: 'Hetton', mine: '70,000', started: '60,000', latest: '65,000' });
    // No clash for things the person did not touch, or when nothing changed underneath.
    expect(findConflicts(snapshot, snapshot, live)).toEqual([]);
    expect(findConflicts(mine, snapshot, start)).toEqual([]);
  });

  it('resolves a clash either way', () => {
    const live = makeYear({ branches: [makeBranch({ id: 'hetton', name: 'Hetton' }, 65000), makeBranch({ id: 'durham', name: 'Durham' }, 30000)] });
    const mine = { ...snapshot, shops: { ...snapshot.shops, hetton: '70,000' } };
    const [c] = findConflicts(mine, snapshot, live);
    const keep = resolveConflict(mine, snapshot, c, 'mine');
    expect(findConflicts(keep.plan, keep.snapshot, live)).toEqual([]);
    expect(buildAllocationInput(keep.plan, keep.snapshot, live)?.shops?.[0].branchId).toBe('hetton');
    const latest = resolveConflict(mine, snapshot, c, 'latest');
    expect(latest.plan.shops.hetton).toBe('65,000');
    expect(buildAllocationInput(latest.plan, latest.snapshot, live)).toBeNull();
  });
});

describe('business set and live month', () => {
  it('treats zero months as not set', () => {
    expect(isBusinessSet(makeYear())).toBe(true);
    expect(isBusinessSet(makeYear({ business: { months: Array(12).fill(0), actual: [] } }))).toBe(false);
    expect(isBusinessSet(makeYear({ business: null }))).toBe(false);
  });

  it('only has a month to date while the year is under way', () => {
    expect(liveMonth({ elapsed: 0.5, currentMonth: 6 })).toBe(6);
    expect(liveMonth({ elapsed: 1, currentMonth: 12 })).toBe(0);
    expect(liveMonth({ elapsed: 0, currentMonth: 0 })).toBe(0);
  });
});
