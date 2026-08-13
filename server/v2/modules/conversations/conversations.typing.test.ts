import { describe, it, expect, vi, beforeEach } from "vitest";

// broadcastTyping is the "<agent> is typing…" fan-out. It is cosmetic and
// fire-and-forget, so the contract that matters is: the right event shape, the
// real name from the account, and never throwing at the caller.

vi.mock("../sendseven-webhook/sendseven-webhook.service", () => ({ sendsevenWebhookService: {} }));
vi.mock("../sendseven-webhook/suggest-reply.service", () => ({ suggestAiReply: vi.fn() }));
vi.mock("./conversations.repository", () => ({ conversationsRepository: {} }));
vi.mock("../user/user.repository", () => ({
  userRepository: { findRoleAndNameById: vi.fn(async () => ({ name: "Tina Love", role: "agent" })) },
}));
vi.mock("../../realtime/realtime.service", () => ({ realtimeService: { publish: vi.fn() } }));

import { conversationsService } from "./conversations.service";
import { userRepository } from "../user/user.repository";
import { realtimeService } from "../../realtime/realtime.service";

const ORG = "org-1";
const CONV = "conv-1";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(userRepository.findRoleAndNameById).mockResolvedValue({ name: "Tina Love", role: "agent" } as never);
});

describe("conversationsService.broadcastTyping", () => {
  it("publishes the agent's real name, resolved server-side", async () => {
    await conversationsService.broadcastTyping(ORG, CONV, "user-1", false);

    expect(userRepository.findRoleAndNameById).toHaveBeenCalledWith("user-1");
    expect(realtimeService.publish).toHaveBeenCalledWith(ORG, {
      type: "typing",
      conversationId: CONV,
      typing: { actor: "agent", name: "Tina Love", userId: "user-1", stopped: false },
    });
  });

  it("marks the stop so colleagues' indicators clear immediately", async () => {
    await conversationsService.broadcastTyping(ORG, CONV, "user-1", true);

    expect(vi.mocked(realtimeService.publish).mock.calls[0][1]).toMatchObject({
      typing: { stopped: true },
    });
  });

  it("still publishes when the name can't be looked up", async () => {
    vi.mocked(userRepository.findRoleAndNameById).mockRejectedValue(new Error("db down"));

    await conversationsService.broadcastTyping(ORG, CONV, "user-1", false);

    expect(vi.mocked(realtimeService.publish).mock.calls[0][1]).toMatchObject({
      typing: { actor: "agent", name: undefined },
    });
  });

  it("never throws at the caller when the bus fails — it is only an indicator", async () => {
    vi.mocked(realtimeService.publish).mockImplementation(() => {
      throw new Error("bus down");
    });

    await expect(conversationsService.broadcastTyping(ORG, CONV, "user-1", false)).resolves.toBeUndefined();
  });

  it("ignores a call with no conversation, without touching the bus", async () => {
    await conversationsService.broadcastTyping(ORG, "", "user-1", false);

    expect(realtimeService.publish).not.toHaveBeenCalled();
    expect(userRepository.findRoleAndNameById).not.toHaveBeenCalled();
  });
});
