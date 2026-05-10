import { cn } from "@/lib/utils";
import { SUGGESTED_BRAND_COLORS } from "../utils/branding-options";

export function BrandColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTED_BRAND_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={cn(
            "h-10 w-10 rounded-xl border-2 transition",
            value === c ? "border-black/60 scale-110 dark:border-white" : "border-transparent hover:scale-105",
          )}
          style={{ background: c }}
          data-testid={`button-branding-color-${c}`}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-10 cursor-pointer rounded-xl border-2 border-transparent"
        data-testid="input-branding-color"
      />
    </div>
  );
}
