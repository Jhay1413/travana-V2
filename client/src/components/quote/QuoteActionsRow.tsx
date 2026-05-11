import { Copy, FileText, MoreHorizontal, Pin, PinOff, RefreshCw, Share2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface QuoteActionsRowProps {
  dateExpiry: string | Date | null | undefined;
  isFavorited: boolean;
  onTogglePin: () => void;
  onUpdateExpiry: (currentIsoDate: string) => void;
  onShare: () => void;
  onOpenGuru: () => void;
  onCopy: () => void;
  onExport: () => void;
}

export function QuoteActionsRow({
  dateExpiry,
  isFavorited,
  onTogglePin,
  onUpdateExpiry,
  onShare,
  onOpenGuru,
  onCopy,
  onExport,
}: QuoteActionsRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
      <button
        type="button"
        onClick={() => {
          const current = dateExpiry ? new Date(dateExpiry).toISOString().split("T")[0] : "";
          onUpdateExpiry(current);
        }}
        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
        data-testid="button-update-expiry"
      >
        <RefreshCw className="h-4 w-4" />
        Update Expiry
      </button>
      <button
        type="button"
        onClick={onTogglePin}
        className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold transition ${
          isFavorited
            ? "border-amber-500/30 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15"
            : "border-black/10 bg-white/70 text-black/75 hover:bg-black/[0.03]"
        }`}
        data-testid="button-pin-quote"
      >
        {isFavorited ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        {isFavorited ? "Unpin" : "Pin"}
      </button>
      <button
        type="button"
        onClick={onShare}
        className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-black/75 transition hover:bg-black/[0.03]"
        data-testid="button-share-quote"
      >
        <Share2 className="h-4 w-4" />
        Share Quote
      </button>
      <Button
        size="sm"
        className="h-9 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 text-white hover:from-amber-600 hover:to-orange-600 shadow-sm"
        data-testid="button-destination-guru"
        onClick={onOpenGuru}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        Destination Guru
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-9 rounded-2xl border-black/10 bg-white/70"
            data-testid="button-quote-actions"
          >
            <MoreHorizontal className="mr-2 h-4 w-4" />
            Actions
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40 rounded-xl">
          <DropdownMenuItem onClick={onCopy} data-testid="button-copy-quote">
            <Copy className="mr-2 h-4 w-4" />
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onExport} data-testid="button-export-quote">
            <FileText className="mr-2 h-4 w-4" />
            Export
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
