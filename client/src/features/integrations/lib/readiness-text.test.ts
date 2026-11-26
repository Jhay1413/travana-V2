import { describe, expect, it } from "vitest";
import { readinessReasonText, readinessTone } from "./readiness-text";
import type { PurposeReadiness } from "../types";

const base: PurposeReadiness = { purpose: "booking_confirmation", switchedOn: true, hasSwitch: true, channel: "whatsapp", ready: true, reason: null };

describe("readinessTone", () => {
  it("is green when ready, red when switched on but not going out, grey when switched off, none while loading", () => {
    expect(readinessTone(base)).toBe("ready");
    expect(readinessTone({ ...base, ready: false, reason: "no_template" })).toBe("not_sent");
    expect(readinessTone({ ...base, ready: false, reason: "not_connected" })).toBe("not_sent");
    expect(readinessTone({ ...base, switchedOn: false, ready: false, reason: "switched_off" })).toBe("off");
    expect(readinessTone(undefined)).toBeNull();
  });
});

describe("readinessReasonText", () => {
  it("has plain words for every reason", () => {
    for (const r of ["switched_off", "not_connected", "no_channel", "no_template", "sms_not_configured", "unreachable", "org_suspended", "database_update_needed", "template_missing", "template_not_approved", "mapping_mismatch"] as const) {
      expect(readinessReasonText(r).length).toBeGreaterThan(3);
    }
    expect(readinessReasonText("no_template")).toBe("no template chosen");
    expect(readinessReasonText("template_not_approved")).toBe("template no longer approved");
    expect(readinessReasonText("database_update_needed")).toBe("waiting for a database update");
  });
});
