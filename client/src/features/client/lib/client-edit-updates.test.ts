import { describe, expect, it } from "vitest";
import { buildClientUpdates, type ClientEditValues } from "./client-edit-updates";

const form: ClientEditValues = {
  title: "Mr", firstName: "Jimmy", surename: "Buoy", phoneNumber: "07123 456789", email: "", DOB: "",
  houseNumber: "", street: "", city: "", country: "", post_code: "", badge: "Legacy Badge",
};

describe("buildClientUpdates", () => {
  it("leaves out an unchanged badge, so an older badge outside today's list never blocks the save", () => {
    const u = buildClientUpdates(form, { phoneNumber: "07123 456789", badge: "Legacy Badge" });
    expect(u).not.toHaveProperty("badge");
    expect(u).not.toHaveProperty("phoneNumber");
    expect(u).toMatchObject({ firstName: "Jimmy", email: null });
  });

  it("sends a changed badge, and clearing it sends null", () => {
    expect(buildClientUpdates({ ...form, badge: "VIP Client" }, { badge: "New Client" }).badge).toBe("VIP Client");
    expect(buildClientUpdates({ ...form, badge: "" }, { badge: "New Client" }).badge).toBeNull();
  });

  it("treats a missing stored badge and an empty form badge as unchanged", () => {
    expect(buildClientUpdates({ ...form, badge: "" }, { badge: null })).not.toHaveProperty("badge");
  });

  it("sends a changed phone trimmed", () => {
    expect(buildClientUpdates({ ...form, phoneNumber: " 07999 111222 " }, { phoneNumber: "07123456789" }).phoneNumber).toBe("07999 111222");
  });
});
