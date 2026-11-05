import { describe, expect, it } from "vitest";
import { includedPackageResets } from "./extras-included-toggle";

describe("includedPackageResets", () => {
  it("never resets the cost, so it survives included -> not included toggles", () => {
    const paths = includedPackageResets("transfers.0", "op-1").map((r) => r.path);
    expect(paths).not.toContain("transfers.0.cost");
  });

  it("points the extra at the package operator and zeroes its commission", () => {
    expect(includedPackageResets("carHires.2", "op-1")).toEqual([
      { path: "carHires.2.tourOperatorId", value: "op-1" },
      { path: "carHires.2.commission", value: 0 },
      { path: "carHires.2.commissionManual", value: false },
    ]);
  });
});
