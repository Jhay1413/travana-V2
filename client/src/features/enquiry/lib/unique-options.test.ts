import { describe, expect, it } from "vitest";
import { uniqueOptionsByLabel } from "./unique-options";

const opts = [
  { value: "ai", label: "All Inclusive" },
  { value: "hb1", label: "Half Board" },
  { value: "bb", label: "Bed and Breakfast" },
  { value: "hb2", label: "Half Board" },
];

describe("uniqueOptionsByLabel", () => {
  it("shows each name once, keeping the first and the original order", () => {
    expect(uniqueOptionsByLabel(opts).map((o) => o.value)).toEqual(["ai", "hb1", "bb"]);
  });

  it("keeps the selected duplicate so a saved choice still shows as chosen", () => {
    expect(uniqueOptionsByLabel(opts, ["hb2"]).map((o) => o.value)).toEqual(["ai", "hb2", "bb"]);
  });

  it("treats case and extra spaces as the same name", () => {
    const r = uniqueOptionsByLabel([{ value: "a", label: "Half Board" }, { value: "b", label: " half  board " }]);
    expect(r.map((o) => o.value)).toEqual(["a"]);
  });

  it("keeps the first when both duplicates are selected", () => {
    expect(uniqueOptionsByLabel(opts, ["hb1", "hb2"]).map((o) => o.value)).toEqual(["ai", "hb1", "bb"]);
  });
});
