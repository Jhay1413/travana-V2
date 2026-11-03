import { CircleAlert, CircleCheck } from "lucide-react";
import { PostPreviewFacebook } from "./post-preview-facebook";

interface PostPreviewPanelProps {
  previewHtml: string;
  images: string[];
  title: string;
  pageName?: string;
  priceLabel?: string | null;
  showViewLink: boolean;
  showPriceBadge: boolean;
}

interface Hint {
  ok: boolean;
  text: string;
}

/** Left column: the live Facebook preview and short hints. */
export function PostPreviewPanel({
  previewHtml,
  images,
  title,
  pageName = "Your Page",
  priceLabel,
  showViewLink,
  showPriceBadge,
}: PostPreviewPanelProps) {
  const badge = showPriceBadge ? priceLabel : null;
  const imageCount = images.length;

  const hints: Hint[] = [
    showViewLink
      ? { ok: true, text: "A 'View quote' link sits under the images." }
      : { ok: false, text: "No 'View quote' link under the images." },
    imageCount > 0
      ? { ok: true, text: `${imageCount} image${imageCount === 1 ? "" : "s"} in the post, in the order shown.` }
      : { ok: false, text: "Pick at least one image." },
    { ok: true, text: `Posts as ${pageName} (Page).` },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PostPreviewFacebook
        previewHtml={previewHtml}
        pageName={pageName}
        images={images}
        priceLabel={badge}
        showViewLink={showViewLink}
        title={title}
      />

      <p className="text-center text-[10px] font-medium uppercase tracking-widest text-slate-400">Live preview</p>

      <ul className="space-y-2">
        {hints.map((hint) => {
          const Icon = hint.ok ? CircleCheck : CircleAlert;
          return (
            <li key={hint.text} className="flex items-start gap-2 text-xs text-slate-600">
              <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${hint.ok ? "text-green-600" : "text-amber-500"}`} />
              {hint.text}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
