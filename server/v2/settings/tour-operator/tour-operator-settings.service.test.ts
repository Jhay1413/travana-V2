import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./tour-operator-settings.repository", () => ({
  tourOperatorSettingsRepository: {
    findAll: vi.fn(),
    findById: vi.fn(),
    findByLowerName: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    countReferences: vi.fn(),
  },
}));
vi.mock("../../utils/image-storage", () => ({
  deleteImageByStoredUrl: vi.fn(),
  uploadImageToS3: vi.fn(),
}));

import { tourOperatorSettingsService as service } from "./tour-operator-settings.service";
import { tourOperatorSettingsRepository as repo } from "./tour-operator-settings.repository";
import { deleteImageByStoredUrl, uploadImageToS3 } from "../../utils/image-storage";

const op = (over: Record<string, unknown> = {}) => ({ id: "op1", name: "TUI", logo_url: null, ...over }) as never;

beforeEach(() => vi.resetAllMocks());

describe("findAll", () => {
  it("clamps paging and passes the search term", async () => {
    vi.mocked(repo.findAll).mockResolvedValue({ rows: [], total: 0, page: 1, limit: 100, totalPages: 0 });
    await service.findAll({ page: "0", limit: "999", search: "tui" });
    expect(repo.findAll).toHaveBeenCalledWith(1, 100, "tui");
    await service.findAll({});
    expect(repo.findAll).toHaveBeenLastCalledWith(1, 25, "");
  });
});

describe("create", () => {
  it("409s on a duplicate name (case-insensitive lookup)", async () => {
    vi.mocked(repo.findByLowerName).mockResolvedValue(op());
    await expect(service.create({ name: "tui" }, "u1")).rejects.toMatchObject({
      statusCode: 409,
      message: "tui is already in the catalogue",
    });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it("stores identity only and stamps created_by", async () => {
    vi.mocked(repo.findByLowerName).mockResolvedValue(null);
    vi.mocked(repo.create).mockResolvedValue(op());
    await service.create({ name: "TUI", code: "TU", website: "https://tui.co.uk" }, "u1");
    expect(repo.create).toHaveBeenCalledWith({ name: "TUI", code: "TU", website: "https://tui.co.uk", phone: null, created_by: "u1" });
  });

  it("409s when it loses the unique-index race", async () => {
    vi.mocked(repo.findByLowerName).mockResolvedValue(null);
    vi.mocked(repo.create).mockResolvedValue(null);
    await expect(service.create({ name: "TUI" }, null)).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe("update", () => {
  it("404s for an unknown operator", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.update("nope", { name: "X Y" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("409s when renaming onto another operator, allows keeping its own name", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op());
    vi.mocked(repo.findByLowerName).mockResolvedValue(op({ id: "other" }));
    await expect(service.update("op1", { name: "Sandals" })).rejects.toMatchObject({ statusCode: 409 });

    vi.mocked(repo.findByLowerName).mockResolvedValue(op({ id: "op1" }));
    vi.mocked(repo.update).mockResolvedValue(op());
    await service.update("op1", { name: "TUI" });
    expect(repo.update).toHaveBeenCalledWith("op1", { name: "TUI" });
  });

  it("an empty string clears optional fields", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op());
    vi.mocked(repo.update).mockResolvedValue(op());
    await service.update("op1", { code: "", website: "", phone: "" });
    expect(repo.update).toHaveBeenCalledWith("op1", { code: null, website: null, phone: null });
  });
});

describe("name race on the unique index", () => {
  it("create and update map a 23505 to a 409", async () => {
    vi.mocked(repo.findByLowerName).mockResolvedValue(null);
    vi.mocked(repo.create).mockRejectedValue({ code: "23505" });
    await expect(service.create({ name: "TUI" }, null)).rejects.toMatchObject({ statusCode: 409, message: "TUI is already in the catalogue" });

    vi.mocked(repo.findById).mockResolvedValue(op());
    vi.mocked(repo.update).mockRejectedValue({ code: "23505" });
    await expect(service.update("op1", { name: "Sandals" })).rejects.toMatchObject({ statusCode: 409, message: "Sandals is already in the catalogue" });
  });
});

describe("remove", () => {
  it("refuses while agencies or records use the operator, with the counts in the message", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op());
    vi.mocked(repo.countReferences).mockResolvedValue({ links: 3, records: 12 });
    await expect(service.remove("op1")).rejects.toMatchObject({
      statusCode: 409,
      message: "Used by 3 agencies and 12 quotes or bookings, so it can't be deleted",
    });
    expect(repo.remove).not.toHaveBeenCalled();
  });

  it("refuses when only records reference it, and uses singular wording", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op());
    vi.mocked(repo.countReferences).mockResolvedValue({ links: 0, records: 1 });
    await expect(service.remove("op1")).rejects.toMatchObject({
      message: "Used by 0 agencies and 1 quote or booking, so it can't be deleted",
    });
  });

  it("deletes an unused operator and its stored logo", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op({ logo_url: "https://s3/logo.png" }));
    vi.mocked(repo.countReferences).mockResolvedValue({ links: 0, records: 0 });
    await service.remove("op1");
    expect(deleteImageByStoredUrl).toHaveBeenCalledWith("https://s3/logo.png");
    expect(repo.remove).toHaveBeenCalledWith("op1");
  });

  it("404s for an unknown operator", async () => {
    vi.mocked(repo.findById).mockResolvedValue(null);
    await expect(service.remove("nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("logo upload", () => {
  it("replaces the previous logo", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op({ logo_url: "old" }));
    vi.mocked(uploadImageToS3).mockResolvedValue("new-url");
    vi.mocked(repo.update).mockResolvedValue(op({ logo_url: "new-url" }));
    const out = await service.uploadLogo("op1", { originalname: "a.png" } as never);
    expect(deleteImageByStoredUrl).toHaveBeenCalledWith("old");
    expect(repo.update).toHaveBeenCalledWith("op1", { logo_url: "new-url" });
    expect(out).toMatchObject({ logo_url: "new-url" });
  });

  it("deleteLogo clears the column even if the S3 delete fails", async () => {
    vi.mocked(repo.findById).mockResolvedValue(op({ logo_url: "old" }));
    vi.mocked(deleteImageByStoredUrl).mockRejectedValue(new Error("s3 down"));
    vi.mocked(repo.update).mockResolvedValue(op());
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await service.deleteLogo("op1");
    expect(repo.update).toHaveBeenCalledWith("op1", { logo_url: null });
    spy.mockRestore();
  });
});
