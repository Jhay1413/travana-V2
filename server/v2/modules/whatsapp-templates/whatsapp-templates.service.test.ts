import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./whatsapp-templates.repository", () => ({
  whatsappTemplatesRepository: {
    isConfigured: vi.fn(),
    list: vi.fn(),
    sync: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
  },
}));

import { AppError } from "../../utils/error-handler";
import { whatsappTemplatesService } from "./whatsapp-templates.service";
import { whatsappTemplatesRepository as repo } from "./whatsapp-templates.repository";
import type { CreateTemplateInput } from "./whatsapp-templates.types";

const base: CreateTemplateInput = {
  channel_id: "c1",
  name: "order_update",
  category: "UTILITY",
  language: "en",
  body_text: "Hi {{1}}, order {{2}} shipped",
  body_examples: ["John", "12345"],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(repo.isConfigured).mockReturnValue(true);
  vi.mocked(repo.create).mockResolvedValue({ success: true, id: "i1", template_id: "t1", status: "PENDING" });
});

describe("whatsappTemplatesService.create", () => {
  it("builds header, body, footer and buttons", async () => {
    const buttons = [{ type: "URL" as const, text: "View", url: "https://example.com/{{1}}" }];
    const res = await whatsappTemplatesService.create({ ...base, header_text: "Order Update", footer_text: "Stop", buttons });
    expect(res).toEqual({ id: "i1", template_id: "t1", status: "PENDING" });
    expect(repo.create).toHaveBeenCalledWith({
      channel_id: "c1",
      name: "order_update",
      category: "UTILITY",
      language: "en",
      allow_category_change: true,
      components: [
        { type: "HEADER", format: "TEXT", text: "Order Update" },
        { type: "BODY", text: base.body_text, example: { body_text: [["John", "12345"]] } },
        { type: "FOOTER", text: "Stop" },
        { type: "BUTTONS", buttons },
      ],
    });
  });

  it("omits HEADER, FOOTER and BUTTONS when absent", async () => {
    await whatsappTemplatesService.create({ ...base, buttons: [] });
    const arg = vi.mocked(repo.create).mock.calls[0][0];
    expect(arg.components.map((c) => c.type)).toEqual(["BODY"]);
  });

  it("omits example when there are no placeholders", async () => {
    await whatsappTemplatesService.create({ ...base, body_text: "Hello", body_examples: [] });
    const arg = vi.mocked(repo.create).mock.calls[0][0];
    expect(arg.components[0]).toEqual({ type: "BODY", text: "Hello" });
  });

  it("maps success:false to a 400 using meta_user_message", async () => {
    vi.mocked(repo.create).mockResolvedValue({
      success: false,
      error: "raw",
      meta_message: "meta",
      meta_user_message: "Friendly reason",
    });
    const p = whatsappTemplatesService.create(base);
    await expect(p).rejects.toBeInstanceOf(AppError);
    await expect(p).rejects.toMatchObject({ statusCode: 400, message: "Friendly reason" });
  });

  it("falls back to a default rejection message", async () => {
    vi.mocked(repo.create).mockResolvedValue({ success: false });
    await expect(whatsappTemplatesService.create(base)).rejects.toMatchObject({
      statusCode: 400,
      message: "Meta rejected the template",
    });
  });

  it("503s when SendSeven isn't configured", async () => {
    vi.mocked(repo.isConfigured).mockReturnValue(false);
    await expect(whatsappTemplatesService.create(base)).rejects.toMatchObject({ statusCode: 503 });
    expect(repo.create).not.toHaveBeenCalled();
  });
});

describe("whatsappTemplatesService other operations", () => {
  it("sync passes channel_id through and returns the result", async () => {
    const r = { synced: 1, added: 1, updated: 0, removed: 0, errors: [] };
    vi.mocked(repo.sync).mockResolvedValue(r);
    expect(await whatsappTemplatesService.sync("c1")).toBe(r);
    expect(repo.sync).toHaveBeenCalledWith("c1");
  });

  it("list returns templates and total", async () => {
    vi.mocked(repo.list).mockResolvedValue({ templates: [], total: 0, channel_id: "c1" });
    expect(await whatsappTemplatesService.list({ channel_id: "c1" })).toEqual({ templates: [], total: 0 });
    expect(repo.list).toHaveBeenCalledWith({ channel_id: "c1" });
  });

  it("remove returns { removed: true }", async () => {
    vi.mocked(repo.remove).mockResolvedValue({});
    expect(await whatsappTemplatesService.remove("t1")).toEqual({ removed: true });
    expect(repo.remove).toHaveBeenCalledWith("t1");
  });
});
