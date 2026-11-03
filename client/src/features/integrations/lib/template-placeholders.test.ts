import { describe, expect, it } from "vitest";
import { defaultMapping, messagePlaceholderProblem, previewSegments, renderPreview, resolveMappings } from "./template-placeholders";

describe("defaultMapping for update templates", () => {
  it("puts the client name first and the agent's message last", () => {
    expect(defaultMapping(0, 4, "update")).toEqual({ source: "client_first_name" });
    expect(defaultMapping(1, 4, "update")).toEqual({ source: "custom", text: "" });
    expect(defaultMapping(2, 4, "update")).toEqual({ source: "custom", text: "" });
    expect(defaultMapping(3, 4, "update")).toEqual({ source: "message" });
    expect(defaultMapping(1, 2, "update")).toEqual({ source: "message" });
  });

  it("gives a lone placeholder the message", () => {
    expect(defaultMapping(0, 1, "update")).toEqual({ source: "message" });
  });

  it("leaves quote defaults unchanged", () => {
    expect(defaultMapping(0, 1)).toEqual({ source: "client_first_name" });
    expect(defaultMapping(2, 3, "quote")).toEqual({ source: "quote_link" });
  });
});

describe("resolveMappings with a kind", () => {
  it("defaults unmapped update placeholders and keeps saved ones", () => {
    const m = resolveMappings(["1", "2", "3"], { "2": { source: "agent_name" } }, "update");
    expect(m).toEqual({
      "1": { source: "client_first_name" },
      "2": { source: "agent_name" },
      "3": { source: "message" },
    });
  });
});

describe("messagePlaceholderProblem", () => {
  it("is null with exactly one message row", () => {
    expect(messagePlaceholderProblem({ "1": { source: "client_first_name" }, "2": { source: "message" } })).toBeNull();
  });
  it("asks for one when there is none", () => {
    expect(messagePlaceholderProblem({ "1": { source: "client_first_name" } })).toMatch(/Pick one placeholder/);
    expect(messagePlaceholderProblem({})).toMatch(/Pick one placeholder/);
  });
  it("rejects two", () => {
    expect(messagePlaceholderProblem({ "1": { source: "message" }, "2": { source: "message" } })).toMatch(/Only one placeholder/);
  });
});

describe("preview with the message source", () => {
  const body = "Hi {{1}}, an update: {{2}}. Reply with questions.";
  const mappings = { "1": { source: "client_first_name" as const }, "2": { source: "message" as const } };

  it("renders the example message", () => {
    expect(renderPreview(body, mappings)).toBe("Hi Sam, an update: Your transfer is now at 10:30.. Reply with questions.");
  });
  it("marks the message as a highlighted value segment", () => {
    const seg = previewSegments(body, mappings).find((s) => s.text === "Your transfer is now at 10:30.");
    expect(seg?.kind).toBe("value");
  });
});
