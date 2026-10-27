import type { TravelDeal } from "@/features/social/api/social-post.api";

/** Natural size of a tile image, captured when it loads. */
export interface TileSize {
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface LocalImage extends TileSize {
  localId: string;
  file: File;
  previewUrl: string;
}

export interface ExistingImage {
  id: number;
  url: string;
  thumb_url: string;
  name: string;
}

export interface UrlImage extends TileSize {
  url: string;
  name: string;
  source: string;
  selected: boolean;
}

export type ImageItem =
  | { type: "existing"; data: ExistingImage; sortKey: string }
  | { type: "local"; data: LocalImage; sortKey: string }
  | { type: "url"; data: UrlImage; sortKey: string };

export interface SocialPostEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  travelDeal: TravelDeal | null;
  quoteImageUrl: string | null;
  isGenerating: boolean;
  quoteId?: string | null;
  /** 24-hour "HH:mm" quick-pick times shown as chips next to the time input. */
  timeShortcuts?: string[];
  /** Shown beside the time input, e.g. "UK time". */
  timezoneLabel?: string;
  /** Initial state of the "View quote" link switch. Defaults to true. */
  initialViewLink?: boolean;
  /** Initial state of the price badge switch. Defaults to true. */
  initialPriceBadge?: boolean;
  /** Facebook page name shown in the preview. */
  pageName?: string;
  /** Regenerates the post text ("Write with Luna"); the button is hidden when omitted. */
  onRegenerate?: () => Promise<void>;
  /** Called after "Save as draft" succeeds. */
  onSavedDraft?: () => void;
}
