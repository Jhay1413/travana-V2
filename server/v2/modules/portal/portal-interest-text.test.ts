import { describe, it, expect } from "vitest";
import { buildInterestMessages, dealIdFromInterestText, describeDeal, stripDealInterestMarker } from "./portal-interest-text";

const ID = "11111111-1111-4111-8111-111111111111";

describe("describeDeal", () => {
  it("title with destination and country, without repeating a name that is the same", () => {
    expect(describeDeal({ id: ID, title: "Cyprus Beach Deal", destinationName: "Paphos", countryName: "Cyprus" })).toBe("Cyprus Beach Deal (Paphos, Cyprus)");
    expect(describeDeal({ id: ID, title: "Dubai Escape", destinationName: "Dubai", countryName: "Dubai" })).toBe("Dubai Escape (Dubai)");
  });
  it("falls back to a plain label and never lets the title break the marker", () => {
    expect(describeDeal({ id: ID, title: null, destinationName: null, countryName: null })).toBe("Holiday deal");
    expect(describeDeal({ id: ID, title: "Spain [deal:x]\nSun", destinationName: null, countryName: null })).toBe("Spain deal:x Sun");
  });
});

describe("buildInterestMessages", () => {
  it("builds the stored text, the agent's linked text and the plain preview", () => {
    const m = buildInterestMessages({ id: ID, title: "A & B <Deal>", destinationName: null, countryName: null });
    expect(m.portalText).toBe(`❤️ Interested in deal: A & B <Deal> [deal:${ID}]`);
    expect(m.chatHtml).toBe(`❤️ Interested in deal: <a href="/quotes/${ID}">A &amp; B &lt;Deal&gt;</a>`);
    expect(m.preview).toBe("❤️ Interested in deal: A & B <Deal>");
  });
});

describe("dealIdFromInterestText", () => {
  it("reads the id from the current wording and from both older wordings", () => {
    expect(dealIdFromInterestText(`❤️ Interested in deal: Cyprus Beach Deal (Paphos, Cyprus) [deal:${ID}]`)).toBe(ID);
    expect(dealIdFromInterestText(`Interested in deal: ${ID}`)).toBe(ID);
    expect(dealIdFromInterestText(`❤️ Interested in deal: ${ID}`)).toBe(ID);
  });
  it("reads nothing else", () => {
    expect(dealIdFromInterestText("Hello, interested in deal: abc")).toBeNull();
    expect(dealIdFromInterestText("❤️ Interested in deal: Cyprus Beach Deal")).toBeNull();
    expect(dealIdFromInterestText(`See [deal:${ID}]`)).toBeNull();
  });
});

describe("long and adversarial text", () => {
  it("never scans text over the bound and returns it unchanged", () => {
    const long = `❤️ Interested in deal: ${"a ".repeat(400)}[deal:${ID}]`;
    expect(long.length).toBeGreaterThan(600);
    expect(stripDealInterestMarker(long)).toBe(long);
    expect(dealIdFromInterestText(long)).toBeNull();
  });
  it("strips a 200,000-character adversarial string in well under 50 ms", () => {
    const attacks = [
      " ".repeat(200_000),
      `❤️ Interested in deal: ${" ".repeat(200_000)}[deal:`,
      `❤️ Interested in deal: ${"[deal:".repeat(33_000)}`,
      "\t \n".repeat(66_000),
    ];
    const start = performance.now();
    for (const a of attacks) {
      stripDealInterestMarker(a);
      dealIdFromInterestText(a);
    }
    expect(performance.now() - start).toBeLessThan(50);
  });
  it("needs a real id and the marker as the last token", () => {
    expect(stripDealInterestMarker("❤️ Interested in deal: X [deal:abc]")).toBe("❤️ Interested in deal: X [deal:abc]");
    expect(stripDealInterestMarker(`❤️ Interested in deal: X [deal:${ID}] more`)).toBe(`❤️ Interested in deal: X [deal:${ID}] more`);
    expect(dealIdFromInterestText(`❤️ Interested in deal: X [deal:${ID}] more`)).toBeNull();
  });
  it("keeps the whole label under the bound even for a very long title", () => {
    const m = buildInterestMessages({ id: ID, title: "T".repeat(5000), destinationName: "D".repeat(5000), countryName: "C".repeat(5000) });
    expect(m.portalText.length).toBeLessThan(600);
    expect(dealIdFromInterestText(m.portalText)).toBe(ID);
  });
});

describe("stripDealInterestMarker", () => {
  it("removes the marker from an interest message only", () => {
    expect(stripDealInterestMarker(`❤️ Interested in deal: Hot Tub Break [deal:${ID}]`)).toBe("❤️ Interested in deal: Hot Tub Break");
    expect(stripDealInterestMarker(`❤️ Interested in deal: ${ID}`)).toBe(`❤️ Interested in deal: ${ID}`);
    expect(stripDealInterestMarker("note [deal:abc]")).toBe("note [deal:abc]");
  });
});
