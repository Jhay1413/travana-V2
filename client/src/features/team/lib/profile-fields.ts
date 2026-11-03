import type { OrgMember } from "@/features/organization/api/organization.api";
import type { MemberProfilePatch } from "../types";

export interface ProfileDraft {
  first: string;
  last: string;
  phone: string;
}

export type ProfileErrors = Partial<Record<keyof ProfileDraft, string>>;

const PHONE_RE = /^[+()\d\s-]{7,20}$/;
const MAX_NAME = 60;

export function draftFromMember(m: OrgMember): ProfileDraft {
  return {
    first: m.user.firstName ?? "",
    last: m.user.lastName ?? "",
    phone: m.user.phoneNumber ?? "",
  };
}

/** Mirrors the server's profile validator: names 1-60 characters, phone empty or 7-20 phone characters. */
export function validateProfile(d: ProfileDraft): ProfileErrors {
  const e: ProfileErrors = {};
  const first = d.first.trim();
  const last = d.last.trim();
  const phone = d.phone.trim();
  if (!first) e.first = "Enter a first name";
  else if (first.length > MAX_NAME) e.first = "That is too long";
  if (!last) e.last = "Enter a last name";
  else if (last.length > MAX_NAME) e.last = "That is too long";
  if (phone !== "" && !PHONE_RE.test(phone)) e.phone = "Enter a valid phone number";
  return e;
}

/** Which draft fields differ from the member's saved values. */
export function changedFields(m: OrgMember, d: ProfileDraft): Array<keyof ProfileDraft> {
  const before = draftFromMember(m);
  return (Object.keys(d) as Array<keyof ProfileDraft>).filter((k) => d[k].trim() !== before[k].trim());
}

/** Validates only what is being saved, so a phone edit is not blocked by names that were empty to begin with. */
export function validateChanges(m: OrgMember, d: ProfileDraft): ProfileErrors {
  const all = validateProfile(d);
  const out: ProfileErrors = {};
  for (const k of changedFields(m, d)) if (all[k]) out[k] = all[k];
  return out;
}

/** Only the fields that changed, trimmed. Empty when nothing changed. */
export function profilePatch(m: OrgMember, d: ProfileDraft): MemberProfilePatch {
  const before = draftFromMember(m);
  const patch: MemberProfilePatch = {};
  if (d.first.trim() !== before.first.trim()) patch.firstName = d.first.trim();
  if (d.last.trim() !== before.last.trim()) patch.lastName = d.last.trim();
  if (d.phone.trim() !== before.phone.trim()) patch.phoneNumber = d.phone.trim();
  return patch;
}

export function isProfileDirty(m: OrgMember, d: ProfileDraft): boolean {
  return Object.keys(profilePatch(m, d)).length > 0;
}
