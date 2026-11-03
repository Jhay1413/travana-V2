import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../client/client-file.service", () => ({
  clientFileService: { listByClientId: vi.fn(), getDownloadTarget: vi.fn() },
}));
vi.mock("../ticket/ticket.service", () => ({ ticketService: {} }));
vi.mock("../task/task.service", () => ({ taskService: {} }));
vi.mock("../internal-chat/internal-chat-clients.repository", () => ({ internalChatClientsRepository: {} }));

import { adminDataService } from "./admin-data.service";
import { clientFileService } from "../client/client-file.service";

beforeEach(() => vi.clearAllMocks());

describe("adminDataService file access (org-scoped system context)", () => {
  it("lists files under the org's system scope", async () => {
    vi.mocked(clientFileService.listByClientId).mockResolvedValue([
      { id: "f1", title: "T", category: null, originalName: "a.pdf", createdAt: new Date() },
    ] as never);
    const files = await adminDataService.getFiles("org1", "c1");
    expect(files).toHaveLength(1);
    expect(vi.mocked(clientFileService.listByClientId).mock.calls[0][1]).toMatchObject({ orgId: "org1" });
  });

  it("returns a link only for a file the client owns, inline", async () => {
    vi.mocked(clientFileService.listByClientId).mockResolvedValue([{ id: "f1" }] as never);
    vi.mocked(clientFileService.getDownloadTarget).mockResolvedValue({ kind: "s3", url: "https://u" });
    expect(await adminDataService.getFileLink("org1", "c1", "f1")).toBe("https://u");
    const call = vi.mocked(clientFileService.getDownloadTarget).mock.calls[0];
    expect(call[1]).toMatchObject({ orgId: "org1" });
    expect(call[2]).toEqual({ inline: true });
    expect(await adminDataService.getFileLink("org1", "c1", "other")).toBeNull();
  });
});
