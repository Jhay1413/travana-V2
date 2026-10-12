import { useRef } from "react";
import { PaintBucket } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTED_BRAND_COLORS } from "@/pages/agency/utils/branding-options";

export function BrandColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustom = !SUGGESTED_BRAND_COLORS.some((c) => c.toLowerCase() === value.toLowerCase());

  return (
    <div className="flex flex-wrap gap-3">
      {SUGGESTED_BRAND_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-10 w-10 rounded-[6px] transition",
            value.toLowerCase() === c.toLowerCase() && "ring-2 ring-offset-2 ring-black/60",
          )}
          style={{ background: c }}
          aria-label={`Use colour ${c}`}
          data-testid={`button-branding-color-${c}`}
        />
      ))}
      <div className="relative">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative grid h-10 w-10 place-items-center rounded-[6px] border border-black/15 bg-white",
            isCustom && "ring-2 ring-offset-2 ring-black/60",
          )}
          aria-label="Pick a custom colour"
          data-testid="button-branding-color-custom"
        >
          <PaintBucket className="h-4 w-4 text-black/70" />
          {isCustom && (
            <span
              className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 rounded-full border border-white"
              style={{ background: value }}
            />
          )}
        </button>
        <input
          ref={inputRef}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pointer-events-none absolute inset-0 h-0 w-0 opacity-0"
          tabIndex={-1}
          data-testid="input-branding-color"
        />
      </div>
    </div>
  );
}
