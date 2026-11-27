import { describe, it, expect, vi, beforeEach } from "vitest";
import { Readable } from "node:stream";

vi.mock("./portal-documents.repository", () => ({
  portalDocumentsRepository: { findVisibleFiles: vi.fn(), findLiveBookingsByDeal: vi.fn(), findDealIdsWithAnyBooking: vi.fn() },
}));
vi.mock("../client/client-file.service", () => ({
  PRESIGNED_URL_EXPIRES_IN: 300,
  clientFileService: { resolveDownloadTarget: vi.fn(), readObjectHead: vi.fn(), openObjectStream: vi.fn() },
}));

import { MAX_VIEW_BYTES, portalDocumentsService } from "./portal-documents.service";
import { portalDocumentsRepository as repo } from "./portal-documents.repository";
import { clientFileService } from "../client/client-file.service";
import { AppError } from "../../utils/error-handler";

const FILE_ID = "33333333-3333-4333-8333-333333333333";
const PDF_HEAD = Buffer.from("%PDF-1.7\n");

function file(over: Record<string, unknown> = {}) {
  return {
    id: FILE_ID,
    clientId: "c1",
    filename: "client-files/k.pdf",
    title: null,
    originalName: 'a"b\r\n/c.pdf',
    mimeType: "application/pdf",
    size: 1000,
    category: null,
    createdAt: new Date("2026-11-20T10:00:00Z"),
    dealId: "d-enquiry",
    ...over,
  };
}

const makeStream = () => Readable.from([PDF_HEAD]);

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => undefined);
  vi.mocked(repo.findVisibleFiles).mockResolvedValue([]);
  vi.mocked(repo.findLiveBookingsByDeal).mockResolvedValue([]);
  vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue([]);
});

function openOk(head: Buffer = PDF_HEAD, size = 1000) {
  vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
  vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head, size });
  const stream = makeStream();
  vi.mocked(clientFileService.openObjectStream).mockResolvedValue({ stream, size });
  return stream;
}

describe("getView", () => {
  it("404 for an id that is not a uuid, without touching the database or storage", async () => {
    await expect(portalDocumentsService.getView("c1", "nope")).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    expect(repo.findVisibleFiles).not.toHaveBeenCalled();
    expect(clientFileService.readObjectHead).not.toHaveBeenCalled();
  });

  it("the same 404 when nothing is visible (other customer's, unknown, unlinked), asked for as the session customer", async () => {
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    expect(repo.findVisibleFiles).toHaveBeenCalledWith("c1", FILE_ID);
    expect(clientFileService.readObjectHead).not.toHaveBeenCalled();
    expect(clientFileService.openObjectStream).not.toHaveBeenCalled();
  });

  it("404 when the deal's booking is lost or inactive", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
    vi.mocked(repo.findDealIdsWithAnyBooking).mockResolvedValue(["d-enquiry"]);
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404 });
    expect(clientFileService.readObjectHead).not.toHaveBeenCalled();
  });

  it("returns the stream with the exact safe type for the kind and a sanitised name", async () => {
    const stream = openOk();
    const out = await portalDocumentsService.getView("c1", FILE_ID);
    expect(out).toEqual({ stream, contentType: "application/pdf", fileName: "c.pdf", size: 1000 });
  });

  it("never uses the stored mime type verbatim: only the exact type for that kind", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ originalName: "p.png", mimeType: "Image/PNG; charset=x" })]);
    vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), size: 50 });
    vi.mocked(clientFileService.openObjectStream).mockResolvedValue({ stream: makeStream(), size: 50 });
    expect((await portalDocumentsService.getView("c1", FILE_ID)).contentType).toBe("image/png");
  });

  it("415 for a type the viewer cannot show, before any bytes are read", async () => {
    const cases: Array<[string, string]> = [
      ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "t.docx"],
      ["application/pdf", "t.docx"],
      ["image/heic", "t.heic"],
      ["text/html", "t.html"],
    ];
    for (const [mimeType, originalName] of cases) {
      vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ mimeType, originalName })]);
      await expect(portalDocumentsService.getView("c1", FILE_ID), originalName).rejects.toMatchObject({ statusCode: 415 });
    }
    expect(clientFileService.readObjectHead).not.toHaveBeenCalled();
    expect(clientFileService.openObjectStream).not.toHaveBeenCalled();
  });

  it("415 when the first bytes are not the claimed kind, and nothing is opened", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
    vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head: Buffer.from("<html><script>"), size: 14 });
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 415 });
    expect(clientFileService.openObjectStream).not.toHaveBeenCalled();
  });

  it("413 over the size ceiling, by the recorded size and by the real stored size", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ size: MAX_VIEW_BYTES + 1 })]);
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({
      statusCode: 413,
      message: "This file is too large to preview. Please download it.",
    });
    expect(clientFileService.readObjectHead).not.toHaveBeenCalled();

    // A recorded size that understates the stored object is caught by the real size.
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
    vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head: PDF_HEAD, size: MAX_VIEW_BYTES + 1 });
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 413 });
    expect(clientFileService.openObjectStream).not.toHaveBeenCalled();
  });

  it("a file at exactly the ceiling is allowed", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file({ size: MAX_VIEW_BYTES })]);
    vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head: PDF_HEAD, size: MAX_VIEW_BYTES });
    vi.mocked(clientFileService.openObjectStream).mockResolvedValue({ stream: makeStream(), size: MAX_VIEW_BYTES });
    await expect(portalDocumentsService.getView("c1", FILE_ID)).resolves.toMatchObject({ size: MAX_VIEW_BYTES });
  });

  it("a file missing from storage, or refused as outside the uploads directory, is the same 404", async () => {
    vi.mocked(repo.findVisibleFiles).mockResolvedValue([file()]);
    vi.mocked(clientFileService.readObjectHead).mockRejectedValue(new AppError("File not found on disk", 404));
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
    vi.mocked(clientFileService.readObjectHead).mockResolvedValue({ head: PDF_HEAD, size: 10 });
    vi.mocked(clientFileService.openObjectStream).mockRejectedValue(new AppError("File not found", 404));
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toMatchObject({ statusCode: 404, message: "Document not found" });
  });

  it("passes the abort signal to the upstream read", async () => {
    openOk();
    const abort = new AbortController();
    await portalDocumentsService.getView("c1", FILE_ID, abort.signal);
    expect(clientFileService.openObjectStream).toHaveBeenCalledWith(expect.objectContaining({ id: FILE_ID }), abort.signal);
  });

  it("the audit line holds only the client id and the file id: no name, no URL", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    openOk();
    await portalDocumentsService.getView("c1", FILE_ID);
    const lines = [...info.mock.calls, ...warn.mock.calls, ...log.mock.calls].map((c) => c.join(" "));
    expect(lines).toEqual([`[portal] document view client=c1 file=${FILE_ID}`]);
  });

  it("refused views leave no audit line", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    await expect(portalDocumentsService.getView("c1", FILE_ID)).rejects.toBeInstanceOf(AppError);
    expect(info).not.toHaveBeenCalled();
  });
});
