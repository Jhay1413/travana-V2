import { describe, expect, it } from "vitest";
import {
  appendKey,
  applyOrder,
  buildOrderedUpload,
  dedupeByUrl,
  insertKeyAt,
  moveKey,
  parseOrderToken,
  reconcileOrder,
  removeKey,
} from "./image-order";
import type { ImageItem } from "./editor.types";

describe("reconcileOrder", () => {
  it("keeps the remembered order, drops removed keys and appends new ones", () => {
    expect(reconcileOrder(["b", "a", "x"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });
  it("starts from the present order when nothing is remembered", () => {
    expect(reconcileOrder([], ["a", "b"])).toEqual(["a", "b"]);
  });
  it("a re-selected image goes to the end, not back to its old slot", () => {
    const afterDeselect = reconcileOrder(["a", "b", "c"], ["a", "c"]);
    expect(reconcileOrder(afterDeselect, ["a", "b", "c"])).toEqual(["a", "c", "b"]);
  });
});

describe("applyOrder", () => {
  const items = [{ sortKey: "a" }, { sortKey: "b" }, { sortKey: "c" }];
  it("sorts by the keys and puts unknown items last", () => {
    expect(applyOrder(items, ["c", "a"]).map((i) => i.sortKey)).toEqual(["c", "a", "b"]);
  });
  it("ignores keys that have no item", () => {
    expect(applyOrder(items, ["z", "b"]).map((i) => i.sortKey)).toEqual(["b", "a", "c"]);
  });
});

describe("moveKey", () => {
  it("swaps with the neighbour", () => {
    expect(moveKey(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveKey(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });
  it("does nothing at the ends or for an unknown key", () => {
    expect(moveKey(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveKey(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveKey(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });
});

describe("insertKeyAt", () => {
  it("moves a tile forward onto a later one", () => {
    expect(insertKeyAt(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
  });
  it("moves a tile backward onto an earlier one", () => {
    expect(insertKeyAt(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });
  it("is a no-op when dropped on itself or on an unknown key", () => {
    expect(insertKeyAt(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(insertKeyAt(["a", "b"], "a", "z")).toEqual(["a", "b"]);
  });
});

describe("appendKey / removeKey", () => {
  it("appends once", () => {
    expect(appendKey(["a"], "b")).toEqual(["a", "b"]);
    expect(appendKey(["a"], "a")).toEqual(["a"]);
  });
  it("removes", () => {
    expect(removeKey(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("buildOrderedUpload", () => {
  const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });
  const f1 = file("one.jpg");
  const f2 = file("two.jpg");
  const items: ImageItem[] = [
    { type: "url", sortKey: "url-b", data: { url: "https://q/b.jpg", name: "b", source: "quote", selected: true } },
    { type: "local", sortKey: "loc-1", data: { localId: "1", file: f1, previewUrl: "blob:1" } },
    { type: "existing", sortKey: "ex-7", data: { id: 7, url: "u", thumb_url: "t", name: "n" } },
    { type: "local", sortKey: "loc-2", data: { localId: "2", file: f2, previewUrl: "blob:2" } },
    { type: "url", sortKey: "url-a", data: { url: "https://q/a.jpg", name: "a", source: "quote", selected: true } },
  ];

  it("emits one token list in post order with per-kind indices", () => {
    const out = buildOrderedUpload(items);
    expect(out.tokens).toEqual(["url:0", "file:0", "existing:7", "file:1", "url:1"]);
    expect(out.urls).toEqual(["https://q/b.jpg", "https://q/a.jpg"]);
    expect(out.files).toEqual([f1, f2]);
    expect(out.existingIds).toEqual([7]);
  });

  it("produces tokens the server format can parse back", () => {
    for (const token of buildOrderedUpload(items).tokens) expect(parseOrderToken(token)).not.toBeNull();
    expect(parseOrderToken("file:2")).toEqual({ kind: "file", n: 2 });
    expect(parseOrderToken("nope")).toBeNull();
  });
});

describe("dedupeByUrl", () => {
  it("keeps the first occurrence of a duplicate url", () => {
    const out = dedupeByUrl([
      { url: "a", name: "first" },
      { url: "b", name: "b" },
      { url: "a", name: "second" },
    ]);
    expect(out).toEqual([
      { url: "a", name: "first" },
      { url: "b", name: "b" },
    ]);
  });
});
