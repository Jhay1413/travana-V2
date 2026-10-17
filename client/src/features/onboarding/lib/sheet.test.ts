import { describe, expect, it } from "vitest";
import { csvToTable, matchShop, tableToPeople, tableToShops } from "./sheet";

const shops = [{ id: "b1", name: "Hetton" }];

describe("tableToPeople", () => {
  it("reads headers, maps roles and blank role to Agent", () => {
    const table = csvToTable(
      "First name,Last name,Email,Role\nAl,Tay,al@x.co,Shop Manager\nBo,Ray,bo@x.co,\nCy,Lee,cy@x.co,Wizard",
    );
    const rows = tableToPeople(table, { withShop: false, shops: [] });
    expect(rows.map((r) => r.role)).toEqual(["Branch Manager", "Agent", "Wizard"]);
    expect(rows[0]).toMatchObject({ firstName: "Al", lastName: "Tay", email: "al@x.co" });
  });
  it("falls back to column order without headers", () => {
    const rows = tableToPeople([["Al", "Tay", "al@x.co", "Hetton", "Agent"]], { withShop: true, shops });
    expect(rows[0]).toMatchObject({ email: "al@x.co", shop: "b1", role: "Agent" });
  });
  it("matches shops by name, Homeworker, and keeps unknown text", () => {
    expect(matchShop("hetton", shops)).toBe("b1");
    expect(matchShop("Homeworker", shops)).toBe("homeworker");
    expect(matchShop("Nowhere", shops)).toBe("Nowhere");
    expect(matchShop("", shops)).toBe("");
  });
  it("treats a Homeworker role with no shop as a homeworker", () => {
    const rows = tableToPeople(
      [
        ["First name", "Last name", "Email", "Shop", "Role"],
        ["A", "B", "a@x.co", "", "Homeworker"],
      ],
      { withShop: true, shops },
    );
    expect(rows[0]?.shop).toBe("homeworker");
  });
});

describe("single-shop uploads", () => {
  it("flags a Homeworker shop value so validation can reject it", () => {
    const table = csvToTable("First name,Last name,Email,Shop,Role\nAl,Tay,al@x.co,Homeworker,Agent");
    const [row] = tableToPeople(table, { withShop: false, shops: [] });
    expect(row?.shop).toBe("homeworker");
  });
  it("keeps unknown role text so it becomes a row error", () => {
    const rows = tableToPeople(csvToTable("First name,Last name,Email,Role\nA,B,a@x.co,Sales Manager"), {
      withShop: false,
      shops: [],
    });
    expect(rows[0]?.role).toBe("Sales Manager");
  });
});

describe("tableToShops and csvToTable", () => {
  it("reads shop columns", () => {
    const rows = tableToShops(
      csvToTable("Shop name,Address,Email,Phone,Manager email\nHetton,1 St,h@x.co,0191 000 0001,m@x.co"),
    );
    expect(rows[0]).toMatchObject({ name: "Hetton", managerEmail: "m@x.co", phone: "0191 000 0001" });
  });
  it("parses tab separated paste and rejects empty files", () => {
    expect(csvToTable("a\tb\tc")[0]).toEqual(["a", "b", "c"]);
    expect(() => csvToTable("")).toThrow();
  });
});
