import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { dashboardRepository } from "./dashboard.repository";
import { renderWhere, resetCapture, setRows } from "../../test/capture-db";

beforeEach(() => resetCapture());

describe("client counts exclude soft-deleted clients", () => {
  it("dashboard total clients (org and platform-wide)", async () => {
    setRows([{ count: "0" }]);
    await dashboardRepository.getStats("o1").catch(() => undefined);
    resetCapture();
    setRows([{ count: "0" }]);
    await dashboardRepository.getStats(null).catch(() => undefined);
    expect(renderWhere(0).text).toContain('"client_table"."deleted_at" is null');
  });
});
