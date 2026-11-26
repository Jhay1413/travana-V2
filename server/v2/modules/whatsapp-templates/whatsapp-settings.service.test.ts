import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./whatsapp-settings.repository", () => ({
  whatsappSettingsRepository: { findByOrg: vi.fn(), findPinResetByOrg: vi.fn(), upsert: vi.fn(), findPurposeTemplatesByOrg: vi.fn(), upsertPurposeTemplate: vi.fn() },
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
  pinResetTemplateName: null, pinResetTemplateLanguage: null, pinResetTemplateChannelId: null, pinResetTemplateVariables: {}, purposeTemplates: {},
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

describe("whatsappSettingsService - portal sign-in link template", () => {
  it("reads from the sign-in columns only, from its own query", async () => {
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockResolvedValue({
      pinResetTemplateName: "portal_sign_in", pinResetTemplateLanguage: "en_GB", pinResetTemplateChannelId: "ch3",
      pinResetTemplateVariables: { "1": { source: "sign_in_link" } },
    });
    await expect(whatsappSettingsService.getPinReset("o1")).resolves.toEqual({
      templateName: "portal_sign_in", templateLanguage: "en_GB", channelId: "ch3", variables: { "1": { source: "sign_in_link" } },
    });
    expect(whatsappSettingsRepository.findByOrg).not.toHaveBeenCalled();
  });

  it("an org with no row gets the empty settings", async () => {
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockResolvedValue(null);
    await expect(whatsappSettingsService.getPinReset("o1")).resolves.toEqual(EMPTY);
  });

  it("saves only the sign-in columns, scoped to the org and user", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(row({
      pinResetTemplateName: "portal_sign_in", pinResetTemplateLanguage: "en_GB", pinResetTemplateChannelId: "ch3",
      pinResetTemplateVariables: { "1": { source: "sign_in_link" } },
    }));
    const input = { templateName: "portal_sign_in", templateLanguage: "en_GB", channelId: "ch3", variables: { "1": { source: "sign_in_link" as const } } };
    await expect(whatsappSettingsService.savePinReset("o1", input, "u1")).resolves.toEqual(input);
    expect(whatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { pinResetTemplateName: "portal_sign_in", pinResetTemplateLanguage: "en_GB", pinResetTemplateChannelId: "ch3", pinResetTemplateVariables: input.variables },
      "u1",
    );
  });

  it("clearing the template clears every sign-in column", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockResolvedValue(row());
    await whatsappSettingsService.savePinReset("o1", { templateName: null, templateLanguage: "en", channelId: "x", variables: { "1": { source: "sign_in_link" } } }, null);
    expect(whatsappSettingsRepository.upsert).toHaveBeenCalledWith(
      "o1",
      { pinResetTemplateName: null, pinResetTemplateLanguage: null, pinResetTemplateChannelId: null, pinResetTemplateVariables: {} },
      null,
    );
  });
});

describe("whatsappSettingsService - before the database update", () => {
  const input = { templateName: "portal_sign_in", templateLanguage: "en_GB", channelId: "ch3", variables: { "1": { source: "sign_in_link" as const } } };

  it("saving the sign-in template fails with a clear 503 when the columns do not exist yet", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockRejectedValue(Object.assign(new Error("column does not exist"), { code: "42703" }));
    await expect(whatsappSettingsService.savePinReset("o1", input, "u1")).rejects.toMatchObject({ statusCode: 503, message: expect.stringContaining("database update") });
  });

  it("the same error from a quote save is not disguised", async () => {
    vi.mocked(whatsappSettingsRepository.upsert).mockRejectedValue(Object.assign(new Error("boom"), { code: "42703" }));
    await expect(whatsappSettingsService.saveQuote("o1", input, "u1")).rejects.toThrow("boom");
  });
});

describe('whatsappSettingsService - per-message-type templates', () => {
  const cfg = { templateName: 'booking_ok', language: 'en_GB', channelId: 'ch1', variables: { '1': { source: 'client_first_name' as const } } };

  it('reads one type as the shared settings shape, empty when none is saved', async () => {
    vi.mocked(whatsappSettingsRepository.findPurposeTemplatesByOrg).mockResolvedValue({ booking_confirmation: cfg });
    await expect(whatsappSettingsService.getPurposeTemplate('o1', 'booking_confirmation')).resolves.toEqual({
      templateName: 'booking_ok', templateLanguage: 'en_GB', channelId: 'ch1', variables: { '1': { source: 'client_first_name' } },
    });
    await expect(whatsappSettingsService.getPurposeTemplate('o1', 'portal_ready')).resolves.toEqual(EMPTY);
  });

  it('before the column exists, reads are empty (no template chosen) rather than errors', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.mocked(whatsappSettingsRepository.findPurposeTemplatesByOrg).mockRejectedValue(Object.assign(new Error('no column'), { code: '42703' }));
    await expect(whatsappSettingsService.getPurposeTemplates('o1')).resolves.toEqual({});
  });

  it('any other read error is not swallowed', async () => {
    vi.mocked(whatsappSettingsRepository.findPurposeTemplatesByOrg).mockRejectedValue(new Error('connection reset'));
    await expect(whatsappSettingsService.getPurposeTemplates('o1')).rejects.toThrow('connection reset');
  });

  it('saves one type for the org and user, and returns it in the shared shape', async () => {
    vi.mocked(whatsappSettingsRepository.upsertPurposeTemplate).mockResolvedValue({ departure_reminder: cfg });
    const out = await whatsappSettingsService.savePurposeTemplate('o1', 'departure_reminder', { templateName: 'booking_ok', templateLanguage: 'en_GB', channelId: 'ch1', variables: cfg.variables }, 'u1');
    expect(whatsappSettingsRepository.upsertPurposeTemplate).toHaveBeenCalledWith('o1', 'departure_reminder', cfg, 'u1');
    expect(out.templateName).toBe('booking_ok');
  });

  it('clearing the template clears everything of that type', async () => {
    vi.mocked(whatsappSettingsRepository.upsertPurposeTemplate).mockResolvedValue({});
    await whatsappSettingsService.savePurposeTemplate('o1', 'portal_ready', { templateName: null, templateLanguage: 'en', channelId: 'ch1', variables: { '1': { source: 'portal_link' } } }, 'u1');
    expect(whatsappSettingsRepository.upsertPurposeTemplate).toHaveBeenCalledWith('o1', 'portal_ready', { templateName: null, language: null, channelId: null, variables: {} }, 'u1');
  });

  it('saving before the column exists is a clear 503', async () => {
    vi.mocked(whatsappSettingsRepository.upsertPurposeTemplate).mockRejectedValue(Object.assign(new Error('no column'), { code: '42703' }));
    await expect(whatsappSettingsService.savePurposeTemplate('o1', 'portal_ready', { templateName: null, templateLanguage: null, channelId: null, variables: {} }, null)).rejects.toMatchObject({ statusCode: 503 });
  });
});

describe("whatsappSettingsService - the sign-in link template before its columns exist", () => {
  it("reads as empty (no template chosen) instead of failing, so the Integrations page never 500s", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockRejectedValue(Object.assign(new Error("no column"), { code: "42703" }));
    await expect(whatsappSettingsService.getPinReset("o1")).resolves.toEqual(EMPTY);
  });

  it("recognises the error when the driver wraps it in cause", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockRejectedValue(Object.assign(new Error("wrapped"), { cause: { code: "42703" } }));
    await expect(whatsappSettingsService.getPinReset("o1")).resolves.toEqual(EMPTY);
  });

  it("any other error is not hidden", async () => {
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockRejectedValue(new Error("connection reset"));
    await expect(whatsappSettingsService.getPinReset("o1")).rejects.toThrow("connection reset");
  });

  it("still reads a saved template when the columns exist", async () => {
    vi.mocked(whatsappSettingsRepository.findPinResetByOrg).mockResolvedValue({ pinResetTemplateName: "pin", pinResetTemplateLanguage: "en", pinResetTemplateChannelId: "c", pinResetTemplateVariables: { "1": { source: "sign_in_link" } } });
    await expect(whatsappSettingsService.getPinReset("o1")).resolves.toMatchObject({ templateName: "pin" });
  });
});
