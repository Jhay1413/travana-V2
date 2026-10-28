import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePostMedia } from "@/features/social/api/use-social-post-queries";
import { socialPostApi } from "@/features/social/api/social-post.api";
import type { TravelDeal } from "@/features/social/api/social-post.api";
import { POST_IMAGE_SIZE } from "@/features/image-upscale";
import type { ExistingImage, ImageItem, LocalImage, TileSize, UrlImage } from "./editor.types";
import { appendKey, applyOrder, dedupeByUrl, insertKeyAt, moveKey, reconcileOrder } from "./image-order";

/** Mirrors the server: animated gifs are never formatted. */
export const isFormattableFile = (file: File) => file.type.startsWith("image/") && file.type !== "image/gif";

/** Anything not already exactly 1080×1080 is formatted by the server. */
const needsFormatting = (tile: TileSize) =>
  tile.sourceWidth !== undefined && !(tile.sourceWidth === POST_IMAGE_SIZE && tile.sourceHeight === POST_IMAGE_SIZE);

// Size-preserving: only touch the list when the measured size actually changed.
const withSize = <T extends TileSize>(tile: T, w: number, h: number): T =>
  tile.sourceWidth === w && tile.sourceHeight === h ? tile : { ...tile, sourceWidth: w, sourceHeight: h };

interface UsePostImagesArgs {
  open: boolean;
  travelDeal: TravelDeal | null;
  quoteId?: string | null;
  quoteImageUrl: string | null;
  isScheduled: boolean;
}

export const urlSortKey = (url: string) => `url-${url}`;

/** State and actions for every image attached to the post (existing, quote URLs, uploads). */
export function usePostImages({ open, travelDeal, quoteId, quoteImageUrl, isScheduled }: UsePostImagesArgs) {
  const { toast } = useToast();
  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<LocalImage[]>([]);
  const [urlImages, setUrlImages] = useState<UrlImage[]>([]);
  const [loadingUrlImages, setLoadingUrlImages] = useState(false);
  // Remembered post order (sort keys). The visible list is derived from it, so it survives selection changes.
  const [orderKeys, setOrderKeys] = useState<string[]>([]);
  // Set in the same batch as the state they describe, so a "loaded" snapshot is consistent.
  const [urlImagesLoaded, setUrlImagesLoaded] = useState(false);
  const [mediaApplied, setMediaApplied] = useState(false);

  const { data: mediaData } = usePostMedia(travelDeal?.id, open && isScheduled);

  const setUrlSourceSize = (url: string, w: number, h: number) =>
    setUrlImages((prev) => prev.map((img) => (img.url === url ? withSize(img, w, h) : img)));
  const setLocalSourceSize = (localId: string, w: number, h: number) =>
    setPendingFiles((prev) => prev.map((img) => (img.localId === localId ? withSize(img, w, h) : img)));

  useEffect(() => {
    if (open && travelDeal && quoteId) {
      setLoadingUrlImages(true);
      socialPostApi.getQuoteImages(quoteId)
        .then((images) => {
          const mapped: UrlImage[] = dedupeByUrl(images).map((img) => ({
            url: img.url,
            name: img.name,
            source: img.source,
            // Auto-select only for a post that has never been scheduled. Once it
            // has, these same photos are already attached as OnlySocials media
            // (loaded into existingImages) — re-sending their URLs uploads a
            // second copy on every reschedule, so the post grows each time.
            selected: !isScheduled,
          }));
          // This effect can re-run (e.g. once `isScheduled` resolves). Keep the
          // sizes already measured from `<img onLoad>` — cached images won't
          // fire `load` again, so a plain reset would lose the label for good.
          setUrlImages((prev) => {
            const known = new Map(prev.map((p) => [p.url, p]));
            return mapped.map((m) => {
              const k = known.get(m.url);
              return k?.sourceWidth ? { ...m, sourceWidth: k.sourceWidth, sourceHeight: k.sourceHeight } : m;
            });
          });
          setUrlImagesLoaded(true);
        })
        .catch((err) => {
          console.error("Failed to load quote images:", err);
          setUrlImages([]);
          setUrlImagesLoaded(true);
        })
        .finally(() => setLoadingUrlImages(false));
    }
  }, [open, travelDeal, quoteId, isScheduled]);

  // Reset per-deal state when the deal changes (e.g. a regenerate) as well as on close.
  const dealId = travelDeal?.id;
  useEffect(() => {
    setExistingImages([]);
    setUrlImagesLoaded(false);
    setMediaApplied(false);
  }, [dealId]);

  useEffect(() => {
    if (!open) {
      setExistingImages([]);
      setPendingFiles((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return [];
      });
      setUrlImages([]);
      setOrderKeys([]);
      setUrlImagesLoaded(false);
      setMediaApplied(false);
    }
  }, [open]);

  useEffect(() => {
    if (open && mediaData) {
      const mediaArr = Array.isArray(mediaData.media) ? mediaData.media : [];
      if (mediaArr.length > 0) {
        setExistingImages(mediaArr as ExistingImage[]);
      }
      setMediaApplied(true);
    }
  }, [open, mediaData]);

  // Default layout (existing, selected quote images, uploads); the remembered order is applied on top.
  const defaultItems = useMemo<ImageItem[]>(
    () => [
      ...existingImages.map((img): ImageItem => ({ type: "existing", data: img, sortKey: `ex-${img.id}` })),
      ...urlImages
        .filter((img) => img.selected)
        .map((img): ImageItem => ({ type: "url", data: img, sortKey: urlSortKey(img.url) })),
      ...pendingFiles.map((img): ImageItem => ({ type: "local", data: img, sortKey: `loc-${img.localId}` })),
    ],
    [existingImages, pendingFiles, urlImages],
  );
  const imageOrder = useMemo(() => applyOrder(defaultItems, orderKeys), [defaultItems, orderKeys]);

  // Selecting appends, deselecting/removing drops: only the order of what is still present is kept.
  useEffect(() => {
    const present = defaultItems.map((i) => i.sortKey);
    setOrderKeys((prev) => {
      const next = reconcileOrder(prev, present);
      return next.length === prev.length && next.every((k, i) => k === prev[i]) ? prev : next;
    });
  }, [defaultItems]);

  const toggleUrlImage = (url: string) => {
    setUrlImages((prev) => prev.map((img) => (img.url === url ? { ...img, selected: !img.selected } : img)));
  };

  /** Moves an image one step earlier (-1) or later (1) in the post order. */
  const moveImage = (sortKey: string, direction: -1 | 1) =>
    setOrderKeys(moveKey(imageOrder.map((i) => i.sortKey), sortKey, direction));

  /** Drops `fromKey` onto `toKey`, inserting it at that position. */
  const insertImage = (fromKey: string, toKey: string) =>
    setOrderKeys(insertKeyAt(imageOrder.map((i) => i.sortKey), fromKey, toKey));

  const setAllUrlImages = (selected: boolean) =>
    setUrlImages((prev) => prev.map((img) => ({ ...img, selected })));

  const handleFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4"].includes(f.type)
    );
    if (fileArray.length === 0) {
      toast({ title: "Unsupported file type", description: "Only images (JPEG, PNG, GIF, WebP) and MP4 are allowed.", variant: "destructive" });
      return;
    }
    const newLocal: LocalImage[] = fileArray.map((file) => ({
      localId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setPendingFiles((prev) => [...prev, ...newLocal]);
    setOrderKeys((prev) => newLocal.reduce((keys, l) => appendKey(keys, `loc-${l.localId}`), prev));
  };

  const removeImage = (sortKey: string) => {
    const item = imageOrder.find((i) => i.sortKey === sortKey);
    if (!item) return;
    if (item.type === "existing") {
      setExistingImages((prev) => prev.filter((img) => img.id !== item.data.id));
    } else if (item.type === "local") {
      URL.revokeObjectURL(item.data.previewUrl);
      setPendingFiles((prev) => prev.filter((img) => img.localId !== item.data.localId));
    } else if (item.type === "url") {
      toggleUrlImage(item.data.url);
    }
  };

  /** Every image in post order, as a displayable src. */
  const previewImages = useMemo(() => {
    if (imageOrder.length > 0) {
      return imageOrder.map((item) => {
        if (item.type === "existing") return item.data.thumb_url || item.data.url;
        if (item.type === "url") return item.data.url;
        return item.data.previewUrl;
      });
    }
    return quoteImageUrl ? [quoteImageUrl] : [];
  }, [imageOrder, quoteImageUrl]);

  const selectedUrlCount = urlImages.filter(img => img.selected).length;
  // What the server will format on schedule: selected quote images and attached
  // image files that are not already 1080×1080.
  const formatCount =
    urlImages.filter((img) => img.selected && needsFormatting(img)).length +
    pendingFiles.filter((img) => isFormattableFile(img.file) && needsFormatting(img)).length;

  /** Stable fingerprint of the selection and order, built from source state (no effect lag). */
  const signature = imageOrder.map((i) => i.sortKey).join("|");

  const imagesLoaded = (!quoteId || urlImagesLoaded) && (!isScheduled || mediaApplied);

  return {
    urlImages,
    pendingFiles,
    imageOrder,
    loadingUrlImages,
    previewImages,
    selectedUrlCount,
    formatCount,
    signature,
    imagesLoaded,
    toggleUrlImage,
    moveImage,
    insertImage,
    setAllUrlImages,
    handleFiles,
    removeImage,
    setUrlSourceSize,
    setLocalSourceSize,
  };
}
