import { Building2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MAX_BYTES = 1_000_000;

export function LogoPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (logoUrl: string | null) => void;
}) {
  const { toast } = useToast();

  const handleFile = (file: File) => {
    if (file.size > MAX_BYTES) {
      toast({ title: "Logo too large", description: "Use an image under 1 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => onChange(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex items-center gap-4">
      <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" data-testid="img-branding-logo" />
        ) : (
          <Building2 className="h-6 w-6 text-black/40" />
        )}
      </div>
      <label className="cursor-pointer rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10">
        <Upload className="mr-1 inline h-3.5 w-3.5" /> Upload
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          data-testid="input-branding-logo-file"
        />
      </label>
      {value && (
        <button onClick={() => onChange(null)} className="text-xs text-red-600 hover:underline" data-testid="button-remove-logo">
          Remove
        </button>
      )}
    </div>
  );
}
