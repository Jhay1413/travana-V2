import { Switch } from "@/components/ui/switch";

interface FacebookOptionsCardProps {
  viewLink: boolean;
  onViewLinkChange: (value: boolean) => void;
  priceBadge: boolean;
  onPriceBadgeChange: (value: boolean) => void;
}

interface OptionRowProps {
  id: string;
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function OptionRow({ id, title, description, checked, onChange }: OptionRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="cursor-pointer space-y-0.5">
        <p className="text-[13px] font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} data-testid={`switch-${id}`} />
    </div>
  );
}

/** Facebook-only options. They drive the previews and hints only for now. */
export function FacebookOptionsCard({ viewLink, onViewLinkChange, priceBadge, onPriceBadgeChange }: FacebookOptionsCardProps) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facebook options</p>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">Preview only</span>
      </div>
      <p className="-mt-2 text-xs text-slate-400">These switches change the preview. The published post uses the text above.</p>
      <OptionRow
        id="fb-view-link"
        title="Add a 'View quote' link under the images"
        description="People can tap through to the full quote."
        checked={viewLink}
        onChange={onViewLinkChange}
      />
      <OptionRow
        id="fb-price-badge"
        title="Show the price badge on the first image"
        description="A small 'From £x pp' tag in the corner."
        checked={priceBadge}
        onChange={onPriceBadgeChange}
      />
    </div>
  );
}
