import { Building2 } from "lucide-react";

export function LiveBrandPreview({
  name,
  slug,
  logoUrl,
  brandColor,
}: {
  name: string;
  slug: string;
  logoUrl: string | null;
  brandColor: string;
}) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">
        Live preview
      </div>
      <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <div className="mb-4 flex items-center gap-3 rounded-xl p-3 text-white" style={{ background: brandColor }}>
          <div className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white/20">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Building2 className="h-5 w-5" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold">{name || "Your agency"}</div>
            <div className="text-xs opacity-80">{slug ? `travelhub.app/${slug}` : "Pipeline"}</div>
          </div>
        </div>
        <div className="space-y-2 text-xs text-black/60 dark:text-white/60">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: brandColor }} /> Active client
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: brandColor }} /> Won quote
          </div>
          <button className="mt-2 rounded-xl px-3 py-1.5 text-xs font-medium text-white" style={{ background: brandColor }}>
            Primary button
          </button>
        </div>
      </div>
    </div>
  );
}
