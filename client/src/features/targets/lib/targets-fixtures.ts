import type { AgentYear, BranchYear, HomeworkerYear, TargetsYear } from "../types";
import { evenMonths } from "./months";

/** Test data: one business of 100,000 = Hetton 60,000 + Durham 30,000 + a homeworker 10,000. */
export function makeAgent(over: Partial<AgentYear> & Pick<AgentYear, "userId" | "branchId">, yearly = 0): AgentYear {
  return { name: over.userId, months: evenMonths(yearly), actual: [], ...over };
}

export function makeBranch(over: Partial<BranchYear> & Pick<BranchYear, "id">, yearly = 0): BranchYear {
  return { name: over.id, months: evenMonths(yearly), actual: [], ...over };
}

export function makeHomeworker(over: Partial<HomeworkerYear> & Pick<HomeworkerYear, "userId">, yearly = 0): HomeworkerYear {
  return {
    branchId: "hw-branch",
    name: over.userId,
    months: evenMonths(yearly),
    selfMonths: evenMonths(yearly),
    source: "self",
    note: null,
    actual: [],
    ...over,
  };
}

export function makeYear(over: Partial<TargetsYear> = {}): TargetsYear {
  return {
    year: 2026,
    elapsed: 0.5,
    currentMonth: 6,
    business: { months: evenMonths(100000), actual: [] },
    branches: [makeBranch({ id: "hetton", name: "Hetton" }, 60000), makeBranch({ id: "durham", name: "Durham" }, 30000)],
    agents: [
      makeAgent({ userId: "sarah", name: "Sarah", branchId: "hetton" }, 40000),
      makeAgent({ userId: "tom", name: "Tom", branchId: "hetton" }, 20000),
      makeAgent({ userId: "maya", name: "Maya", branchId: "durham" }, 30000),
    ],
    homeworkers: [makeHomeworker({ userId: "priya" }, 10000)],
    canEdit: { business: true, shopBranchIds: ["hetton", "durham"], agentBranchIds: ["hetton", "durham"], homeworkers: true, mine: false },
    ...over,
  };
}
