import { useState } from "react";
import { Camera, CircleAlert, CircleCheck, ThumbsUp } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { POST_IMAGE_SIZE } from "@/features/image-upscale";
import type { PreviewChannel } from "./editor.types";
import { PostPreviewFacebook } from "./post-preview-facebook";
import { PostPreviewInstagram } from "./post-preview-instagram";

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

/** Left column: channel toggle, the live preview for it, and short hints. */
export function PostPreviewPanel({
  previewHtml,
  images,
  title,
  pageName = "Your Page",
  priceLabel,
  showViewLink,
  showPriceBadge,
}: PostPreviewPanelProps) {
  const [channel, setChannel] = useState<PreviewChannel>("facebook");
  const badge = showPriceBadge ? priceLabel : null;
  const imageCount = images.length;

  const hints: Hint[] =
    channel === "facebook"
      ? [
          showViewLink
            ? { ok: true, text: "A 'View quote' link sits under the images." }
            : { ok: false, text: "No 'View quote' link under the images." },
          imageCount > 0
            ? { ok: true, text: `${imageCount} image${imageCount === 1 ? "" : "s"} in the post, in the order shown.` }
            : { ok: false, text: "Pick at least one image." },
          { ok: true, text: `Posts as ${pageName} (Page).` },
        ]
      : [
          { ok: true, text: `Images formatted to ${POST_IMAGE_SIZE}×${POST_IMAGE_SIZE} when posted. Your quote photos stay as they are.` },
          showPriceBadge
            ? { ok: true, text: "Price badge added to the first image." }
            : { ok: false, text: "No price badge on the images." },
          { ok: false, text: "Links aren't clickable in Instagram captions, so make sure the caption says how to book." },
        ];

  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup
        type="single"
        value={channel}
        onValueChange={(v) => v && setChannel(v as PreviewChannel)}
        className="w-full rounded-lg bg-slate-200/70 p-1"
      >
        <ToggleGroupItem value="facebook" className="flex-1 gap-1.5 data-[state=on]:bg-white data-[state=on]:shadow-sm" data-testid="toggle-channel-facebook">
          <ThumbsUp className="h-3.5 w-3.5" />Facebook
        </ToggleGroupItem>
        <ToggleGroupItem value="instagram" className="flex-1 gap-1.5 data-[state=on]:bg-white data-[state=on]:shadow-sm" data-testid="toggle-channel-instagram">
          <Camera className="h-3.5 w-3.5" />Instagram
        </ToggleGroupItem>
      </ToggleGroup>

      {channel === "facebook" ? (
        <PostPreviewFacebook
          previewHtml={previewHtml}
          pageName={pageName}
          images={images}
          priceLabel={badge}
          showViewLink={showViewLink}
          title={title}
        />
      ) : (
        <PostPreviewInstagram previewHtml={previewHtml} images={images} priceLabel={badge} />
      )}

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
