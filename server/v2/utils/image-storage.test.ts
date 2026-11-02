import { describe, it, expect, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("../config/s3", () => ({ s3Client: { send }, S3_BUCKET: "bucket" }));

import {
  PUBLIC_IMAGE_KEY_PREFIXES,
  DEAL_IMAGE_KEY_PREFIXES,
  dealImageKeyFromStoredUrl,
  deleteImageByStoredUrl,
  isPublicImageKey,
  s3KeyFromStoredUrl,
  isAcceptableImageUrl,
  normalizeAcceptableImageUrls,
  partitionAcceptableImageUrls,
  UNUSABLE_IMAGE_LABEL,
  buildImageProxyUrl,
} from "./image-storage";

describe("public image key allow-list", () => {
  it("lists exactly the prefixes the app stores public images under", () => {
    expect([...DEAL_IMAGE_KEY_PREFIXES]).toEqual(["quote-images/", "booking-images/", "hub-images/", "social-upscale/", "image-upscale/"]);
    expect([...PUBLIC_IMAGE_KEY_PREFIXES]).toEqual([
      "quote-images/", "booking-images/", "hub-images/", "social-upscale/", "image-upscale/",
      "tour-operator-logos/", "training-assets/", "training-thumbnails/", "training-videos/",
    ]);
  });

  it("accepts keys under those prefixes, including the upscaler's source copies", () => {
    for (const key of ["quote-images/1-a.jpg", "booking-images/1-a.png", "hub-images/x.webp", "social-upscale/r.png", "social-upscale/source/s.jpg", "image-upscale/r.png", "image-upscale/source/s.jpg", "tour-operator-logos/1-a.png", "training-assets/1-a.jpg", "training-thumbnails/1-a.jpg", "training-videos/1-a.mp4"]) {
      expect(isPublicImageKey(key), key).toBe(true);
    }
  });

  it("refuses private prefixes, traversal and junk", () => {
    for (const key of ["client-files/1.pdf", "note-attachments/1.pdf", "ticket-attachments/1.pdf", "hr/doc.pdf", "invoices/1.pdf", "training/v.mp4", "training-videos/", "tour-operator-logos/../hr/doc.pdf", "/quote-images/1.jpg", "quote-images/../client-files/1.pdf", "quote-images/", "", "quote-images\\1.jpg"]) {
      expect(isPublicImageKey(key), key).toBe(false);
    }
    expect(isPublicImageKey(undefined)).toBe(false);
    expect(isPublicImageKey(["quote-images/1.jpg"])).toBe(false);
  });
});

describe("s3KeyFromStoredUrl", () => {
  it("returns the key for any proxy url, so logo and training cleanup find their own objects", () => {
    for (const key of ["quote-images/1-a.jpg", "tour-operator-logos/1-a.png", "training-videos/1-a.mp4", "training-assets/1.jpg"]) {
      expect(s3KeyFromStoredUrl(buildImageProxyUrl(key)), key).toBe(key);
    }
  });

  it("returns null for other urls, traversal and malformed encodings", () => {
    expect(s3KeyFromStoredUrl("https://x.test/a.jpg")).toBeNull();
    expect(s3KeyFromStoredUrl("/api/v2/files/img?key=%E0%A4%A")).toBeNull();
    expect(s3KeyFromStoredUrl(buildImageProxyUrl("quote-images/../hr/doc.pdf"))).toBeNull();
  });
});

describe("dealImageKeyFromStoredUrl / deleteImageByStoredUrl", () => {
  it("only yields deal image keys, never private files, logos or training media", () => {
    expect(dealImageKeyFromStoredUrl(buildImageProxyUrl("quote-images/1-a.jpg"))).toBe("quote-images/1-a.jpg");
    for (const key of ["client-files/1.pdf", "hr/doc.pdf", "note-attachments/1.pdf", "tour-operator-logos/1.png", "training-videos/1.mp4"]) {
      expect(dealImageKeyFromStoredUrl(buildImageProxyUrl(key)), key).toBeNull();
    }
  });

  it("deletes a deal image by default, refuses a logo unless its own prefix is passed", async () => {
    send.mockReset();
    await deleteImageByStoredUrl(buildImageProxyUrl("quote-images/1-a.jpg"));
    expect(send).toHaveBeenCalledTimes(1);
    send.mockClear();
    await deleteImageByStoredUrl(buildImageProxyUrl("tour-operator-logos/1.png"));
    await deleteImageByStoredUrl(buildImageProxyUrl("client-files/1.pdf"), ["tour-operator-logos/"]);
    expect(send).not.toHaveBeenCalled();
    await deleteImageByStoredUrl(buildImageProxyUrl("tour-operator-logos/1.png"), ["tour-operator-logos/"]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("isAcceptableImageUrl / normalizeAcceptableImageUrls", () => {
  it("accepts inline images, the app's uploads and avatars, own proxy urls and http(s) links", () => {
    for (const url of ["data:image/png;base64,AAAA", "/uploads/a.jpg", "/avatars/a.jpg", buildImageProxyUrl("hub-images/a.jpg"), "https://cdn.test/a.jpg", "http://cdn.test/a.jpg"]) {
      expect(isAcceptableImageUrl(url), url).toBe(true);
    }
  });

  it("refuses scripts, files, private proxy keys and non-strings", () => {
    for (const url of ["javascript:alert(1)", "file:///etc/passwd", "ftp://x/a.jpg", buildImageProxyUrl("client-files/1.pdf"), "not a url", ""]) {
      expect(isAcceptableImageUrl(url), url).toBe(false);
    }
    expect(isAcceptableImageUrl(42)).toBe(false);
  });

  it("normalize trims, de-duplicates and 400s on an unacceptable image", () => {
    expect(normalizeAcceptableImageUrls([" https://x.test/a.jpg ", "https://x.test/a.jpg", ""])).toEqual(["https://x.test/a.jpg"]);
    expect(normalizeAcceptableImageUrls(undefined)).toEqual([]);
    expect(() => normalizeAcceptableImageUrls([buildImageProxyUrl("hr/doc.pdf")])).toThrowError(/Images must be/);
  });
});

describe("partitionAcceptableImageUrls", () => {
  it("keeps the good strings in order and reports the rest instead of throwing", () => {
    const privateProxy = buildImageProxyUrl("client-files/1.pdf");
    const result = partitionAcceptableImageUrls([
      " https://cdn.test/a.jpg ", null, "//cdn.test/b.jpg", "www.cdn.test/c.jpg", privateProxy, "javascript:alert(1)",
      "https://cdn.test/a.jpg", "", "   ", 42, buildImageProxyUrl("hub-images/ok.jpg"),
    ]);
    expect(result.accepted).toEqual(["https://cdn.test/a.jpg", buildImageProxyUrl("hub-images/ok.jpg")]);
    expect(result.dropped).toEqual([UNUSABLE_IMAGE_LABEL, "//cdn.test/b.jpg", "www.cdn.test/c.jpg", privateProxy, "javascript:alert(1)", UNUSABLE_IMAGE_LABEL]);
  });

  it("a proxy url for a non-public key is dropped, never accepted", () => {
    const { accepted, dropped } = partitionAcceptableImageUrls([buildImageProxyUrl("hr/doc.pdf"), buildImageProxyUrl("client-files/x.png")]);
    expect(accepted).toEqual([]);
    expect(dropped).toHaveLength(2);
  });

  it("is empty for a non-array", () => {
    expect(partitionAcceptableImageUrls(undefined)).toEqual({ accepted: [], dropped: [] });
  });
});
