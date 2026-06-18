import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DestinationGuru, type DestinationGuruData } from "@/features/destination-guru/components/destination-guru";
import { useToast } from "@/hooks/use-toast";

interface GuruRecord {
  data: DestinationGuruData;
}

interface QuoteGuruSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  guruDestination: string;
  guruRecord: GuruRecord | null | undefined;
  generateGuruMutation: {
    isPending: boolean;
    mutate: (
      destination: string,
      options?: {
        onSuccess?: () => void;
        onError?: (err: any) => void;
      },
    ) => void;
  };
}

export function QuoteGuruSheet({
  open,
  onOpenChange,
  guruDestination,
  guruRecord,
  generateGuruMutation,
}: QuoteGuruSheetProps) {
  const { toast } = useToast();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl overflow-y-auto p-0 border-l border-black/10 bg-[#f8f8f8] dark:bg-[#0a0a0a]"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Destination Guru</SheetTitle>
        </SheetHeader>
        <div className="p-5 pt-10">
          {guruRecord ? (
            <DestinationGuru
              destination={guruDestination}
              externalData={guruRecord.data}
              compact
              onClose={() => onOpenChange(false)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="h-10 w-10 text-amber-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                No intel yet for {guruDestination || "this destination"}
              </h3>
              <p className="text-sm text-black/50 dark:text-white/50 mb-6 max-w-sm">
                Generate AI-powered destination intelligence including weather, flight times, travel tips, and top
                activities.
              </p>
              <Button
                className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-6 text-white hover:from-amber-600 hover:to-orange-600"
                disabled={!guruDestination || generateGuruMutation.isPending}
                data-testid="button-generate-guru-sheet"
                onClick={() => {
                  generateGuruMutation.mutate(guruDestination, {
                    onSuccess: () => {
                      toast({ title: `Destination intel generated for ${guruDestination}` });
                    },
                    onError: (err: any) => {
                      toast({ title: "Failed to generate", description: err?.message, variant: "destructive" });
                    },
                  });
                }}
              >
                {generateGuruMutation.isPending ? (
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
              {generateGuruMutation.isPending && (
                <p className="text-xs text-black/40 dark:text-white/40 mt-4 animate-pulse">
                  AI is researching this destination. This may take 10-20 seconds…
                </p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
