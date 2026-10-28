import { describe, it, expect } from "vitest";
import { AppError } from "../../utils/error-handler";
import { assertOrderTokens, buildMediaSlots, parseImageOrderField, parseOrderToken } from "./media-order";
import { scheduleMediaSchema } from "./social-post.validator";

const file = (name: string) => ({ originalname: name }) as Express.Multer.File;

describe("parseOrderToken", () => {
  it("parses the three token kinds", () => {
    expect(parseOrderToken("existing:12")).toEqual({ kind: "existing", id: 12 });
    expect(parseOrderToken("url:0")).toEqual({ kind: "url", index: 0 });
    expect(parseOrderToken("file:3")).toEqual({ kind: "file", index: 3 });
  });

  it("rejects anything else", () => {
    expect(parseOrderToken("url:-1")).toBeNull();
    expect(parseOrderToken("video:1")).toBeNull();
    expect(parseOrderToken("url:1x")).toBeNull();
  });
});

describe("parseImageOrderField", () => {
  it("returns undefined when absent or blank", () => {
    expect(parseImageOrderField(undefined)).toBeUndefined();
    expect(parseImageOrderField("  ")).toBeUndefined();
  });

  it("returns the tokens of a valid JSON array", () => {
    expect(parseImageOrderField('["url:1","existing:5"]')).toEqual(["url:1", "existing:5"]);
  });

  it("throws a 400 for malformed input", () => {
    expect(() => parseImageOrderField("nope")).toThrow(AppError);
    expect(() => parseImageOrderField('["bad"]')).toThrow(AppError);
    expect(() => parseImageOrderField('{"a":1}')).toThrow(AppError);
  });
});

describe("scheduleMediaSchema", () => {
  it("accepts a body without imageOrder and with a valid one", () => {
    expect(scheduleMediaSchema.safeParse({ body: { postSchedule: "x" } }).success).toBe(true);
    expect(scheduleMediaSchema.safeParse({ body: { imageOrder: '["file:0"]' } }).success).toBe(true);
  });

  it("rejects an invalid imageOrder", () => {
    expect(scheduleMediaSchema.safeParse({ body: { imageOrder: '["x:0"]' } }).success).toBe(false);
    expect(scheduleMediaSchema.safeParse({ body: { imageOrder: "{" } }).success).toBe(false);
  });
});

describe("assertOrderTokens", () => {
  const ctx = { existingIds: [7], fileCount: 1, urlCount: 2 };

  it("accepts a valid order", () => {
    expect(() => assertOrderTokens(["url:1", "file:0", "existing:7"], ctx)).not.toThrow();
  });

  it("rejects an unknown existing id, and out-of-range file/url indexes with 400", () => {
    for (const bad of ["existing:9", "file:1", "url:2", "bogus"]) {
      expect(() => assertOrderTokens([bad], ctx)).toThrow(AppError);
      try {
        assertOrderTokens([bad], ctx);
      } catch (e) {
        expect((e as AppError).statusCode).toBe(400);
      }
    }
  });
});

describe("buildMediaSlots", () => {
  const f0 = file("a.jpg");
  const f1 = file("b.jpg");
  const urls = ["https://q/1.jpg", "https://q/2.jpg"];
  const passthrough = { files: [f0, f1], imageUrls: urls };

  it("keeps the legacy order (existing, files, urls) when no order is sent", () => {
    const slots = buildMediaSlots({ existingImageIds: [7], inputFiles: [f0, f1], inputUrls: urls, prepared: passthrough });
    expect(slots).toEqual([
      { kind: "existing", id: 7 },
      { kind: "file", file: f0 },
      { kind: "file", file: f1 },
      { kind: "url", url: urls[0] },
      { kind: "url", url: urls[1] },
    ]);
  });

  it("follows the requested order across kinds", () => {
    const slots = buildMediaSlots({
      existingImageIds: [7],
      inputFiles: [f0, f1],
      inputUrls: urls,
      prepared: passthrough,
      order: ["url:1", "file:0", "existing:7", "url:0", "file:1"],
    });
    expect(slots).toEqual([
      { kind: "url", url: urls[1] },
      { kind: "file", file: f0 },
      { kind: "existing", id: 7 },
      { kind: "url", url: urls[0] },
      { kind: "file", file: f1 },
    ]);
  });

  it("appends items the order leaves out and ignores duplicates", () => {
    const slots = buildMediaSlots({
      existingImageIds: [7, 8],
      inputFiles: [],
      inputUrls: urls,
      prepared: { files: [], imageUrls: urls },
      order: ["url:1", "url:1"],
    });
    expect(slots).toEqual([
      { kind: "url", url: urls[1] },
      { kind: "existing", id: 7 },
      { kind: "existing", id: 8 },
      { kind: "url", url: urls[0] },
    ]);
  });

  it("maps a file that auto-upscale turned into a url to its position in the order", () => {
    // f0 was formatted: it is gone from prepared.files and its result leads prepared.imageUrls.
    const prepared = { files: [f1], imageUrls: ["https://s3/f0-up.jpg", "https://q/1-up.jpg", urls[1]] };
    const slots = buildMediaSlots({
      existingImageIds: [],
      inputFiles: [f0, f1],
      inputUrls: urls,
      prepared,
      order: ["url:0", "file:1", "file:0", "url:1"],
    });
    expect(slots).toEqual([
      { kind: "url", url: "https://q/1-up.jpg" },
      { kind: "file", file: f1 },
      { kind: "url", url: "https://s3/f0-up.jpg" },
      { kind: "url", url: urls[1] },
    ]);
  });

  it("rejects tokens that point at nothing", () => {
    const base = { existingImageIds: [7], inputFiles: [f0], inputUrls: urls, prepared: { files: [f0], imageUrls: urls } };
    expect(() => buildMediaSlots({ ...base, order: ["existing:99"] })).toThrow(AppError);
    expect(() => buildMediaSlots({ ...base, order: ["file:1"] })).toThrow(AppError);
    expect(() => buildMediaSlots({ ...base, order: ["url:2"] })).toThrow(AppError);
  });
});
