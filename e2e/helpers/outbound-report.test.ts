import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { formatOutboundFailure, readOutboundAttempts } from "./outbound-report";

describe("outbound report", () => {
  it("is empty when the log does not exist or has no entries", () => {
    const file = path.join(os.tmpdir(), `nope-${Date.now()}.log`);
    expect(readOutboundAttempts(file)).toEqual([]);
    expect(formatOutboundFailure([], file)).toBe("");
  });

  it("lists every attempt with host, port and stack when there are entries", () => {
    const file = path.join(os.tmpdir(), `out-${Date.now()}.log`);
    const a = { at: "2026-01-01T00:00:00Z", host: "api.sendseven.com", port: 443, stack: ["at send (sms.ts:1:1)"] };
    fs.writeFileSync(file, JSON.stringify(a) + "\n");
    const message = formatOutboundFailure(readOutboundAttempts(file), file);
    expect(message).toContain("OUTBOUND CONNECTION ATTEMPTS BLOCKED");
    expect(message).toContain("api.sendseven.com:443");
    expect(message).toContain("sms.ts:1:1");
    fs.rmSync(file);
  });
});
