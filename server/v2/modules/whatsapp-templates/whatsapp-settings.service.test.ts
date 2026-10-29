import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./whatsapp-settings.repository", () => ({
  whatsappSettingsRepository: { findByOrg: vi.fn(), upsert: vi.fn() },
}));

import { whatsappSettingsService } from "./whatsapp-settings.service";
import { whatsappSettingsRepository } from "./whatsapp-settings.repository";
import type { OrgWhatsappSettings } from "@shared/schema";

const row = (over: Partial<OrgWhatsappSettings> = {}): OrgWhatsappSettings => ({
  orgId: "o1",
  quoteTemplateName: "quote_ready", quoteTemplateLanguage: "en_GB", quoteTemplateChannelId: "ch1",
  quoteTemplateVariables: { "1": { source: "quote_link" } },
  updateTemplateName: "general_update", updateTemplateLanguage: "en", updateTemplateChannelId: "ch2",
  updateTemplateVariables: { "1": { source: "message" } },
  updatedBy: "u1", createdAt: new Date(), updatedAt: new Date(), ...over,
});

const EMPTY = { templateName: null, templateLanguage: null, channelId: null, variables: {} };

beforeEach(() => vi.resetAllMocks());

describe("whatsappSettingsService - reads", () => {
  it("returns nulls and {} for both kinds when the org has no row", async () => {
    vi.mocked(whatsappSettingsRepository.findByOrg).mockResolvedValue(null);
    await expect(whatsappSettingsService.getQuote("o1")).resolves.toEqual(EMPTY);
    await expect(whatsappSettingsService.getUpdate("o1")).resolves.toEqual(EMPTY);
  });

  it("maps each kind from its own columns", async () => {
    vi.mocked(whatsappSettingsRepository.findByOrg).mockResolvedValue(row());
    await expect(whatsappSettingsService.getQuote("o1")).resolves.toEqual({
      templateName: "quote_ready", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" } },
    });
    await expect(whatsappSettingsService.getUpdate("o1")).resolves.toEqual({
      templateName: "general_update", templateLanguage: "en", channelId: "ch2", variables: { "1": { source: "message" } },
    });
  });
});

describe("whatsappSettingsService - quote saves", () => {
  it("writes only the quote columns, scoped to the org and user", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(row());
    const input = { templateName: "quote_ready", templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" as const } } };
    await expect(whatsappSettingsService.saveQuote("o1", input, "u1")).resolves.toEqual(input);
    expect(whatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { quoteTemplateName: "quote_ready", quoteTemplateLanguage: "en_GB", quoteTemplateChannelId: "ch1", quoteTemplateVariables: input.variables },
      "u1",
    );
  });

  it("clearing wipes only the quote kind, ignoring the other fields", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(
      row({ quoteTemplateName: null, quoteTemplateLanguage: null, quoteTemplateChannelId: null, quoteTemplateVariables: {} }),
    );
    await whatsappSettingsService.saveQuote(
      "o1",
      { templateName: null, templateLanguage: "en_GB", channelId: "ch1", variables: { "1": { source: "quote_link" } } },
      null,
    );
    expect(whatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { quoteTemplateName: null, quoteTemplateLanguage: null, quoteTemplateChannelId: null, quoteTemplateVariables: {} },
      null,
    );
  });
});

describe("whatsappSettingsService - update saves", () => {
  it("writes only the update columns", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(row());
    const input = { templateName: "general_update", templateLanguage: "en", channelId: "ch2", variables: { "1": { source: "message" as const } } };
    await expect(whatsappSettingsService.saveUpdate("o1", input, "u1")).resolves.toEqual(input);
    const [, columns] = vi.mocked(whatsappSettingsRepository.upsert).mock.calls[0];
    expect(columns).toEqual({
      updateTemplateName: "general_update", updateTemplateLanguage: "en", updateTemplateChannelId: "ch2", updateTemplateVariables: input.variables,
    });
    expect(Object.keys(columns).some((k) => k.startsWith("quote"))).toBe(false);
  });

  it("clearing wipes only the update kind", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(
      row({ updateTemplateName: null, updateTemplateLanguage: null, updateTemplateChannelId: null, updateTemplateVariables: {} }),
    );
    await whatsappSettingsService.saveUpdate("o1", { ...EMPTY, templateLanguage: "en" }, "u1");
    const [, columns] = vi.mocked(whatsappSettingsRepository.upsert).mock.calls[0];
    expect(columns).toEqual({ updateTemplateName: null, updateTemplateLanguage: null, updateTemplateChannelId: null, updateTemplateVariables: {} });
  });
});
