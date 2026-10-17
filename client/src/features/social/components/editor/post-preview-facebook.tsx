import { useMemo } from "react";
import { MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { postToEditorHtml } from "@/lib/post-editor-html";
import { escapeHtml, postToPlainText, truncateText } from "./preview-text";

const FACEBOOK_TEXT_LIMIT = 170;

interface PostPreviewFacebookProps {
  /** Post body (output of `editorHtmlToPost`). */
  previewHtml: string;
  pageName?: string;
  images: string[];
  priceLabel?: string | null;
  showViewLink: boolean;
  title: string;
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/** Facebook-style card showing how the post will look in the feed. */
export function PostPreviewFacebook({
  previewHtml,
  pageName = "Your Page",
  images,
  priceLabel,
  showViewLink,
  title,
}: PostPreviewFacebookProps) {
  const { bodyHtml, truncated } = useMemo(() => {
    const { text, truncated: cut } = truncateText(postToPlainText(previewHtml), FACEBOOK_TEXT_LIMIT);
    return {
      truncated: cut,
      bodyHtml: cut ? escapeHtml(text).replace(/\n/g, "<br>") : postToEditorHtml(previewHtml),
    };
  }, [previewHtml]);
  const firstImage = images[0];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="preview-facebook">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
          {initialsOf(pageName)}
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-tight text-slate-900">{pageName}</p>
          <p className="text-[11px] text-slate-500">Just now · 🌐</p>
        </div>
      </div>

      <div className="px-3 pb-2.5 text-[13px] leading-snug text-slate-900">
        <span dangerouslySetInnerHTML={{ __html: bodyHtml }} />
        {truncated && <span className="text-slate-500"> … See more</span>}
      </div>

      <div className="relative aspect-[4/3] bg-slate-100">
        {firstImage ? (
          <img src={firstImage} alt={title || "Post image"} className="h-full w-full object-cover" data-testid="img-post-preview" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">No image picked</div>
        )}
        {firstImage && priceLabel && (
          <div className="absolute bottom-2.5 right-2.5 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-white">
            {priceLabel}
          </div>
        )}
      </div>

      {showViewLink && (
        <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Online quote</p>
            <p className="truncate text-[13px] font-semibold text-slate-900">{title}</p>
          </div>
          <span className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-800">
            View quote
          </span>
        </div>
      )}

      <div className="flex items-center justify-around border-t border-slate-200 py-2 text-xs font-medium text-slate-500">
        <span className="flex items-center gap-1.5"><ThumbsUp className="h-3.5 w-3.5" />Like</span>
        <span className="flex items-center gap-1.5"><MessageCircle className="h-3.5 w-3.5" />Comment</span>
        <span className="flex items-center gap-1.5"><Share2 className="h-3.5 w-3.5" />Share</span>
      </div>
    </div>
  );
}
