import { useMemo } from "react";
import { Bookmark, Heart, MessageCircle, Send } from "lucide-react";
import { escapeHtml, postToPlainText, truncateText } from "./preview-text";

const INSTAGRAM_CAPTION_PREVIEW = 125;

interface PostPreviewInstagramProps {
  /** Post body (output of `editorHtmlToPost`). */
  previewHtml: string;
  accountName?: string;
  images: string[];
  title: string;
}

/** Instagram-style card: square first image, carousel dots, caption. */
export function PostPreviewInstagram({ previewHtml, accountName = "your_account", images, title }: PostPreviewInstagramProps) {
  const { captionHtml, truncated } = useMemo(() => {
    const { text, truncated: cut } = truncateText(postToPlainText(previewHtml), INSTAGRAM_CAPTION_PREVIEW);
    return { truncated: cut, captionHtml: escapeHtml(text).replace(/\n/g, "<br>") };
  }, [previewHtml]);
  const first = images[0];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" data-testid="preview-instagram">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 text-[11px] font-bold text-white">
          {accountName.slice(0, 1).toUpperCase()}
        </div>
        <p className="text-[13px] font-semibold leading-tight text-slate-900">{accountName}</p>
      </div>

      <div className="relative aspect-square bg-slate-100">
        {first ? (
          <img src={first} alt={title || "Post image"} className="h-full w-full object-cover" data-testid="img-instagram-preview" />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-xs text-slate-500" data-testid="instagram-no-image">
            Instagram needs at least one image
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex justify-center gap-1 pt-2" data-testid="instagram-carousel-dots" aria-label={`${images.length} images`}>
          {images.slice(0, 10).map((_, index) => (
            <span key={index} className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-blue-500" : "bg-slate-300"}`} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 px-3 pt-2.5 text-slate-900">
        <Heart className="h-5 w-5" aria-hidden="true" />
        <MessageCircle className="h-5 w-5" aria-hidden="true" />
        <Send className="h-5 w-5" aria-hidden="true" />
        <Bookmark className="ml-auto h-5 w-5" aria-hidden="true" />
      </div>

      <div className="px-3 pb-2.5 pt-2 text-[13px] leading-snug text-slate-900">
        <span className="font-semibold">{accountName}</span>{" "}
        <span dangerouslySetInnerHTML={{ __html: captionHtml }} />
        {truncated && <span className="text-slate-500"> … more</span>}
      </div>

      <p className="border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-500" data-testid="instagram-links-note">
        Links aren&apos;t clickable on Instagram
      </p>
    </div>
  );
}
