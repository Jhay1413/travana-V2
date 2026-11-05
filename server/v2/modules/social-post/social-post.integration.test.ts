import { describe, it, expect, beforeEach } from "vitest";
import { socialPostRepository } from "./social-post.repository";
import { quoteRepository } from "../quote/quote.repository";
import { socialSettingsRepository } from "../social-settings/social-settings.repository";
import { truncateAll, makeOrg, makeUser, makeTransaction, makeQuote } from "../../test/factories";

// Verifies the real columns added for the platform picker: travel_deal.only_socials_targets
// (jsonb snapshot of the accounts a post went to) and org_social_settings.allowed_account_ids.

let orgId: string;
let quoteId: string;

beforeEach(async () => {
  await truncateAll();
  const org = await makeOrg();
  orgId = org.id;
  const user = await makeUser();
  const txn = await makeTransaction({ user_id: user.id, org_id: org.id, branch_id: null });
  const q = await makeQuote({ transaction_id: txn.id, isFreeQuote: true, title: "Social picker quote" });
  quoteId = q.id;
});

function deal(over: Record<string, unknown> = {}) {
  return { title: "Deal", post: "hello", nights: 7, quote_id: quoteId, ...over };
}

describe("travel_deal.only_socials_targets", () => {
  it("is null for a legacy deal", async () => {
    const created = await socialPostRepository.create(deal());
    expect(created.only_socials_targets).toBeNull();
    expect((await socialPostRepository.findByQuoteId(quoteId))?.only_socials_targets).toBeNull();
  });

  it("round-trips the saved targets through create, update and read", async () => {
    const targets = [
      { accountId: 81085, platform: "facebook" },
      { accountId: 7, platform: "instagram" },
    ];
    const created = await socialPostRepository.create(deal({ only_socials_targets: targets }));
    expect(created.only_socials_targets).toEqual(targets);

    const updated = await socialPostRepository.update(created.id, {
      onlySocialsId: "os-1",
      only_socials_targets: [{ accountId: 5, platform: "facebook" }],
    });
    expect(updated.only_socials_targets).toEqual([{ accountId: 5, platform: "facebook" }]);
    expect((await socialPostRepository.findByQuoteId(quoteId))?.only_socials_targets).toEqual([{ accountId: 5, platform: "facebook" }]);
  });

  it("is exposed on the social posts list projection as onlySocialsTargets", async () => {
    const targets = [{ accountId: 7, platform: "instagram" }];
    await socialPostRepository.create(deal({ only_socials_targets: targets, onlySocialsId: "os-1", postSchedule: new Date("2030-01-01T10:00:00Z") }));

    const result = await quoteRepository.findFreeQuotesPaginated(0, 12, false, "none", "", "", "", { orgId: null });
    const row = result.find((q) => q?.id === quoteId);
    expect(row).toBeDefined();
    expect(row?.onlySocialsTargets).toEqual(targets);
  });

  it("projects null for a legacy deal so the client falls back to Facebook", async () => {
    await socialPostRepository.create(deal({ onlySocialsId: "os-1", postSchedule: new Date("2030-01-01T10:00:00Z") }));
    const result = await quoteRepository.findFreeQuotesPaginated(0, 12, false, "none", "", "", "", { orgId: null });
    const row = result.find((q) => q?.id === quoteId);
    expect(row?.onlySocialsTargets).toBeNull();
  });
});

describe("org_social_settings.allowed_account_ids", () => {
  it("is null until a platform admin sets it, then round-trips", async () => {
    expect((await socialSettingsRepository.upsert(orgId, {}, null)).allowedAccountIds).toBeNull();

    const row = await socialSettingsRepository.setAllowedAccountIds(orgId, [81085, 7], null);
    expect(row.allowedAccountIds).toEqual([81085, 7]);
    expect((await socialSettingsRepository.findByOrg(orgId))?.allowedAccountIds).toEqual([81085, 7]);
  });

  it("an agency save of its own defaults never touches the allow-list", async () => {
    await socialSettingsRepository.setAllowedAccountIds(orgId, [5], null);
    const row = await socialSettingsRepository.upsert(orgId, { defaultViewLink: false }, null);
    expect(row.allowedAccountIds).toEqual([5]);
  });

  it("can be reset to null", async () => {
    await socialSettingsRepository.setAllowedAccountIds(orgId, [5], null);
    expect((await socialSettingsRepository.setAllowedAccountIds(orgId, null, null)).allowedAccountIds).toBeNull();
  });
});
