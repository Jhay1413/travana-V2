import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  store.set("portal_token", "tok-123");
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("sessionStorage", { removeItem: () => undefined, getItem: () => null, setItem: () => undefined });
  vi.stubGlobal("window", { location: { href: "" } });
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => "blob:x", revokeObjectURL: () => undefined }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

import { downloadDocument, portalDocumentKeys } from "./use-portal-documents";

function reply(status: number, headers: Record<string, string>, body: unknown): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });
}

describe("downloadDocument", () => {
  it("asks the server with the portal token, then starts the download from the short-lived link", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply(200, { "content-type": "application/json" }, { url: "https://signed", fileName: "a.pdf", expiresInSeconds: 300 }));
    vi.stubGlobal("fetch", fetchMock);
    const start = vi.fn();
    await downloadDocument("doc 1", "fallback", start);
    expect(fetchMock).toHaveBeenCalledWith("/api/v2/portal/documents/doc%201/download", { headers: { Authorization: "Bearer tok-123" } });
    expect(start).toHaveBeenCalledWith("https://signed", "a.pdf");
  });

  it("a streamed file is saved from a blob under the name in Content-Disposition", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(200, { "content-type": "application/pdf", "content-disposition": `attachment; filename="x.pdf"; filename*=UTF-8''R%C3%A9.pdf` }, "PDFDATA")),
    );
    const start = vi.fn();
    await downloadDocument("d", "fallback", start);
    expect(start).toHaveBeenCalledWith("blob:x", "Ré.pdf");
  });

  it("404 is a plain sentence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(404, { "content-type": "application/json" }, { error: "Document not found" })));
    await expect(downloadDocument("d")).rejects.toThrow("That document is no longer available.");
  });

  it("other failures use the server's message, or a plain default", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(429, {}, { error: "Too many downloads in a short time." })));
    await expect(downloadDocument("d")).rejects.toThrow("Too many downloads in a short time.");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(500, {}, "not json")));
    await expect(downloadDocument("d")).rejects.toThrow("We couldn't download that document. Please try again.");
  });

  it("a network failure is a plain sentence", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(downloadDocument("d")).rejects.toThrow("We couldn't download that document. Please try again.");
  });

  it("401 clears the session and sends the customer to sign in", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(401, {}, { error: "Unauthorized" })));
    await expect(downloadDocument("d")).rejects.toThrow("Session expired");
    expect(store.has("portal_token")).toBe(false);
    expect((window as unknown as { location: { href: string } }).location.href).toBe("/portal/login");
  });
});

describe("portalDocumentKeys", () => {
  it("sits under the portal namespace so sign-out clears it", () => {
    expect(portalDocumentKeys.list()[0]).toBe("portal");
    expect(portalDocumentKeys.list("b1")).toEqual(["portal", "documents", "b1"]);
  });
});
