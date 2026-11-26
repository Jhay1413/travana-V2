import { describe, it, expect, beforeEach } from "vitest";
import { truncateAll, makeOrg, makeClient } from "../../test/factories";
import { walletService } from "./wallet.service";
import { walletService as legacyWalletService } from "../../../services/wallet.service";
import { walletTransactionRepository } from "./wallet-transaction.repository";

// DB-backed: proves the withdrawal check and insert are atomic per client. Written to run under
// `npm run test:integration` against the disposable test database.

const TRUSTED = { orgId: null } as const;
const bank = { account_name: "Ada", account_number: "12345678", sort_code: "00-00-00" };

let clientId: string;
let otherClientId: string;

async function credit(id: string, amount: string) {
  await walletTransactionRepository.create({ client_id: id, type: "credit", source: "referral_commission", amount, status: "processed" });
}

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg({ slug: "agency-wallet" });
  clientId = (await makeClient({ orgId: org.id, firstName: "Ada", surename: "Alpha" })).id;
  otherClientId = (await makeClient({ orgId: org.id, firstName: "Ben", surename: "Beta" })).id;
  await credit(clientId, "100.00");
  await credit(otherClientId, "100.00");
});

describe("bank-transfer withdrawals under concurrent requests", () => {
  it("two simultaneous 80.00 requests on a balance of 100.00: exactly one is accepted, the other gets the usual balance message", async () => {
    const results = await Promise.allSettled([
      walletService.requestBankTransfer(clientId, 80, bank, TRUSTED),
      walletService.requestBankTransfer(clientId, 80, bank, TRUSTED),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected?.reason).toMatchObject({ statusCode: 400, message: "Amount exceeds available balance of £20.00" });
    expect(await walletTransactionRepository.getBalance(clientId)).toBeCloseTo(20, 2);
  });

  it("ten simultaneous 30.00 requests on 100.00: exactly three are accepted and the balance never goes negative", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => walletService.requestBankTransfer(clientId, 30, bank, TRUSTED)));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await walletTransactionRepository.getBalance(clientId)).toBeCloseTo(10, 2);
  });

  it("the older /api/portal path (legacy service) is held to the same rule", async () => {
    const results = await Promise.allSettled([legacyWalletService.requestBankTransfer(clientId, 80, bank), legacyWalletService.requestBankTransfer(clientId, 80, bank)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("different customers do not wait for or affect each other", async () => {
    const results = await Promise.allSettled([
      walletService.requestBankTransfer(clientId, 80, bank, TRUSTED),
      walletService.requestBankTransfer(otherClientId, 80, bank, TRUSTED),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
  });
});
