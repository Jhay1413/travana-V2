// The test runner compiles JSX with the classic transform, which needs React in scope.
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BookingPayments } from "./BookingPayments";

(globalThis as { React?: typeof React }).React = React;

const render = (enabled: boolean, agent = "Sam") => renderToStaticMarkup(createElement(BookingPayments, { enabled, agent, onAsk: () => undefined }));

describe("BookingPayments (placeholder behind VITE_PORTAL_PAYMENTS)", () => {
  it("renders nothing at all when the flag is off", () => {
    expect(render(false)).toBe("");
  });

  it("when on, says the agent will confirm the balance and dates, with a message button and no figures", () => {
    const html = render(true);
    expect(html).toContain("Sam will confirm your balance and payment dates with you.");
    expect(html).toContain("Message Sam");
    expect(html).not.toMatch(/£|%|progress|remind/i);
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/\d/);
  });

  it("falls back to 'your agent' when no agent is named", () => {
    const html = render(true, "your agent");
    expect(html).toContain("Your agent will confirm");
    expect(html).toContain("Message your agent");
  });
});
