import { describe, expect, it } from "vitest";
import { FONTS_HREF } from "./portal-fonts";

describe("portal fonts", () => {
  const url = new URL(FONTS_HREF);
  const families = url.searchParams.getAll("family");

  it("requests exactly the reference's two families", () => {
    expect(families).toEqual(["Cormorant Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400", "Jost:wght@300;400;500"]);
  });

  it("asks for no extra weights (no 600, no italic 500)", () => {
    expect(FONTS_HREF).not.toMatch(/600|1,500/);
  });
});
