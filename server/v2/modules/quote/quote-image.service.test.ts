import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./quote-image.repository", () => ({
  quoteImageRepository: {
    addImages: vi.fn(),
    getByQuoteId: vi.fn(),
    getImageUrl: vi.fn(),
    isSharedGalleryImage: vi.fn(),
    deleteImage: vi.fn(),
    isUrlReferenced: vi.fn(),
    setPrimaryImage: vi.fn(),
    reorder: vi.fn(),
    reorderByUrl: vi.fn(),
    replaceImageUrl: vi.fn(),
  },
}));
vi.mock("./quote-access", () => ({ assertQuoteReadable: vi.fn(), assertQuoteWritable: vi.fn() }));
vi.mock("../../utils/image-storage", async () => {
  const actual = await vi.importActual<typeof import("../../utils/image-storage")>("../../utils/image-storage");
  return { ...actual, deleteImageByStoredUrl: vi.fn(), uploadImageToS3: vi.fn(), getPresignedPutUrl: vi.fn() };
});

import { quoteImageService } from "./quote-image.service";
import { quoteImageRepository } from "./quote-image.repository";
import { assertQuoteReadable, assertQuoteWritable } from "./quote-access";
import { deleteImageByStoredUrl, uploadImageToS3 } from "../../utils/image-storage";
import { AppError } from "../../utils/error-handler";

const SCOPE = { orgId: "org1", orgRole: "agent" } as never;
const OWN_PROXY = "/api/v2/files/img?key=quote-images%2F1-a.jpg";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertQuoteWritable).mockResolvedValue(undefined);
  vi.mocked(assertQuoteReadable).mockResolvedValue(undefined);
  vi.mocked(deleteImageByStoredUrl).mockResolvedValue(undefined);
  vi.mocked(quoteImageRepository.isUrlReferenced).mockResolvedValue(false);
});

describe("quoteImageService scope", () => {
  const writes: Array<[string, () => Promise<unknown>]> = [
    ["addImages", () => quoteImageService.addImages("q1", ["https://x.test/a.jpg"], SCOPE)],
    ["deleteImage", () => quoteImageService.deleteImage("q1", "i1", SCOPE)],
    ["setPrimaryImage", () => quoteImageService.setPrimaryImage("q1", "i1", SCOPE)],
    ["reorderImages", () => quoteImageService.reorderImages("q1", { imageIds: ["i1"] }, SCOPE)],
    ["uploadFiles", () => quoteImageService.uploadFiles("q1", [{ originalname: "a.jpg" } as never], SCOPE)],
  ];

  for (const [name, call] of writes) {
    it(`${name} checks the shop-pinned write scope first and writes nothing when it refuses`, async () => {
      vi.mocked(assertQuoteWritable).mockRejectedValue(new AppError("This deal belongs to another shop", 403));
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
      expect(assertQuoteWritable).toHaveBeenCalledWith("q1", SCOPE);
      expect(quoteImageRepository.addImages).not.toHaveBeenCalled();
      expect(quoteImageRepository.deleteImage).not.toHaveBeenCalled();
      expect(quoteImageRepository.setPrimaryImage).not.toHaveBeenCalled();
      expect(quoteImageRepository.reorder).not.toHaveBeenCalled();
      expect(uploadImageToS3).not.toHaveBeenCalled();
    });
  }

  it("listing uses the record (read) scope", async () => {
    vi.mocked(quoteImageRepository.getByQuoteId).mockResolvedValue([] as never);
    await quoteImageService.getQuoteImages("q1", SCOPE);
    expect(assertQuoteReadable).toHaveBeenCalledWith("q1", SCOPE);
    expect(assertQuoteWritable).not.toHaveBeenCalled();
  });

  it("a read refusal returns nothing", async () => {
    vi.mocked(assertQuoteReadable).mockRejectedValue(new AppError("Quote not found", 404));
    await expect(quoteImageService.getQuoteImages("q1", SCOPE)).rejects.toMatchObject({ statusCode: 404 });
    expect(quoteImageRepository.getByQuoteId).not.toHaveBeenCalled();
  });
});

describe("quoteImageService.addImages url validation", () => {
  it("keeps the app's own images and http(s) links and drops a proxy url for a private key", async () => {
    vi.mocked(quoteImageRepository.addImages).mockResolvedValue([] as never);
    await quoteImageService.addImages("q1", [OWN_PROXY, "https://x.test/a.jpg", "/api/v2/files/img?key=client-files%2F1.pdf", "javascript:alert(1)"], SCOPE);
    expect(quoteImageRepository.addImages).toHaveBeenCalledWith("q1", [OWN_PROXY, "https://x.test/a.jpg"]);
  });

  it("400s when nothing valid is left", async () => {
    await expect(quoteImageService.addImages("q1", ["/api/v2/files/img?key=hr-documents%2Fx.pdf"], SCOPE)).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("quoteImageService.deleteImage and the shared hotel gallery", () => {
  it("refuses (400) to delete a shared accommodation / lodge gallery image and deletes nothing", async () => {
    vi.mocked(quoteImageRepository.getImageUrl).mockResolvedValue(null);
    vi.mocked(quoteImageRepository.isSharedGalleryImage).mockResolvedValue(true);
    await expect(quoteImageService.deleteImage("q1", "master-1", SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(quoteImageRepository.deleteImage).not.toHaveBeenCalled();
    expect(deleteImageByStoredUrl).not.toHaveBeenCalled();
  });

  it("deletes the quote's own image and removes the S3 object when nothing else references the url", async () => {
    vi.mocked(quoteImageRepository.getImageUrl).mockResolvedValue(OWN_PROXY);
    await quoteImageService.deleteImage("q1", "i1", SCOPE);
    expect(quoteImageRepository.deleteImage).toHaveBeenCalledWith("q1", "i1");
    expect(deleteImageByStoredUrl).toHaveBeenCalledWith(OWN_PROXY);
  });

  it("keeps the S3 object while another row still points at the url", async () => {
    vi.mocked(quoteImageRepository.getImageUrl).mockResolvedValue(OWN_PROXY);
    vi.mocked(quoteImageRepository.isUrlReferenced).mockResolvedValue(true);
    await quoteImageService.deleteImage("q1", "i1", SCOPE);
    expect(deleteImageByStoredUrl).not.toHaveBeenCalled();
  });

  it("removeOwnedImage (used by the quote edit form) skips a shared gallery image instead of failing the save", async () => {
    vi.mocked(quoteImageRepository.getImageUrl).mockResolvedValue(null);
    vi.mocked(quoteImageRepository.isSharedGalleryImage).mockResolvedValue(true);
    await expect(quoteImageService.removeOwnedImage("q1", "master-1")).resolves.toBe("shared");
    expect(quoteImageRepository.deleteImage).not.toHaveBeenCalled();
  });
});
