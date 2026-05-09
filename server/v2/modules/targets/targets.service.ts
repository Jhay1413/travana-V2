import * as targetsRepository from "./targets.repository";
import type {
  ShopTargetInput,
  AgentTargetInput,
  TargetsOverview,
  MonthTargetSummary,
} from "./targets.types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function getAllShopTargets() {
  return await targetsRepository.getAllShopTargets();
}

export async function upsertShopTargets(targets: ShopTargetInput[]) {
  for (const target of targets) {
    if (target.month < 1 || target.month > 12) {
      throw new Error(`Invalid month: ${target.month}. Must be between 1 and 12.`);
    }
    if (target.year < 2020 || target.year > 2050) {
      throw new Error(`Invalid year: ${target.year}. Must be between 2020 and 2050.`);
    }
    const amount = parseFloat(target.targetAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error(`Invalid target amount: ${target.targetAmount}. Must be a positive number.`);
    }
  }

  return await targetsRepository.bulkUpsertShopTargets(targets);
}

export async function getAllAgentTargets() {
  return await targetsRepository.getAllAgentTargets();
}

export async function getAgentTargetsByUserId(userId: string) {
  return await targetsRepository.getAgentTargetsByUserId(userId);
}

export async function upsertAgentTargets(targets: AgentTargetInput[]) {
  for (const target of targets) {
    if (!target.userId) {
      throw new Error("User ID is required for agent targets.");
    }
    if (target.month < 1 || target.month > 12) {
      throw new Error(`Invalid month: ${target.month}. Must be between 1 and 12.`);
    }
    if (target.year < 2020 || target.year > 2050) {
      throw new Error(`Invalid year: ${target.year}. Must be between 2020 and 2050.`);
    }
    const amount = parseFloat(target.targetAmount);
    if (isNaN(amount) || amount < 0) {
      throw new Error(`Invalid target amount: ${target.targetAmount}. Must be a positive number.`);
    }
  }

  return await targetsRepository.bulkUpsertAgentTargets(targets);
}

export async function getAllAgents() {
  return await targetsRepository.getAllAgents();
}

export async function getTargetsOverview(): Promise<TargetsOverview> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  let endYear = currentYear;
  let endMonth = currentMonth + 23;

  if (endMonth > 12) {
    endYear += Math.floor(endMonth / 12);
    endMonth = endMonth % 12;
    if (endMonth === 0) {
      endMonth = 12;
      endYear -= 1;
    }
  }

  const [shopTargets, agentTargets, agents, summaryData] = await Promise.all([
    targetsRepository.getShopTargetsByDateRange(currentYear, currentMonth, endYear, endMonth),
    targetsRepository.getAgentTargetsByDateRange(currentYear, currentMonth, endYear, endMonth),
    targetsRepository.getAllAgents(),
    targetsRepository.getTargetSummaryByDateRange(currentYear, currentMonth, endYear, endMonth),
  ]);

  const summary: MonthTargetSummary[] = [];

  const agentSumMap = new Map<string, string>();
  for (const sum of summaryData.agentTargetSums) {
    const key = `${sum.year}-${sum.month}`;
    agentSumMap.set(key, sum.total);
  }

  const shopTargetMap = new Map<string, string>();
  for (const target of summaryData.shopTargets) {
    const key = `${target.year}-${target.month}`;
    shopTargetMap.set(key, target.targetAmount);
  }

  for (let i = 0; i < 24; i++) {
    let year = currentYear;
    let month = currentMonth + i;

    if (month > 12) {
      year += Math.floor((month - 1) / 12);
      month = ((month - 1) % 12) + 1;
    }

    const key = `${year}-${month}`;
    const shopTarget = shopTargetMap.get(key) || "0.00";
    const totalAgentTargets = agentSumMap.get(key) || "0.00";

    const shopAmount = parseFloat(shopTarget);
    const agentAmount = parseFloat(totalAgentTargets);
    const difference = (agentAmount - shopAmount).toFixed(2);

    summary.push({
      year,
      month,
      monthName: MONTH_NAMES[month - 1],
      shopTarget,
      totalAgentTargets,
      difference,
    });
  }

  return {
    shopTargets,
    agentTargets,
    agents,
    summary,
  };
}
