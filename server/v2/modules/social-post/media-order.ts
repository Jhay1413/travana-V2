import { AppError } from "../../utils/error-handler";

/** Wire format of one `imageOrder` entry: `existing:<mediaId>`, `url:<index into imageUrls>` or `file:<index into files>`. */
export const IMAGE_ORDER_TOKEN = /^(existing|url|file):(\d+)$/;

export type OrderToken =
  | { kind: "existing"; id: number }
  | { kind: "url"; index: number }
  | { kind: "file"; index: number };

/** One media entry in final post order, before anything is uploaded. */
export type MediaSlot =
  | { kind: "existing"; id: number }
  | { kind: "file"; file: Express.Multer.File }
  | { kind: "url"; url: string };

export function parseOrderToken(raw: string): OrderToken | null {
  const match = IMAGE_ORDER_TOKEN.exec(raw);
  if (!match) return null;
  const n = Number(match[2]);
  if (match[1] === "existing") return { kind: "existing", id: n };
  return match[1] === "url" ? { kind: "url", index: n } : { kind: "file", index: n };
}

/** Parses the multipart `imageOrder` field (a JSON array of tokens); undefined when absent or empty. */
export function parseImageOrderField(raw: unknown): string[] | undefined {
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("imageOrder must be a JSON array", 400);
  }
  if (!Array.isArray(parsed) || !parsed.every((t): t is string => typeof t === "string" && IMAGE_ORDER_TOKEN.test(t))) {
    throw new AppError("imageOrder contains an invalid entry", 400);
  }
  return parsed;
}

/**
 * Pure validation of `order` tokens against what the request actually carries.
 * Run before any upload/upscale work so a bad order fails without side effects.
 */
export function assertOrderTokens(
  order: readonly string[],
  { existingIds, fileCount, urlCount }: { existingIds: readonly number[]; fileCount: number; urlCount: number },
): void {
  const existing = new Set(existingIds);
  for (const raw of order) {
    const token = parseOrderToken(raw);
    if (!token) throw new AppError(`Invalid imageOrder entry: ${raw}`, 400);
    if (token.kind === "existing") {
      if (!existing.has(token.id)) throw new AppError(`imageOrder refers to unknown image ${token.id}`, 400);
    } else if (token.kind === "file") {
      if (token.index >= fileCount) throw new AppError(`imageOrder refers to missing file ${token.index}`, 400);
    } else if (token.index >= urlCount) {
      throw new AppError(`imageOrder refers to missing url ${token.index}`, 400);
    }
  }
}

interface BuildSlotsInput {
  existingImageIds: readonly number[];
  inputFiles: readonly Express.Multer.File[];
  inputUrls: readonly string[];
  /** Output of auto-upscale: formatted files become urls and come first in `imageUrls`. */
  prepared: { files: readonly Express.Multer.File[]; imageUrls: readonly string[] };
  order?: readonly string[];
}

/**
 * Final media list in post order. Without `order` this is the legacy layout
 * (existing, then kept files, then urls). With `order`, tokens address the items
 * as the client sent them (before auto-upscale); anything the order leaves out is
 * appended in the legacy order so no image is silently dropped.
 */
export function buildMediaSlots({ existingImageIds, inputFiles, inputUrls, prepared, order }: BuildSlotsInput): MediaSlot[] {
  if (!order) {
    return [
      ...existingImageIds.map((id): MediaSlot => ({ kind: "existing", id })),
      ...prepared.files.map((file): MediaSlot => ({ kind: "file", file })),
      ...prepared.imageUrls.map((url): MediaSlot => ({ kind: "url", url })),
    ];
  }

  // Each input url yields exactly one prepared url; the extras at the front come from formatted files.
  const derivedCount = Math.max(0, prepared.imageUrls.length - inputUrls.length);
  const kept = new Set(prepared.files);
  let derived = 0;
  const fileSlots = inputFiles.map((file): MediaSlot | null => {
    if (kept.has(file)) return { kind: "file", file };
    const url = prepared.imageUrls[derived++];
    return url === undefined ? null : { kind: "url", url };
  });
  const urlSlots = inputUrls.map((_, j): MediaSlot | null => {
    const url = prepared.imageUrls[derivedCount + j];
    return url === undefined ? null : { kind: "url", url };
  });

  const existing = new Set(existingImageIds);
  const used = new Set<string>();
  const slots: MediaSlot[] = [];
  const take = (key: string, slot: MediaSlot | null) => {
    if (!slot || used.has(key)) return;
    used.add(key);
    slots.push(slot);
  };

  for (const raw of order) {
    const token = parseOrderToken(raw);
    if (!token) throw new AppError(`Invalid imageOrder entry: ${raw}`, 400);
    if (token.kind === "existing") {
      if (!existing.has(token.id)) throw new AppError(`imageOrder refers to unknown image ${token.id}`, 400);
      take(`e${token.id}`, { kind: "existing", id: token.id });
    } else if (token.kind === "file") {
      if (token.index >= inputFiles.length) throw new AppError(`imageOrder refers to missing file ${token.index}`, 400);
      take(`f${token.index}`, fileSlots[token.index]);
    } else {
      if (token.index >= inputUrls.length) throw new AppError(`imageOrder refers to missing url ${token.index}`, 400);
      take(`u${token.index}`, urlSlots[token.index]);
    }
  }

  existingImageIds.forEach((id) => take(`e${id}`, { kind: "existing", id }));
  fileSlots.forEach((slot, i) => take(`f${i}`, slot));
  urlSlots.forEach((slot, j) => take(`u${j}`, slot));
  return slots;
}
