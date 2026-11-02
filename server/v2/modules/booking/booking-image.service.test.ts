import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./booking-image.repository", () => ({
  bookingImageRepository: {
    addImages: vi.fn(),
    getByBookingId: vi.fn(),
    getImageUrl: vi.fn(),
    deleteImage: vi.fn(),
    isUrlReferencedByBooking: vi.fn(),
    setPrimaryImage: vi.fn(),
    reorder: vi.fn(),
    reorderByUrl: vi.fn(),
  },
}));
vi.mock("../quote/quote-image.repository", () => ({
  quoteImageRepository: { isSharedGalleryImage: vi.fn(), isUrlReferenced: vi.fn() },
}));
vi.mock("./booking-access", () => ({ assertBookingReadable: vi.fn(), assertBookingWritable: vi.fn() }));
vi.mock("../../utils/image-storage", async () => {
  const actual = await vi.importActual<typeof import("../../utils/image-storage")>("../../utils/image-storage");
  return { ...actual, deleteImageByStoredUrl: vi.fn(), uploadImageToS3: vi.fn() };
});

import { bookingImageService } from "./booking-image.service";
import { bookingImageRepository } from "./booking-image.repository";
import { quoteImageRepository } from "../quote/quote-image.repository";
import { assertBookingReadable, assertBookingWritable } from "./booking-access";
import { deleteImageByStoredUrl, uploadImageToS3 } from "../../utils/image-storage";
import { AppError } from "../../utils/error-handler";

const SCOPE = { orgId: "org1", orgRole: "agent" } as never;
const OWN_PROXY = "/api/v2/files/img?key=booking-images%2F1-a.jpg";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(assertBookingWritable).mockResolvedValue(undefined);
  vi.mocked(assertBookingReadable).mockResolvedValue(undefined);
  vi.mocked(deleteImageByStoredUrl).mockResolvedValue(undefined);
  vi.mocked(bookingImageRepository.isUrlReferencedByBooking).mockResolvedValue(false);
  vi.mocked(quoteImageRepository.isUrlReferenced).mockResolvedValue(false);
});

describe("bookingImageService scope", () => {
  const writes: Array<[string, () => Promise<unknown>]> = [
    ["addImages", () => bookingImageService.addImages("b1", ["https://x.test/a.jpg"], SCOPE)],
    ["deleteImage", () => bookingImageService.deleteImage("b1", "i1", SCOPE)],
    ["setPrimaryImage", () => bookingImageService.setPrimaryImage("b1", "i1", SCOPE)],
    ["reorderImages", () => bookingImageService.reorderImages("b1", { imageIds: ["i1"] }, SCOPE)],
    ["uploadFiles", () => bookingImageService.uploadFiles("b1", [{ originalname: "a.jpg" } as never], SCOPE)],
  ];

  for (const [name, call] of writes) {
    it(`${name} checks the shop-pinned write scope first and writes nothing when it refuses`, async () => {
      vi.mocked(assertBookingWritable).mockRejectedValue(new AppError("This deal belongs to another shop", 403));
      await expect(call()).rejects.toMatchObject({ statusCode: 403 });
      expect(assertBookingWritable).toHaveBeenCalledWith("b1", SCOPE);
      expect(bookingImageRepository.addImages).not.toHaveBeenCalled();
      expect(bookingImageRepository.deleteImage).not.toHaveBeenCalled();
      expect(bookingImageRepository.setPrimaryImage).not.toHaveBeenCalled();
      expect(uploadImageToS3).not.toHaveBeenCalled();
    });
  }

  it("listing uses the record (read) scope", async () => {
    vi.mocked(bookingImageRepository.getByBookingId).mockResolvedValue([] as never);
    await bookingImageService.getBookingImages("b1", SCOPE);
    expect(assertBookingReadable).toHaveBeenCalledWith("b1", SCOPE);
    expect(assertBookingWritable).not.toHaveBeenCalled();
  });
});

describe("bookingImageService.addImages url validation", () => {
  it("keeps the app's own images and http(s) links and drops a proxy url for a private key", async () => {
    vi.mocked(bookingImageRepository.addImages).mockResolvedValue([] as never);
    await bookingImageService.addImages("b1", [OWN_PROXY, "https://x.test/a.jpg", "/api/v2/files/img?key=ticket-attachments%2F1.pdf"], SCOPE);
    expect(bookingImageRepository.addImages).toHaveBeenCalledWith("b1", [OWN_PROXY, "https://x.test/a.jpg"]);
  });
});

describe("bookingImageService.deleteImage", () => {
  it("refuses (400) a shared hotel gallery image and deletes nothing", async () => {
    vi.mocked(bookingImageRepository.getImageUrl).mockResolvedValue(null);
    vi.mocked(quoteImageRepository.isSharedGalleryImage).mockResolvedValue(true);
    await expect(bookingImageService.deleteImage("b1", "master-1", SCOPE)).rejects.toMatchObject({ statusCode: 400 });
    expect(bookingImageRepository.deleteImage).not.toHaveBeenCalled();
    expect(deleteImageByStoredUrl).not.toHaveBeenCalled();
  });

  it("removes the S3 object only when no booking, quote or library row still references the url", async () => {
    vi.mocked(bookingImageRepository.getImageUrl).mockResolvedValue(OWN_PROXY);
    await bookingImageService.deleteImage("b1", "i1", SCOPE);
    expect(deleteImageByStoredUrl).toHaveBeenCalledWith(OWN_PROXY);
  });

  it("keeps the S3 object when the converted quote still shares the url", async () => {
    vi.mocked(bookingImageRepository.getImageUrl).mockResolvedValue(OWN_PROXY);
    vi.mocked(quoteImageRepository.isUrlReferenced).mockResolvedValue(true);
    await bookingImageService.deleteImage("b1", "i1", SCOPE);
    expect(bookingImageRepository.deleteImage).toHaveBeenCalledWith("b1", "i1");
    expect(deleteImageByStoredUrl).not.toHaveBeenCalled();
  });

  it("keeps the S3 object when another booking row still points at it", async () => {
    vi.mocked(bookingImageRepository.getImageUrl).mockResolvedValue(OWN_PROXY);
    vi.mocked(bookingImageRepository.isUrlReferencedByBooking).mockResolvedValue(true);
    await bookingImageService.deleteImage("b1", "i1", SCOPE);
    expect(deleteImageByStoredUrl).not.toHaveBeenCalled();
  });
});
