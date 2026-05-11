import { Copy, FileText, Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BookingActionsRowProps {
  isFavorited: boolean;
  onTogglePin: () => void;
  onCopy: () => void;
  onExport: () => void;
}

export function BookingActionsRow({
  isFavorited,
  onTogglePin,
  onCopy,
  onExport,
}: BookingActionsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="row-booking-actions">
      <button
        type="button"
        onClick={onTogglePin}
        className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
          isFavorited
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
            : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"
        }`}
        data-testid="button-pin-booking"
      >
        {isFavorited ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        {isFavorited ? "Unpin" : "Pin"}
      </button>
      <Button
        size="sm"
        variant="outline"
        className="h-9 rounded-2xl border-black/10 bg-white/70"
        data-testid="button-copy-booking"
        onClick={onCopy}
      >
        <Copy className="mr-2 h-4 w-4" />
        Copy
      </Button>
      <Button
        size="sm"
        className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90"
        data-testid="button-export-booking"
        onClick={onExport}
      >
        <FileText className="mr-2 h-4 w-4" />
        Export
      </Button>
    </div>
  );
}
