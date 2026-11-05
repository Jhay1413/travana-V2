import { useEffect, useState } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostPlatform } from "../grid/card-fields";
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
  /** Platforms of the ticked accounts; one preview tab each. Empty falls back to Facebook. */
  platforms?: PostPlatform[];
  instagramName?: string;
}

const TAB_LABEL: Record<PostPlatform, string> = { facebook: "Facebook", instagram: "Instagram" };

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
  platforms = ["facebook"],
  instagramName,
}: PostPreviewPanelProps) {
  const tabs: PostPlatform[] = platforms.length > 0 ? platforms : ["facebook"];
  const [active, setActive] = useState<PostPlatform>(tabs[0]);
  // A tab that disappears (account unticked) hands over to the first one left.
  useEffect(() => {
    if (!tabs.includes(active)) setActive(tabs[0]);
  }, [tabs, active]);
  const shown = tabs.includes(active) ? active : tabs[0];

  const badge = showPriceBadge ? priceLabel : null;
  const imageCount = images.length;

  const facebookOnly: Hint[] = tabs.includes("facebook")
    ? [
        showViewLink
          ? { ok: true, text: "A 'View quote' link sits under the images." }
          : { ok: false, text: "No 'View quote' link under the images." },
      ]
    : [];
  const hints: Hint[] = [
    ...facebookOnly,
    imageCount > 0
      ? { ok: true, text: `${imageCount} image${imageCount === 1 ? "" : "s"} in the post, in the order shown.` }
      : { ok: false, text: "Pick at least one image." },
    ...(tabs.includes("facebook") ? [{ ok: true, text: `Posts as ${pageName} (Page).` }] : []),
    ...(tabs.includes("instagram") ? [{ ok: false, text: "Links aren't clickable on Instagram." }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {tabs.length > 1 && (
        <div role="tablist" aria-label="Preview platform" className="flex gap-1 rounded-lg bg-slate-200/70 p-1">
          {tabs.map((platform) => (
            <button
              key={platform}
              type="button"
              role="tab"
              aria-selected={shown === platform}
              onClick={() => setActive(platform)}
              data-testid={`tab-preview-${platform}`}
              className={cn(
                "flex-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                shown === platform ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {TAB_LABEL[platform]}
            </button>
          ))}
        </div>
      )}

      {shown === "instagram" ? (
        <PostPreviewInstagram previewHtml={previewHtml} accountName={instagramName} images={images} title={title} />
      ) : (
        <PostPreviewFacebook
          previewHtml={previewHtml}
          pageName={pageName}
          images={images}
          priceLabel={badge}
          showViewLink={showViewLink}
          title={title}
        />
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
