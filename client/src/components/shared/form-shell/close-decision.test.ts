import { describe, expect, it } from "vitest";
import { decideClose } from "./close-decision";

describe("decideClose", () => {
  it("closes a clean form", () => expect(decideClose({})).toBe("close"));
  it("closes when explicitly clean", () => expect(decideClose({ preventClose: false, isDirty: false })).toBe("close"));
  it("asks before closing a dirty form", () => expect(decideClose({ isDirty: true })).toBe("confirm"));
  it("ignores the request while saving, dirty or not", () => {
    expect(decideClose({ preventClose: true })).toBe("ignore");
    expect(decideClose({ preventClose: true, isDirty: true })).toBe("ignore");
  });
});
