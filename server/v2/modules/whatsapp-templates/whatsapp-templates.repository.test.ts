import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../utils/sendseven", () => ({ isSendSevenConfigured: vi.fn(), sendSevenRequest: vi.fn() }));

import { whatsappTemplatesRepository } from "./whatsapp-templates.repository";
import { sendSevenRequest } from "../../utils/sendseven";

beforeEach(() => vi.resetAllMocks());

describe("whatsappTemplatesRepository.send", () => {
  it("POSTs the body to the template's send endpoint with the name URL-encoded", async () => {
    vi.mocked(sendSevenRequest).mockResolvedValue({ success: true });
    const body = { conversation_id: "cv", channel_id: "ch1" };
    await whatsappTemplatesRepository.send("quote ready", body);
    expect(sendSevenRequest).toHaveBeenCalledWith("POST", "/whatsapp-templates/quote%20ready/send", { body });
  });
});
