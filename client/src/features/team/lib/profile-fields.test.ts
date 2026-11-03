import { describe, expect, it } from "vitest";
import { makeMember } from "./member-fixtures";
import { draftFromMember, isProfileDirty, profilePatch, validateChanges, validateProfile } from "./profile-fields";

describe("profile-fields", () => {
  const member = makeMember({ firstName: "Sam", lastName: "Rivers", phoneNumber: "07700 900141" });

  it("starts the draft from the member, with blanks for missing values", () => {
    expect(draftFromMember(member)).toEqual({ first: "Sam", last: "Rivers", phone: "07700 900141" });
    expect(draftFromMember(makeMember({ firstName: null, lastName: null, phoneNumber: null }))).toEqual({ first: "", last: "", phone: "" });
  });

  it("requires names and a plausible phone", () => {
    expect(validateProfile({ first: "", last: " ", phone: "" })).toEqual({ first: "Enter a first name", last: "Enter a last name" });
    expect(validateProfile({ first: "A", last: "B", phone: "abc" }).phone).toBe("Enter a valid phone number");
    expect(validateProfile({ first: "A", last: "B", phone: "+44 (0)7700-900141" })).toEqual({});
    expect(validateProfile({ first: "A".repeat(61), last: "B", phone: "" }).first).toBe("That is too long");
  });

  it("builds a patch of changed fields only, trimmed", () => {
    expect(profilePatch(member, { first: " Samuel ", last: "Rivers", phone: "07700 900141" })).toEqual({ firstName: "Samuel" });
    expect(profilePatch(member, { first: "Sam", last: "Rivers", phone: "" })).toEqual({ phoneNumber: "" });
    expect(profilePatch(member, draftFromMember(member))).toEqual({});
  });

  it("detects unsaved edits", () => {
    expect(isProfileDirty(member, draftFromMember(member))).toBe(false);
    expect(isProfileDirty(member, { first: "Sam", last: "Rivers ", phone: "07700 900141" })).toBe(false);
    expect(isProfileDirty(member, { first: "Sammy", last: "Rivers", phone: "07700 900141" })).toBe(true);
  });
});

describe("validateChanges", () => {
  it("does not block a phone edit when the names were empty to begin with", () => {
    const m = makeMember({ firstName: null, lastName: null, phoneNumber: null });
    expect(validateChanges(m, { first: "", last: "", phone: "07700 900141" })).toEqual({});
  });

  it("still validates the fields being changed", () => {
    const m = makeMember({ firstName: null, lastName: null, phoneNumber: null });
    expect(validateChanges(m, { first: "", last: "", phone: "abc" })).toEqual({ phone: "Enter a valid phone number" });
    expect(validateChanges(m, { first: "A".repeat(61), last: "", phone: "" }).first).toBe("That is too long");
  });
});
