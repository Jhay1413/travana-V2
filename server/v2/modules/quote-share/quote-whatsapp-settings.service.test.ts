import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-whatsapp-settings.repository", () => ({
  quoteWhatsappSettingsRepository: { findByOrg: vi.fn(), upsert: vi.fn() },
}));

import { quoteWhatsappSettingsService } from "./quote-whatsapp-settings.service";
import { quoteWhatsappSettingsRepository } from "./quote-whatsapp-settings.repository";
import type { OrgWhatsappSettings } from "@shared/schema";

const row = (over: Partial<OrgWhatsappSettings> = {}): OrgWhatsappSettings => ({
  orgId: "o1", quoteTemplateName: "quote_ready", quoteTemplateLanguage: "en_GB", quoteTemplateChannelId: "ch1",
  quoteTemplateVariables: { "1": { source: "quote_link" } }, updatedBy: "u1", createdAt: new Date(), updatedAt: new Date(), ...over,
});

beforeEach(() => vi.resetAllMocks());

describe("quoteWhatsappSettingsService", () => {
  it("returns nulls and {} when the org has no row", async () => {
    vi.mocked(quoteWhatsappSettingsRepository.findByOrg).mockResolvedValue(null);
    await expect(quoteWhatsappSettingsService.get("o1")).resolves.toEqual({
      templateName: null, templateLanguage: null, channelId: null, variables: {},
    });
  });

  it("maps a row to the API shape", async () => {
    vi.mocked(quoteWhatsappSettingsRepository.findByOrg).mockResolvedValue(row());
    await expect(quoteWhatsappSettingsService.get("o1")).resolves.toEqual({
      templateName: "quote_ready", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" } },
    });
  });

  it("saves the given settings scoped to the org and user", async () => {
    vi.mocked(quoteWhatsappSettingsRepository.upsert).mockResolvedValue(row());
    const input = { templateName: "quote_ready", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" as const } } };
    await expect(quoteWhatsappSettingsService.save("o1", input, "u1")).resolves.toEqual(input);
    expect(quoteWhatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { quoteTemplateName: "quote_ready", quoteTemplateLanguage: "en_GB", quoteTemplateChannelId: "ch1", quoteTemplateVariables: input.variables },
      "u1",
    );
  });

  it("stores nulls and {} when the template name is null, ignoring the other fields", async () => {
    vi.mocked(quoteWhatsappSettingsRepository.upsert).mockResolvedValue(
      row({ quoteTemplateName: null, quoteTemplateLanguage: null, quoteTemplateChannelId: null, quoteTemplateVariables: {} }),
    );
    await quoteWhatsappSettingsService.save(
      "o1",
      { templateName: null, templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" } } },
      null,
    );
    expect(quoteWhatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { quoteTemplateName: null, quoteTemplateLanguage: null, quoteTemplateChannelId: null, quoteTemplateVariables: {} },
      null,
    );
  });
});
