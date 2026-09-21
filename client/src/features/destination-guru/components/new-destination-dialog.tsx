import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGenerateDestinationGuru } from "@/features/destination-guru/api/use-destination-guru-mutations";
import { getErrorMessage } from "@/features/destination-guru/lib/get-error-message";
import { useToast } from "@/hooks/use-toast";
import type { DestinationGuruRecord } from "@/features/destination-guru/api/destination-guru.api";

interface NewDestinationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerated: (record: DestinationGuruRecord) => void;
}

// Extracted unchanged (markup/behaviour/testids) from the pre-globe
// destination-guru page's "New Search" dialog.
export function NewDestinationDialog({ open, onOpenChange, onGenerated }: NewDestinationDialogProps) {
  const { toast } = useToast();
  const [newDestination, setNewDestination] = useState("");
  const generateMutation = useGenerateDestinationGuru();

  const handleNewSearch = async () => {
    if (!newDestination.trim()) return;
    try {
      const result = await generateMutation.mutateAsync(newDestination.trim());
      onOpenChange(false);
      setNewDestination("");
      toast({ title: `Destination intel generated for ${result.destination}` });
      onGenerated(result);
    } catch (error) {
      toast({ title: "Failed to generate", description: getErrorMessage(error, "Please try again"), variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl dark:bg-black/90 dark:border-white/10">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-amber-500" />
            New Destination Search
          </DialogTitle>
          <DialogDescription className="sr-only">
            Generate AI-powered destination intelligence for a new destination.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter a destination name and we'll generate AI-powered travel intelligence for your team.
          </p>
          <Input
            value={newDestination}
            onChange={(e) => setNewDestination(e.target.value)}
            placeholder="e.g. Santorini, Bali, Cancun…"
            className="h-11 rounded-2xl border-black/10 bg-white/70 dark:bg-white/5"
            data-testid="input-new-destination"
            onKeyDown={(e) => e.key === "Enter" && !generateMutation.isPending && handleNewSearch()}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 rounded-2xl border-black/10"
              onClick={() => {
                onOpenChange(false);
                setNewDestination("");
              }}
              disabled={generateMutation.isPending}
              data-testid="button-cancel-search"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-9 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 text-white hover:from-amber-600 hover:to-orange-600"
              onClick={handleNewSearch}
              disabled={!newDestination.trim() || generateMutation.isPending}
              data-testid="button-generate-guru"
            >
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating…
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Intel
                </>
              )}
            </Button>
          </div>
          {generateMutation.isPending && (
            <p className="text-xs text-center text-black/40 dark:text-white/40 animate-pulse">
              AI is researching this destination. This may take 10-20 seconds…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
