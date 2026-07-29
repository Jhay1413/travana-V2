// One ordered list for the images in a quote/booking form.
//
// The forms used to hold three separate arrays — saved images, picked files and
// imported URLs — rendered as three grids and flattened by kind at submit. That
// made cross-kind ordering impossible to express: you could never drag a
// just-picked file above an already-saved image, because submit reassembled
// them kind-by-kind regardless.
//
// Everything now lives in one ordered array of tagged items. Order in this array
// IS the display order: the server assigns `position` from the index of the
// submitted `images` array, and marks the first one primary when the quote has
// no primary yet — so "make this the main photo" is just "drag it to the front".

export type FormImageItem =
  | { key: string; kind: "existing"; id: string; url: string }
  | { key: string; kind: "file"; file: File; previewUrl: string }
  | { key: string; kind: "url"; url: string };

let sequence = 0;
/** Stable identity for React keys and drag tracking — URLs can repeat. */
function nextKey(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}`;
}

export function existingImageItem(id: string, url: string): FormImageItem {
  return { key: `existing-${id}`, kind: "existing", id, url };
}

export function fileImageItem(file: File): FormImageItem {
  return { key: nextKey("file"), kind: "file", file, previewUrl: URL.createObjectURL(file) };
}

export function urlImageItem(url: string): FormImageItem {
  return { key: nextKey("url"), kind: "url", url };
}

/** What to render in a thumbnail, whichever kind the item is. */
export function itemPreviewUrl(item: FormImageItem): string {
  return item.kind === "file" ? item.previewUrl : item.url;
}

/** The files that still need uploading, in display order. */
export function pendingFiles(items: FormImageItem[]): File[] {
  return items.flatMap((i) => (i.kind === "file" ? [i.file] : []));
}

/** Already-resolvable URLs, in display order (excludes not-yet-uploaded files). */
export function resolvedUrls(items: FormImageItem[]): string[] {
  return items.flatMap((i) => (i.kind === "file" ? [] : [i.url]));
}

/**
 * The final ordered URL list to submit. `urlByFile` comes from
 * uploadImagesDirect; a file missing from it failed to upload and is dropped,
 * which closes the gap rather than leaving a hole in the order.
 */
export function orderedImageUrls(
  items: FormImageItem[],
  urlByFile: Map<File, string>,
): string[] {
  return items.flatMap((item) => {
    if (item.kind !== "file") return item.url ? [item.url] : [];
    const uploaded = urlByFile.get(item.file);
    return uploaded ? [uploaded] : [];
  });
}

/**
 * Ordered URLs for images that are NOT already saved — i.e. what an UPDATE
 * should send.
 *
 * `updateQuote` passes `images` straight to `addImages`, which inserts every URL
 * as a new row with no dedupe against existing ones. Including already-saved
 * images there would duplicate the entire gallery on every save. Reordering
 * saved images is done through the reorder endpoint (the Arrange dialog), not
 * by resubmitting them here.
 */
export function newImageUrls(
  items: FormImageItem[],
  urlByFile: Map<File, string>,
): string[] {
  return orderedImageUrls(
    items.filter((i) => i.kind !== "existing"),
    urlByFile,
  );
}

/** Revoke object URLs created for file previews, to avoid leaking blobs. */
export function releaseItemPreview(item: FormImageItem): void {
  if (item.kind === "file") URL.revokeObjectURL(item.previewUrl);
}
