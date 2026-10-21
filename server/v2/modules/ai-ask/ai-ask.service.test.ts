import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../note/note.repository", () => ({ noteRepository: { create: vi.fn() } }));
vi.mock("../client/client.repository", () => ({ clientRepository: { findById: vi.fn() } }));
vi.mock("../../utils/ai-model", () => ({ getOpenAI: vi.fn() }));
vi.mock("../usage/usage.service", () => ({ usageService: {} }));

import { aiAskService } from "./ai-ask.service";
import { noteRepository } from "../note/note.repository";
import { clientRepository } from "../client/client.repository";
import type { Scope } from "../../utils/scope";

const SCOPE = { orgId: "org1" } as Scope;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(clientRepository.findById).mockResolvedValue({ id: "c1" } as never);
  vi.mocked(noteRepository.create).mockResolvedValue({} as never);
});

describe("aiAskService.saveToClient sanitising", () => {
  it("strips script/handlers from AI output but keeps formatting", async () => {
    await aiAskService.saveToClient({
      clientId: "c1",
      question: "Best time?",
      answer: "<b>May</b><script>alert(1)</script><img src=x onerror=alert(1)>",
      agentId: "a1",
      scope: SCOPE,
    });
    const content = vi.mocked(noteRepository.create).mock.calls[0][0].content ?? "";
    expect(content).toContain("<b>May</b>");
    expect(content).not.toMatch(/script|onerror|<img/i);
  });
});
