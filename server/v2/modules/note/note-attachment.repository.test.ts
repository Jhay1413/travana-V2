import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { noteAttachmentRepository } from "./note-attachment.repository";
import { resetCapture, renderWhere, renderOrderBy } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("noteAttachmentRepository.findByClientId", () => {
  it("filters on the note's client_id only when deals are excluded", async () => {
    await noteAttachmentRepository.findByClientId("c1", false);
    const where = renderWhere(0);
    expect(where.text).toContain('"notes"."client_id" = $1');
    expect(where.text).not.toContain("IN (SELECT");
    expect(where.params).toEqual(["c1"]);
  });

  it("also matches notes on the client's transactions when deals are included", async () => {
    await noteAttachmentRepository.findByClientId("c1", true);
    const where = renderWhere(0);
    expect(where.text).toContain('"notes"."client_id" = $1');
    expect(where.text).toContain('"notes"."transaction_id" IN (SELECT');
    expect(where.params).toEqual(["c1", "c1"]);
  });

  it("orders oldest first", async () => {
    await noteAttachmentRepository.findByClientId("c1", false);
    expect(renderOrderBy(0)).toContain("asc");
  });
});
