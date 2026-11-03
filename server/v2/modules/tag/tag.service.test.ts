import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./tag.repository", () => ({
  tagRepository: { detachTagFromQuote: vi.fn() },
}));

import { tagService } from "./tag.service";
import { tagRepository } from "./tag.repository";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tagService.detachQuoteTag", () => {
  it("detaches via the repository for that quote and tag only", async () => {
    vi.mocked(tagRepository.detachTagFromQuote).mockResolvedValue(true);
    await expect(tagService.detachQuoteTag("q1", "t1")).resolves.toBeUndefined();
    expect(tagRepository.detachTagFromQuote).toHaveBeenCalledWith("q1", "t1");
  });

  it("is a 404 when the tag is not on the quote", async () => {
    vi.mocked(tagRepository.detachTagFromQuote).mockResolvedValue(false);
    await expect(tagService.detachQuoteTag("q1", "t1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
