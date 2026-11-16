import { describe, expect, it } from "vitest";
import { withImageContainer } from "./image-container-patch";

describe("withImageContainer", () => {
  const config = {
    auth: { type: "none" },
    priceApi: { idParam: "WebsiteID" },
    extraction: { version: 1, fields: { pets: { from: "text" } }, imageContainerIncludes: ["lodge-gallery", { match: "park-gallery", max: 5 }] },
  };

  it("replaces only the image container rule and keeps everything else", () => {
    const out = withImageContainer(config, "slick-slide");
    expect(out.extraction).toEqual({ version: 1, fields: { pets: { from: "text" } }, imageContainerIncludes: "slick-slide" });
    expect(out.auth).toEqual({ type: "none" });
    expect(out.priceApi).toEqual({ idParam: "WebsiteID" });
  });

  it("does not mutate the original config", () => {
    withImageContainer(config, "slick-slide");
    expect(config.extraction.imageContainerIncludes).toEqual(["lodge-gallery", { match: "park-gallery", max: 5 }]);
  });

  it("creates the extraction block when missing and removes the key on undefined", () => {
    expect(withImageContainer(null, "slick-slide")).toEqual({ extraction: { imageContainerIncludes: "slick-slide" } });
    expect(withImageContainer(config, undefined).extraction).toEqual({ version: 1, fields: { pets: { from: "text" } } });
  });
});
