import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./portal-documents.repository", () => ({
  portalDocumentsRepository: { findVisibleFiles: vi.fn(), findLiveBookingsByDeal: vi.fn(), findDealIdsWithAnyBooking: vi.fn() },
}));
vi.mock("../client/client-file.service", () => ({
  PRESIGNED_URL_EXPIRES_IN: 300,
  clientFileService: { resolveDownloadTarget: vi.fn(), readObjectHead: vi.fn(), openObjectStream: vi.fn() },
}));

import { portalDocumentsService } from "./portal-documents.service";
import { portalDocumentsRepository as repo } from "./portal-documents.repository";
import { clientFileService } from "../client/client-file.service";
import { AppError } from "../../utils/error-handler";

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const FILE_ID = "33333333-3333-4333-8333-333333333333";

function file(over: Record<string, unknown> = {}) {
  return {
    id: "f1",
    clientId: "c1",
    filename: "client-files/k.pdf",
    title: null,
    originalName: "ticket.pdf",
    mimeType: "application/pdf",
    size: 100,
    category: null,
    createdAt: new Date("2026-11-20T10:00:00Z"),
    dealId: "d-enquiry",
    ...over,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.mocked(repo.findVisibleFiles).mockResolvedValue([]);
  vi.mocked(repo.findLiveBookingsByDeal).mockResolvedValue([]);
  vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue([]);
});

describe("list", () => {
  it("asks only for the session customer's visible files and returns the exact allowlisted shape", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ title: "Tickets", category: "tickets" })]);
    const docs = await portalDocumentsService.list("c1");
    expect(repo.findVisibleFiles).toHaveBeenCalledWith("c1", undefined);
    expect(docs).toEqual([
      { id: "f1", name: "Tickets", category: "Tickets", kind: "PDF", sizeBytes: 100, uploadedAt: "2026-11-20T10:00:00.000Z", viewable: true, viewKind: "pdf", dealId: "d-enquiry", bookingId: null },
    ]);
    expect(Object.keys(docs[0]).sort()).toEqual(["bookingId", "category", "dealId", "id", "kind", "name", "sizeBytes", "uploadedAt", "viewKind", "viewable"]);
  });

  it("uses the original file name when there is no title", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
    expect((await portalDocumentsService.list("c1"))[0].name).toBe("ticket.pdf");
  });

  it("a file on a deal with a live booking carries that booking, whatever record it was linked to; an enquiry or quote stage deal has none", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([
      file({ id: "on-booked-deal", dealId: "d-booked" }),
      file({ id: "on-enquiry", dealId: "d-enquiry" }),
    ]);
    vi.mocked(repo.findLiveBookingsByDeal).mockResolvedValue([{ dealId: "d-booked", bookingId: B1 }]);
    vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue(["d-booked"]);
    const docs = await portalDocumentsService.list("c1");
    expect(Object.fromEntries(docs.map((d) => [d.id, [d.dealId, d.bookingId]]))).toEqual({
      "on-booked-deal": ["d-booked", B1],
      "on-enquiry": ["d-enquiry", null],
    });
    expect(repo.findLiveBookingsByDeal).toHaveBeenCalledWith("c1", expect.arrayContaining(["d-booked", "d-enquiry"]));
  });

  it("hides a deal whose booking exists but is not live (lost or inactive)", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ id: "dead", dealId: "d-dead" }), file({ id: "alive", dealId: "d-alive" })]);
    vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue(["d-dead", "d-alive"]);
    vi.mocked(repo.findLiveBookingsByDeal).mockResolvedValue([{ dealId: "d-alive", bookingId: B1 }]);
    expect((await portalDocumentsService.list("c1")).map((d) => d.id)).toEqual(["alive"]);
  });

  it("nothing the join rejects (unlinked, placeholder ids, other customers, test deals) can appear: the list is only what the repository returns", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([]);
    expect(await portalDocumentsService.list("c1")).toEqual([]);
    expect(repo.findLiveBookingsByDeal).toHaveBeenCalledWith("c1", []);
  });

  it("the filter returns exactly the files of that booking's deal", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([
      file({ id: "on-booking", dealId: "d1" }),
      file({ id: "on-its-quote", dealId: "d1" }),
      file({ id: "other-deal", dealId: "d2" }),
    ]);
    vi.mocked(repo.findLiveBookingsByDeal).mockResolvedValue([{ dealId: "d1", bookingId: B1 }]);
    vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue(["d1"]);
    expect((await portalDocumentsService.list("c1", B1)).map((d) => d.id)).toEqual(["on-booking", "on-its-quote"]);
    expect(await portalDocumentsService.list("c1", B2)).toEqual([]);
  });
});

describe("getDownload", () => {
  const owned = file({ id: FILE_ID, originalName: 'a"b\r\n/c.pdf' });

  it("404 for an id that is not a uuid, without touching the database", async () => {
    await expect(portalDocumentsService.getDownload("c1", "not-an-id")).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    expect(repo.findVisibleFiles).not.toHaveBeenCalled();
  });

  it("404 when the file is not visible (another customer's, unknown, unlinked, placeholder id, test deal): asked for as the session customer", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([]);
    await expect(portalDocumentsService.getDownload("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    expect(repo.findVisibleFiles).toHaveBeenCalledWith("c1", FILE_ID);
    expect(clientFileService.resolveDownloadTarget).not.toHaveBeenCalled();
  });

  it("404 when the deal's booking is lost or inactive", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([owned]);
    vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue(["d-enquiry"]);
    await expect(portalDocumentsService.getDownload("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientFileService.resolveDownloadTarget).not.toHaveBeenCalled();
  });

  it("returns a 5-minute link with forced safe headers for cloud files", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([owned]);
    vi.mocked(clientFileService.resolveDownloadTarget).mockResolvedValue({ kind: "s3", url: "https://signed" });
    const out = await portalDocumentsService.getDownload("c1", FILE_ID);
    expect(out).toEqual({ kind: "link", url: "https://signed", fileName: "c.pdf", expiresInSeconds: 300 });
    const opts = vi.mocked(clientFileService.resolveDownloadTarget).mock.calls[0][1];
    expect(opts?.contentType).toBe("application/pdf");
    expect(opts?.contentDisposition).toMatch(/^attachment; filename="c\.pdf"/);
  });

  it("the audit log line holds only the client id and the file id, never the signed URL", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([owned]);
    vi.mocked(clientFileService.resolveDownloadTarget).mockResolvedValue({ kind: "s3", url: "https://signed.example/secret?X-Amz-Signature=abc" });
    await portalDocumentsService.getDownload("c1", FILE_ID);
    const lines = [...info.mock.calls, ...warn.mock.calls, ...log.mock.calls].map((c) => c.join(" "));
    expect(lines).toEqual([`[portal] document download client=c1 file=${FILE_ID}`]);
  });

  it("an unsafe stored mime type is served as octet-stream", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([{ ...owned, mimeType: "text/html", originalName: "page.html" }]);
    vi.mocked(clientFileService.resolveDownloadTarget).mockResolvedValue({ kind: "s3", url: "https://signed" });
    await portalDocumentsService.getDownload("c1", FILE_ID);
    expect(vi.mocked(clientFileService.resolveDownloadTarget).mock.calls[0][1]?.contentType).toBe("application/octet-stream");
  });

  it("streams a legacy disk file with the same safe headers", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([{ ...owned, mimeType: "image/svg+xml", originalName: "x.svg" }]);
    vi.mocked(clientFileService.resolveDownloadTarget).mockResolvedValue({ kind: "local", filePath: "/disk/x", originalName: "x.svg", mimeType: "image/svg+xml" });
    const out = await portalDocumentsService.getDownload("c1", FILE_ID);
    expect(out).toMatchObject({ kind: "stream", filePath: "/disk/x", fileName: "x.svg", contentType: "application/octet-stream" });
    expect(out.kind === "stream" && out.contentDisposition.startsWith("attachment;")).toBe(true);
  });

  it("a file missing from storage (or refused as outside the uploads directory) is the same 404", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([owned]);
    vi.mocked(clientFileService.resolveDownloadTarget).mockRejectedValue(new AppError("File not found on disk", 404));
    await expect(portalDocumentsService.getDownload("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
  });
});
