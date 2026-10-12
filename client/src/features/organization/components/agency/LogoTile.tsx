import { useRef } from "react";
import { ImageIcon, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MAX_BYTES = 1_000_000;

interface LogoTileProps {
  value: string | null;
  onChange: (url: string | null) => void;
  className?: string;
  label: string;
  testId: string;
}

export function LogoTile({ value, onChange, className, label, testId }: LogoTileProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "Logo too large", description: "Use an image under 1 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === "string") onChange(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="relative">
        <div className={cn("grid place-items-center overflow-hidden rounded-[4px] bg-[#2E3D50]", className)}>
          {value ? (
            <img src={value} alt={label} className="h-full w-full object-contain p-2" data-testid={`img-${testId}`} />
          ) : (
            <ImageIcon className="h-6 w-6 text-white/30" />
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label={`Upload ${label}`}
          className="absolute -bottom-2 -right-2 grid h-6 w-6 place-items-center rounded-full border border-black/15 bg-white shadow-sm hover:bg-black/5"
          data-testid={`button-upload-${testId}`}
        >
          <Upload size={12} className="text-black/70" />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          data-testid={`input-${testId}-file`}
        />
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-black/50 hover:text-red-600 hover:underline"
          data-testid={`button-remove-${testId}`}
        >
          Remove
        </button>
      )}
    </div>
  );
}
