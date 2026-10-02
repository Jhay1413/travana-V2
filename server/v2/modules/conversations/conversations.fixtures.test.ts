import { beforeEach, describe, expect, it } from "vitest";
import {
  SAMPLE_CONVERSATIONS,
  resetSampleConversations,
  sampleBadgeCounts,
  sampleBulkClose,
  sampleConversationById,
  sampleConversationList,
  sampleConversationPatched,
} from "./conversations.fixtures";

// The fixture store is module-level state, so every test starts from the seed.
beforeEach(() => resetSampleConversations());

const openIds = () => sampleConversationList({ status: "open", pageSize: 100 }).items.map((c) => c.id);

describe("conversation fixtures (stateful)", () => {
  it("close removes the conversation from the open tab and drops open_count", () => {
    const before = sampleBadgeCounts().open_count;
    expect(openIds()).toContain("conv-michael");

    sampleConversationPatched("conv-michael", { status: "closed", closed_at: "2025-02-01T00:00:00Z" });

    expect(openIds()).not.toContain("conv-michael");
    expect(sampleConversationById("conv-michael")?.status).toBe("closed");
    expect(sampleConversationList({ status: "closed", pageSize: 100 }).items.map((c) => c.id)).toContain("conv-michael");
    expect(sampleBadgeCounts().open_count).toBe(before - 1);
  });

  it("reopen puts it back", () => {
    sampleConversationPatched("conv-michael", { status: "closed" });
    sampleConversationPatched("conv-michael", { status: "open", closed_at: null });
    expect(openIds()).toContain("conv-michael");
  });

  it("snooze moves it to the snoozed tab and updates snoozed_count", () => {
    const before = sampleBadgeCounts();
    sampleConversationPatched("conv-lisa", { status: "snoozed", snoozed_until: "2030-01-01T00:00:00Z" });
    expect(openIds()).not.toContain("conv-lisa");
    expect(sampleBadgeCounts().snoozed_count).toBe(before.snoozed_count + 1);
  });

  it("bulk close closes known ids and reports unknown ones", () => {
    const res = sampleBulkClose({ conversation_ids: ["conv-sarah", "conv-emma", "nope"] });
    expect(res).toEqual({ success_count: 2, failed_count: 1, failed_ids: ["nope"] });
    expect(openIds()).not.toContain("conv-sarah");
    expect(openIds()).not.toContain("conv-emma");
  });

  it("returns null for unknown ids and never patches id", () => {
    expect(sampleConversationPatched("missing", { status: "closed" })).toBeNull();
    sampleConversationPatched("conv-tom", { id: "hijack" });
    expect(sampleConversationById("conv-tom")).not.toBeNull();
    expect(sampleConversationById("hijack")).toBeNull();
  });

  it("returned records are copies, not store references", () => {
    const got = sampleConversationById("conv-tom");
    if (got) got.status = "closed";
    expect(openIds()).toContain("conv-tom");
  });

  it("reset restores the seed and the seed itself is never mutated", () => {
    const seedStatus = SAMPLE_CONVERSATIONS.find((c) => c.id === "conv-michael")?.status;
    const seedOpen = sampleBadgeCounts().open_count;
    sampleConversationPatched("conv-michael", { status: "closed" });
    expect(SAMPLE_CONVERSATIONS.find((c) => c.id === "conv-michael")?.status).toBe(seedStatus);
    resetSampleConversations();
    expect(sampleBadgeCounts().open_count).toBe(seedOpen);
    expect(openIds()).toContain("conv-michael");
  });
});
