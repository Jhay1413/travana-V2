import { describe, expect, it } from "vitest";
import type { TourOperatorBreakdownRow } from "@/features/organization/api/organization-overview.api";
import { rankSuppliers, supplierBarWidth, supplierInitials } from "./supplier-math";

function row(id: string, bookings: number, commission: number): TourOperatorBreakdownRow {
  return { id, name: id, bookings, commission, revenue: 0 };
}

describe("supplier-math", () => {
  const rows = [row("a", 2, 640), row("b", 9, 1330), row("c", 2, 231), row("d", 1, 568)];

  it("ranks by commission", () => {
    expect(rankSuppliers(rows, "commission").map((r) => r.id)).toEqual(["b", "a", "d", "c"]);
  });

  it("ranks by bookings and breaks ties on commission", () => {
    expect(rankSuppliers(rows, "bookings").map((r) => r.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("keeps only the top ten", () => {
    const many = Array.from({ length: 14 }, (_, i) => row(`s${i}`, i, i * 10));
    expect(rankSuppliers(many, "commission")).toHaveLength(10);
  });

  it("builds initials", () => {
    expect(supplierInitials("Jet2holidays")).toBe("JE");
    expect(supplierInitials("EasyJet Holidays")).toBe("EH");
    expect(supplierInitials("  ")).toBe("?");
  });

  it("scales bars to the top value", () => {
    expect(supplierBarWidth(665, 1330)).toBe(50);
    expect(supplierBarWidth(1, 0)).toBe(0);
  });
});
