import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { smsRepository } from "./sms.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

const DELETED = '"client_table"."deleted_at" is null';

describe("deleted clients get no automatic texts", () => {
  it("findClientById (the fireAutoTriggerForClient lookup) hides deleted clients", async () => {
    setRows([]);
    await smsRepository.findClientById("c1");
    expect(renderWhere(0).text).toContain(DELETED);
  });
  it("findClientOrgId hides deleted clients", async () => {
    setRows([]);
    await smsRepository.findClientOrgId("c1");
    expect(renderWhere(0).text).toContain(DELETED);
  });
  it("findClientByIdInOrg and bulk recipients hide deleted clients", async () => {
    setRows([]);
    await smsRepository.findClientByIdInOrg("c1", "o1");
    await smsRepository.resolveRecipients({ mode: "all_optin", orgId: "o1" });
    expect(renderWhere(0).text).toContain(DELETED);
    expect(renderWhere(1).text).toContain(DELETED);
  });
});
