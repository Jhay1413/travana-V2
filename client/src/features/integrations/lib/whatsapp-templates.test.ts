import { describe, expect, it } from "vitest";
import { apiErrorMessage, connectedWhatsappChannels } from "./whatsapp-channels";
import {
  bodyProblem,
  defaultMapping,
  extractPlaceholders,
  mappingsComplete,
  placeholderGaps,
  renderPreview,
  resolveMappings,
} from "./template-placeholders";
import { nameProblem, requestProblem, toRequestInput, type TemplateRequestForm } from "./template-request";
import { templateStatus, truncateBody } from "./template-status";

describe("templateStatus", () => {
  it("maps statuses to tones", () => {
    expect(templateStatus("APPROVED").tone).toBe("good");
    expect(templateStatus("PENDING").tone).toBe("warn");
    expect(templateStatus("REJECTED").tone).toBe("bad");
    expect(templateStatus("PAUSED").tone).toBe("plain");
    expect(templateStatus("DISABLED").tone).toBe("plain");
    expect(templateStatus("WEIRD")).toEqual({ label: "WEIRD", tone: "plain" });
  });
  it("truncates long bodies", () => {
    expect(truncateBody("short")).toBe("short");
    expect(truncateBody("a".repeat(150)).length).toBe(100);
    expect(truncateBody("a".repeat(150)).endsWith("…")).toBe(true);
  });
});

describe("placeholders", () => {
  it("extracts in order, deduped", () => {
    expect(extractPlaceholders("Hi {{1}}, {{2}} and {{1}} {{ 3 }}")).toEqual(["1", "2", "3"]);
    expect(extractPlaceholders("no vars")).toEqual([]);
  });
  it("detects gaps", () => {
    expect(placeholderGaps(["1", "2"])).toEqual([]);
    expect(placeholderGaps(["1", "3"])).toEqual(["2"]);
    expect(placeholderGaps(["2"])).toEqual(["1"]);
    expect(placeholderGaps([])).toEqual([]);
  });
  it("flags body problems", () => {
    expect(bodyProblem("Hi {{1}}, see {{2}} now")).toBeNull();
    expect(bodyProblem("")).toMatch(/required/);
    expect(bodyProblem("Hi {{1}}{{2}} there")).toMatch(/next to each other/);
    expect(bodyProblem("{{1}} hello")).toMatch(/start or end/);
    expect(bodyProblem("Hi {{1}} and {{3}} bye")).toMatch(/Missing \{\{2\}\}/);
  });
  it("defaults mappings", () => {
    expect(defaultMapping(0, 1)).toEqual({ source: "client_first_name" });
    expect(defaultMapping(1, 2)).toEqual({ source: "quote_link" });
    expect(defaultMapping(1, 3)).toEqual({ source: "custom", text: "" });
    expect(defaultMapping(2, 3)).toEqual({ source: "quote_link" });
  });
  it("keeps saved mappings and fills the rest", () => {
    const m = resolveMappings(["1", "2"], { "1": { source: "agent_name" } });
    expect(m["1"].source).toBe("agent_name");
    expect(m["2"].source).toBe("quote_link");
  });
  it("requires text on custom rows", () => {
    expect(mappingsComplete({ "1": { source: "custom", text: " " } })).toBe(false);
    expect(mappingsComplete({ "1": { source: "custom", text: "x" }, "2": { source: "quote_link" } })).toBe(true);
  });
  it("renders a preview", () => {
    expect(
      renderPreview("Hi {{1}}, {{2}} via {{3}}", { "1": { source: "client_first_name" }, "2": { source: "custom", text: "Your quote" }, "3": { source: "quote_link" } }),
    ).toBe("Hi Sam, Your quote via https://…/q/abc");
  });
});

const form = (over: Partial<TemplateRequestForm> = {}): TemplateRequestForm => ({
  name: "quote_link",
  category: "UTILITY",
  language: "en",
  header: "",
  body: "Hi {{1}}, your quote: {{2}} Thanks",
  examples: { "1": "Sam", "2": "https://x.co/q" },
  footer: "",
  buttonKind: "none",
  buttonText: "",
  buttonUrl: "",
  ...over,
});

describe("template request", () => {
  it("validates the name", () => {
    expect(nameProblem("ok_name1")).toBeNull();
    expect(nameProblem("Bad Name")).toMatch(/lowercase/);
  });
  it("accepts a valid form", () => {
    expect(requestProblem(form())).toBeNull();
  });
  it("requires examples", () => {
    expect(requestProblem(form({ examples: { "1": "Sam" } }))).toMatch(/example for \{\{2\}\}/);
  });
  it("enforces limits and buttons", () => {
    expect(requestProblem(form({ header: "x".repeat(61) }))).toMatch(/Header/);
    expect(requestProblem(form({ buttonKind: "URL", buttonText: "Open", buttonUrl: "nope" }))).toMatch(/URL/);
    expect(requestProblem(form({ buttonKind: "QUICK_REPLY", buttonText: "x".repeat(26) }))).toMatch(/25/);
  });
  it("builds the payload", () => {
    const out = toRequestInput("c1", form({ buttonKind: "URL", buttonText: "Open", buttonUrl: "https://a.co" }));
    expect(out.body_examples).toEqual(["Sam", "https://x.co/q"]);
    expect(out.buttons).toEqual([{ type: "URL", text: "Open", url: "https://a.co" }]);
    expect(out.header_text).toBeUndefined();
  });
});

describe("channels and errors", () => {
  const ch = (id: string, type: string, active = true) => ({
    id,
    channel_type: type,
    name: id,
    is_active: active,
    activation_status: null,
    setup_pending_reason: null,
  });
  it("keeps only connected whatsapp channels", () => {
    const list = connectedWhatsappChannels([ch("a", "whatsapp"), ch("b", "instagram"), ch("c", "whatsapp", false)]);
    expect(list.map((c) => c.id)).toEqual(["a"]);
  });
  it("reads server messages", () => {
    expect(apiErrorMessage({ response: { data: { message: "Meta says no" } }, message: "x" })).toBe("Meta says no");
    expect(apiErrorMessage(new Error("boom"))).toBe("boom");
    expect(apiErrorMessage(null, "fb")).toBe("fb");
  });
});
