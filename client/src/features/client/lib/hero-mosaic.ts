// Picks the tiles for the hero photo mosaic (primary image first).

export interface MosaicImage {
  id: string;
  url: string;
  isPrimary?: boolean | null;
}

export interface MosaicTiles<T extends MosaicImage> {
  /** Images to render, primary first, at most `max`. */
  tiles: T[];
  /** Empty tiles needed to fill the mosaic up to `max`. */
  placeholders: number;
  /** Photos beyond the tiles shown. */
  extra: number;
}

/** Every image that has a url, with the primary (or else the first) one moved to the front. */
export function orderImages<T extends MosaicImage>(images: T[]): T[] {
  const withUrl = images.filter((img) => img.url);
  const primary = withUrl.find((img) => img.isPrimary) ?? withUrl[0];
  return primary ? [primary, ...withUrl.filter((img) => img !== primary)] : [];
}

export function mosaicTiles<T extends MosaicImage>(images: T[], max = 5): MosaicTiles<T> {
  const ordered = orderImages(images);
  const tiles = ordered.slice(0, max);
  return { tiles, placeholders: Math.max(max - tiles.length, 0), extra: Math.max(ordered.length - tiles.length, 0) };
}
