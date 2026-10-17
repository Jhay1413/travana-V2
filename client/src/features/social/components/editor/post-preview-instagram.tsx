import { useMemo } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { escapeHtml, postToPlainText, truncateText } from "./preview-text";

const INSTAGRAM_CAPTION_LIMIT = 125;

interface PostPreviewInstagramProps {
  /** Post body (output of `editorHtmlToPost`). */
  previewHtml: string;
  handle?: string;
  images: string[];
  priceLabel?: string | null;
}

/** Instagram-style card: square image, counter, price badge and a truncated caption. */
export function PostPreviewInstagram({
  previewHtml,
  handle = "yourpage",
  images,
  priceLabel,
}: PostPreviewInstagramProps) {
  const caption = useMemo(
    () => truncateText(postToPlainText(previewHtml), INSTAGRAM_CAPTION_LIMIT),
    [previewHtml]
  );
  const firstImage = images[0];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="preview-instagram">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 via-pink-500 to-purple-600 text-[11px] font-bold text-white">
          {handle.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-[13px] font-semibold text-slate-900">{handle}</p>
      </div>

      <div className="relative aspect-square bg-slate-100">
        {firstImage ? (
          <img src={firstImage} alt="Post image" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image picked</div>
        )}
        {images.length > 1 && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">
            1/{images.length}
          </span>
        )}
        {firstImage && priceLabel && (
          <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
            {priceLabel}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-3 pt-2.5 text-slate-900">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
        </div>
        {images.length > 1 && (
          <div className="flex items-center gap-1" aria-hidden>
            {images.slice(0, 6).map((src, i) => (
              <span key={`${src}-${i}`} className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-blue-500" : "bg-slate-300"}`} />
            ))}
          </div>
        )}
        <Bookmark className="h-5 w-5" />
      </div>

      <p className="px-3 pb-3 pt-2 text-[13px] leading-snug text-slate-900">
        <span className="font-semibold">{handle}</span>{" "}
        <span dangerouslySetInnerHTML={{ __html: escapeHtml(caption.text).replace(/\n/g, "<br>") }} />
        {caption.truncated && <span className="text-slate-500">… more</span>}
      </p>
    </div>
  );
}
