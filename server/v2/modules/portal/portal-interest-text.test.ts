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

describe("stripDealInterestMarker", () => {
  it("removes the marker from an interest message only", () => {
    expect(stripDealInterestMarker(`❤️ Interested in deal: Hot Tub Break [deal:${ID}]`)).toBe("❤️ Interested in deal: Hot Tub Break");
    expect(stripDealInterestMarker(`❤️ Interested in deal: ${ID}`)).toBe(`❤️ Interested in deal: ${ID}`);
    expect(stripDealInterestMarker("note [deal:abc]")).toBe("note [deal:abc]");
  });
});
