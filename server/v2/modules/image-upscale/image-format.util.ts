import sharp from "sharp";

export interface SquareImage {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/**
 * Centre-crops and resizes to an exact `size`×`size` square. JPEG output,
 * unless `keepPng` (PNG sources stay PNG so transparency survives).
 */
export async function toSquare(buffer: Buffer, size: number, keepPng = false): Promise<SquareImage> {
  const resized = sharp(buffer).rotate().resize(size, size, { fit: "cover", position: "centre" });
  const { data, info } = await (keepPng ? resized.png() : resized.jpeg({ quality: 90 })).toBuffer({
    resolveWithObject: true,
  });
  return { buffer: data, contentType: keepPng ? "image/png" : "image/jpeg", width: info.width, height: info.height };
}
