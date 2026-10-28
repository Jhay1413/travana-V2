import { describe, expect, it } from "vitest";
import { groupAttachmentsByNote } from "./group-attachments";
import type { NoteAttachment } from "../types";

const att = (id: string, noteId: string): NoteAttachment => ({
  id,
  noteId,
  filename: id,
  originalName: id,
  mimeType: "image/png",
  size: 1,
  createdAt: "2026-01-01T00:00:00Z",
});

describe("groupAttachmentsByNote", () => {
  it("returns an empty map for no attachments", () => {
    expect(groupAttachmentsByNote([]).size).toBe(0);
  });

  it("groups by note id preserving order", () => {
    const map = groupAttachmentsByNote([att("a", "n1"), att("b", "n2"), att("c", "n1")]);
    expect(map.get("n1")?.map((a) => a.id)).toEqual(["a", "c"]);
    expect(map.get("n2")?.map((a) => a.id)).toEqual(["b"]);
    expect(map.get("n3")).toBeUndefined();
  });
});
