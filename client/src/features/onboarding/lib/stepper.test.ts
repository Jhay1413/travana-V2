import { describe, expect, it } from "vitest";
import { reviewOrigin, stepTarget, stepperFor } from "./stepper";

describe("stepperFor", () => {
  it("single shop has three steps", () => {
    expect(stepperFor("single", "business")).toEqual({ steps: ["Business details", "Invite team", "Done"], current: 0 });
    expect(stepperFor(null, "agents-review").current).toBe(1);
    expect(stepperFor("single", "done").current).toBe(2);
  });
  it("multi shop has four steps", () => {
    expect(stepperFor("multi", "shops").steps).toEqual(["Head office", "Shops", "Team", "Done"]);
    expect(stepperFor("multi", "shops").current).toBe(1);
    expect(stepperFor("multi", "team-review").current).toBe(2);
    expect(stepperFor("multi", "done").current).toBe(3);
  });
});

describe("stepTarget and reviewOrigin", () => {
  it("maps finished circles to screens", () => {
    expect(stepTarget(false, 0)).toBe("business");
    expect(stepTarget(false, 1)).toBe("agents");
    expect(stepTarget(true, 1)).toBe("shops");
    expect(stepTarget(true, 2)).toBe("team");
    expect(stepTarget(true, 3)).toBeNull();
  });
  it("maps review screens to their origin", () => {
    expect(reviewOrigin("shops-review")).toBe("shops");
    expect(reviewOrigin("agents")).toBe("agents");
  });
});
