import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

/** Shares the client page link with colleagues (same URL the old Share button copied). */
export function ShareClientModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const url = typeof window === "undefined" ? "" : window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "The client page link is on your clipboard." });
    } catch {
      toast({ title: "Could not copy the link", description: "Select the link and copy it by hand.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[500px] rounded-2xl" data-testid="dialog-share-client">
        <DialogHeader>
          <DialogTitle>Share client</DialogTitle>
          <DialogDescription>Colleagues with access can open this page from the link.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2.5">
          <Input readOnly value={url} aria-label="Client link" onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
          <Button type="button" variant="outline" onClick={() => void copy()} className="gap-2" data-testid="button-share-copy">
            <Copy className="h-4 w-4" /> Copy
          </Button>
        </div>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
