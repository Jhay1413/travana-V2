import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./customer-messaging.repository", () => ({
  customerMessagingRepository: { listSwitchRows: vi.fn(), isOrgActive: vi.fn(), isLogAvailable: vi.fn() },
}));
vi.mock("./customer-messaging.service", () => ({ customerMessagingService: { getAutoChannel: vi.fn() } }));
vi.mock("../conversation-integration/conversation-integration.service", () => ({ conversationIntegrationService: { resolveConfig: vi.fn() } }));
vi.mock("../channels/channels.service", () => ({ channelsService: { listChannels: vi.fn() } }));
vi.mock("../sms/sms.service", () => ({ isSmsConfigured: vi.fn() }));
vi.mock("../whatsapp-templates/whatsapp-settings.service", () => ({ whatsappSettingsService: { getPurposeTemplates: vi.fn(), getPinReset: vi.fn() } }));
vi.mock("../whatsapp-templates/whatsapp-templates.repository", () => ({ whatsappTemplatesRepository: { list: vi.fn() } }));

import { customerMessagingReadinessService as svc, declaredPlaceholders, mappingMatches } from "./customer-messaging-readiness.service";
import { customerMessagingRepository as repo } from "./customer-messaging.repository";
import { customerMessagingService } from "./customer-messaging.service";
import { conversationIntegrationService } from "../conversation-integration/conversation-integration.service";
import { channelsService } from "../channels/channels.service";
import { isSmsConfigured } from "../sms/sms.service";
import { whatsappSettingsService as settings } from "../whatsapp-templates/whatsapp-settings.service";
import { whatsappTemplatesRepository } from "../whatsapp-templates/whatsapp-templates.repository";
import { AppError } from "../../utils/error-handler";

const row = (id: string, autoTrigger: string, category: string, triggerDaysBefore: number | null, active = true) => ({ id, active, autoTrigger, category, triggerDaysBefore });
const ALL_ON = [
  row("a", "on_booking_create", "booking_confirmation", null),
  row("b", "on_pin_set", "portal_login", null),
  row("c", "days_before_departure", "balance_due", 14),
  row("d", "days_before_departure", "custom", 7),
];
const vars = (...sources: string[]) => Object.fromEntries(sources.map((s, i) => [String(i + 1), { source: s as "destination" }]));
const cfg = (name: string | null, variables = vars("client_first_name", "destination")) => ({ templateName: name, language: "en_GB", channelId: "ch1", variables });
const tpl = (name: string, body: string, over: Record<string, unknown> = {}) => ({ id: name, name, language: "en_GB", status: "APPROVED", body_text: body, header_text: null, ...over });
const find = (r: { purposes: { purpose: string }[] }, p: string) => r.purposes.find((x) => x.purpose === p);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(customerMessagingService.getAutoChannel).mockResolvedValue("whatsapp");
  vi.mocked(repo.listSwitchRows).mockResolvedValue(ALL_ON);
  vi.mocked(repo.isOrgActive).mockResolvedValue(true);
  vi.mocked(repo.isLogAvailable).mockResolvedValue(true);
  vi.mocked(settings.getPurposeTemplates).mockResolvedValue({
    booking_confirmation: cfg("a_tpl"), portal_ready: cfg("b_tpl", vars("client_first_name", "portal_link")), balance_reminder: cfg("c_tpl"), departure_reminder: cfg("d_tpl"),
  });
  vi.mocked(settings.getPinReset).mockResolvedValue({ templateName: "pin", templateLanguage: "en", channelId: "ch1", variables: {} });
  vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue({ baseUrl: "http://x", token: "t" });
  vi.mocked(channelsService.listChannels).mockResolvedValue([{ id: "ch1", channel_type: "whatsapp", is_active: true, is_verified: true }]);
  vi.mocked(whatsappTemplatesRepository.list).mockResolvedValue({
    total: 4,
    templates: [tpl("a_tpl", "Hi {{1}}, {{2}}"), tpl("b_tpl", "Hi {{1}} {{2}}"), tpl("c_tpl", "Hi {{1}} {{2}}"), tpl("d_tpl", "Hi {{1}} {{2}}")] as never,
  });
  vi.mocked(isSmsConfigured).mockReturnValue(true);
});

describe("readiness on WhatsApp", () => {
  it("everything switched on, connected, logged and with an approved, matching template is ready; five message types", async () => {
    const r = await svc.getReadiness("o1");
    expect(r.autoChannel).toBe("whatsapp");
    expect(r.purposes.map((p) => p.purpose)).toEqual(["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder", "portal_sign_in"]);
    expect(r.purposes.every((p) => p.ready && p.reason === null && p.switchedOn && p.channel === "whatsapp")).toBe(true);
  });

  it("fetches each WhatsApp number's template list once, however many cards use it", async () => {
    await svc.getReadiness("o1");
    expect(whatsappTemplatesRepository.list).toHaveBeenCalledTimes(1);
    expect(whatsappTemplatesRepository.list).toHaveBeenCalledWith({ channel_id: "ch1" });
  });

  it("a type with no template chosen is not being sent (no_template); the others stay ready", async () => {
    vi.mocked(settings.getPurposeTemplates).mockResolvedValue({ booking_confirmation: cfg(null), portal_ready: cfg("b_tpl", vars("client_first_name", "portal_link")) });
    const r = await svc.getReadiness("o1");
    expect(find(r, "booking_confirmation")).toMatchObject({ ready: false, reason: "no_template" });
    expect(find(r, "portal_ready")).toMatchObject({ ready: true });
  });

  it("a template that has since been deleted is not ready", async () => {
    vi.mocked(whatsappTemplatesRepository.list).mockResolvedValue({ total: 0, templates: [] });
    expect(find(await svc.getReadiness("o1"), "booking_confirmation")).toMatchObject({ ready: false, reason: "template_missing" });
  });

  it("a template that is no longer approved is not ready", async () => {
    vi.mocked(whatsappTemplatesRepository.list).mockResolvedValue({ total: 1, templates: [tpl("a_tpl", "Hi {{1}}, {{2}}", { status: "PAUSED" })] as never });
    expect(find(await svc.getReadiness("o1"), "booking_confirmation")).toMatchObject({ ready: false, reason: "template_not_approved" });
  });

  it("a template whose placeholders changed since the mapping was saved is not ready", async () => {
    vi.mocked(whatsappTemplatesRepository.list).mockResolvedValue({ total: 1, templates: [tpl("a_tpl", "Hi {{1}}, {{2}} and {{3}}")] as never });
    expect(find(await svc.getReadiness("o1"), "booking_confirmation")).toMatchObject({ ready: false, reason: "mapping_mismatch" });
  });

  it("the template list failing is 'unreachable', never a guess", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(whatsappTemplatesRepository.list).mockRejectedValue(new AppError("down", 502));
    expect(find(await svc.getReadiness("o1"), "booking_confirmation")).toMatchObject({ ready: false, reason: "unreachable" });
  });

  it("without the log table WhatsApp is not ready (it would send nothing): waiting for a database update", async () => {
    vi.mocked(repo.isLogAvailable).mockResolvedValue(false);
    const r = await svc.getReadiness("o1");
    for (const p of ["booking_confirmation", "portal_ready", "balance_reminder", "departure_reminder"]) expect(find(r, p)).toMatchObject({ ready: false, reason: "database_update_needed" });
  });

  it("a suspended agency is never ready, whatever else is set up", async () => {
    vi.mocked(repo.isOrgActive).mockResolvedValue(false);
    const r = await svc.getReadiness("o1");
    expect(r.purposes.every((p) => !p.ready && p.reason === "org_suspended")).toBe(true);
  });

  it("no templates at all (the column is not there yet) means no_template everywhere, never an error", async () => {
    vi.mocked(settings.getPurposeTemplates).mockResolvedValue({});
    const r = await svc.getReadiness("o1");
    expect(r.purposes.filter((p) => p.purpose !== "portal_sign_in").every((p) => p.reason === "no_template")).toBe(true);
  });

  it("not connected: every type reports it, before the template question", async () => {
    vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue(null);
    vi.mocked(settings.getPurposeTemplates).mockResolvedValue({});
    const r = await svc.getReadiness("o1");
    expect(r.purposes.every((p) => !p.ready && p.reason === "not_connected")).toBe(true);
    expect(channelsService.listChannels).not.toHaveBeenCalled();
  });

  it("no usable WhatsApp channel", async () => {
    vi.mocked(channelsService.listChannels).mockResolvedValue([{ id: "x", channel_type: "whatsapp", is_active: true, is_verified: false }]);
    expect((await svc.getReadiness("o1")).purposes.every((p) => p.reason === "no_channel")).toBe(true);
  });

  it("SendSeven unreachable is its own reason", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.mocked(channelsService.listChannels).mockRejectedValue(new AppError("down", 502));
    expect((await svc.getReadiness("o1")).purposes.every((p) => p.reason === "unreachable")).toBe(true);
  });

  it("a type whose SMS row is off or missing is switched off (the row is the switch on both channels), and says whether a row exists", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([ALL_ON[0], row("b", "on_pin_set", "portal_login", null, false)]);
    const r = await svc.getReadiness("o1");
    expect(find(r, "booking_confirmation")).toMatchObject({ switchedOn: true, hasSwitch: true, ready: true });
    expect(find(r, "portal_ready")).toMatchObject({ switchedOn: false, hasSwitch: true, ready: false, reason: "switched_off" });
    for (const p of ["balance_reminder", "departure_reminder"]) expect(find(r, p)).toMatchObject({ switchedOn: false, hasSwitch: false, reason: "switched_off" });
  });

  it("a balance_due row switches on balance reminders only; any other days-before row, departure reminders only", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([ALL_ON[2]]);
    let r = await svc.getReadiness("o1");
    expect(find(r, "balance_reminder")?.switchedOn).toBe(true);
    expect(find(r, "departure_reminder")?.switchedOn).toBe(false);
    vi.mocked(repo.listSwitchRows).mockResolvedValue([ALL_ON[3]]);
    r = await svc.getReadiness("o1");
    expect(find(r, "balance_reminder")?.switchedOn).toBe(false);
    expect(find(r, "departure_reminder")?.switchedOn).toBe(true);
  });

  it("the sign-in link is always on; without a template it is ready with a note (text still works inside the window)", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([]);
    vi.mocked(settings.getPinReset).mockResolvedValue({ templateName: null, templateLanguage: null, channelId: null, variables: {} });
    expect(find(await svc.getReadiness("o1"), "portal_sign_in")).toMatchObject({ switchedOn: true, ready: true, reason: null, note: "no_template_outside_window" });
  });

  it("the sign-in link is not ready when WhatsApp is not connected", async () => {
    vi.mocked(conversationIntegrationService.resolveConfig).mockResolvedValue(null);
    expect(find(await svc.getReadiness("o1"), "portal_sign_in")).toMatchObject({ ready: false, reason: "not_connected" });
  });

  it("a read error in the setting is not hidden: the request fails", async () => {
    vi.mocked(customerMessagingService.getAutoChannel).mockRejectedValue(new Error("unavailable"));
    await expect(svc.getReadiness("o1")).rejects.toThrow("unavailable");
  });
});

describe("readiness on SMS", () => {
  beforeEach(() => vi.mocked(customerMessagingService.getAutoChannel).mockResolvedValue("sms"));

  it("ready when the provider is configured and the type is switched on; WhatsApp and the log are never asked about", async () => {
    const r = await svc.getReadiness("o1");
    expect(r.autoChannel).toBe("sms");
    expect(r.purposes.every((p) => p.ready && p.channel === "sms")).toBe(true);
    expect(conversationIntegrationService.resolveConfig).not.toHaveBeenCalled();
    expect(repo.isLogAvailable).not.toHaveBeenCalled();
  });

  it("the SMS provider not being configured is the reason", async () => {
    vi.mocked(isSmsConfigured).mockReturnValue(false);
    const r = await svc.getReadiness("o1");
    expect(r.purposes.every((p) => !p.ready && p.reason === "sms_not_configured")).toBe(true);
  });

  it("switched-off types are still switched off; a suspended agency is not ready", async () => {
    vi.mocked(repo.listSwitchRows).mockResolvedValue([]);
    let r = await svc.getReadiness("o1");
    expect(find(r, "booking_confirmation")).toMatchObject({ ready: false, reason: "switched_off" });
    expect(find(r, "portal_sign_in")).toMatchObject({ ready: true });
    vi.mocked(repo.isOrgActive).mockResolvedValue(false);
    r = await svc.getReadiness("o1");
    expect(find(r, "portal_sign_in")).toMatchObject({ ready: false, reason: "org_suspended" });
  });
});

describe("placeholder matching", () => {
  it("reads the numbers a template declares, from header and body, once each, sorted", () => {
    expect(declaredPlaceholders({ header_text: "Hi {{ 2 }}", body_text: "{{1}} and {{2}} {{10}}" })).toEqual(["1", "2", "10"]);
    expect(declaredPlaceholders({ header_text: null, body_text: "no variables" })).toEqual([]);
  });

  it("the saved mapping must cover exactly those numbers", () => {
    const t = { header_text: null, body_text: "{{1}} {{2}}" };
    expect(mappingMatches(t, cfg("x", vars("client_first_name", "destination")))).toBe(true);
    expect(mappingMatches(t, cfg("x", vars("client_first_name")))).toBe(false);
    expect(mappingMatches(t, cfg("x", vars("client_first_name", "destination", "portal_link")))).toBe(false);
    expect(mappingMatches({ header_text: null, body_text: "plain" }, cfg("x", {}))).toBe(true);
  });
});
