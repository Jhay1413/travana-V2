import { describe, expect, it } from "vitest";
import { resolveImportedTransferType } from "./quote-form.types";

describe("resolveImportedTransferType", () => {
  it("forces Self-drive for lodge imports even when the scrape says Private Transfer", () => {
    expect(
      resolveImportedTransferType({ isLodge: true, tourOperator: "hoseasons", scrapedTransferType: "Private Transfer" }),
    ).toBe("Self-drive");
  });

  it("forces Shared Transfer for TUI imports", () => {
    expect(
      resolveImportedTransferType({ isLodge: false, tourOperator: "tui", scrapedTransferType: "None" }),
    ).toBe("Shared Transfer");
    expect(
      resolveImportedTransferType({ isLodge: false, tourOperator: "tui holidays", scrapedTransferType: "Private Transfer" }),
    ).toBe("Shared Transfer");
  });

  it("normalizes the scraped value for other operators", () => {
    expect(
      resolveImportedTransferType({ isLodge: false, tourOperator: "jet2", scrapedTransferType: "private transfer" }),
    ).toBe("Private Transfer");
  });

  it("falls back to None for unknown values", () => {
    expect(
      resolveImportedTransferType({ isLodge: false, tourOperator: "jet2", scrapedTransferType: "Transfer included" }),
    ).toBe("None");
  });
});
