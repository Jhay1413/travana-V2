import type {
  Branch,
  BranchInput,
  BranchOpeningHour,
  BranchOpeningPattern,
} from "@/features/organization/api/branch.api";

export const DAYS: Array<{ key: string; label: string; isWeekend: boolean }> = [
  { key: "Mon", label: "Monday",    isWeekend: false },
  { key: "Tue", label: "Tuesday",   isWeekend: false },
  { key: "Wed", label: "Wednesday", isWeekend: false },
  { key: "Thu", label: "Thursday",  isWeekend: false },
  { key: "Fri", label: "Friday",    isWeekend: false },
  { key: "Sat", label: "Saturday",  isWeekend: true  },
  { key: "Sun", label: "Sunday",    isWeekend: true  },
];

export const OPENING_PATTERNS: Array<{ value: BranchOpeningPattern; label: string }> = [
  { value: "mon-fri",    label: "Monday – Friday" },
  { value: "mon-sat",    label: "Monday – Saturday" },
  { value: "seven-days", label: "Open every day" },
];

export type BranchFormState = {
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  openingPattern: BranchOpeningPattern;
  bankHolidaysOpen: boolean;
  openingHours: BranchOpeningHour[];
  isDefault: boolean;
  isActive: boolean;
};

export function defaultHours(pattern: BranchOpeningPattern = "mon-fri"): BranchOpeningHour[] {
  return DAYS.map((d) => {
    const open =
      pattern === "seven-days" ? true :
      pattern === "mon-sat"    ? d.key !== "Sun" :
      !d.isWeekend;
    return { day: d.key, open, openTime: "09:00", closeTime: "17:30" };
  });
}

export function ensureSevenDays(hours: BranchOpeningHour[] | undefined): BranchOpeningHour[] {
  const map = new Map((hours ?? []).map((h) => [h.day, h]));
  return DAYS.map(
    (d) => map.get(d.key) ?? { day: d.key, open: !d.isWeekend, openTime: "09:00", closeTime: "17:30" },
  );
}

export function emptyBranchForm(): BranchFormState {
  return {
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    openingPattern: "mon-fri",
    bankHolidaysOpen: false,
    openingHours: defaultHours("mon-fri"),
    isDefault: false,
    isActive: true,
  };
}

export function branchToForm(b: Branch): BranchFormState {
  return {
    name: b.name,
    code: b.code ?? "",
    email: b.email ?? "",
    phone: b.phone ?? "",
    address: b.address ?? "",
    openingPattern: b.openingPattern ?? "mon-fri",
    bankHolidaysOpen: b.bankHolidaysOpen,
    openingHours: ensureSevenDays(b.openingHours),
    isDefault: b.isDefault,
    isActive: b.isActive,
  };
}

export function formToPayload(form: BranchFormState): BranchInput {
  return {
    name: form.name.trim(),
    code: form.code.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    address: form.address.trim() || null,
    openingPattern: form.openingPattern,
    bankHolidaysOpen: form.bankHolidaysOpen,
    openingHours: form.openingHours,
    isDefault: form.isDefault,
    isActive: form.isActive,
  };
}

export function applyOpeningPattern(form: BranchFormState, pattern: BranchOpeningPattern): BranchFormState {
  return {
    ...form,
    openingPattern: pattern,
    openingHours: form.openingHours.map((h, i) => {
      const day = DAYS[i];
      const shouldBeOpen =
        pattern === "seven-days" ? true :
        pattern === "mon-sat"    ? day.key !== "Sun" :
        !day.isWeekend;
      return { ...h, open: shouldBeOpen };
    }),
  };
}
