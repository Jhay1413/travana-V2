import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FilePlus2, FileSearch, type LucideIcon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { quoteKeys } from "@/features/quote/api/use-quote-queries";
import { QuoteCreateDialog } from "@/features/quote/components/quote-create-dialog";
import type { EnrichedQuote } from "@/features/quote/types";
import { QuotePickerDialog } from "./quote-picker-dialog";

export interface CreatePostMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Starts the generate flow for the quote picked from the list. */
  onGenerate: (quote: EnrichedQuote) => void;
}

interface OptionProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  testId: string;
}

function Option({ icon: Icon, title, description, onClick, testId }: OptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border border-social-border bg-white p-4 text-left transition-colors hover:border-social-navy hover:bg-social-page"
      data-testid={testId}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-social-navy text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-social-muted">{description}</span>
    </button>
  );
}

/** "Create Social Post" chooser: build from an existing quote, or make a new social quote. */
export function CreatePostMenu({ open, onOpenChange, onGenerate }: CreatePostMenuProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[520px]" data-testid="dialog-create-post-menu">
          <DialogHeader>
            <DialogTitle>Create Social Post</DialogTitle>
            <DialogDescription>Start from a quote you already have, or add a new one.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Option
              icon={FileSearch}
              title="From an existing quote"
              description="Pick a quote and Luna writes the first draft."
              testId="option-from-existing-quote"
              onClick={() => {
                onOpenChange(false);
                setPickerOpen(true);
              }}
            />
            <Option
              icon={FilePlus2}
              title="New social quote"
              description="Add the holiday details, then generate the post."
              testId="option-new-social-quote"
              onClick={() => {
                onOpenChange(false);
                setQuoteDialogOpen(true);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <QuotePickerDialog open={pickerOpen} onOpenChange={setPickerOpen} onPick={onGenerate} />

      <QuoteCreateDialog
        open={quoteDialogOpen}
        onOpenChange={setQuoteDialogOpen}
        socialPost
        presentation="drawer"
        onSuccess={() => {
          setQuoteDialogOpen(false);
          // Don't open the generator: the agent generates from the new card when ready.
          queryClient.invalidateQueries({ queryKey: quoteKeys.freeQuotes() });
          toast({ title: "Social post added", description: "It shows under Drafts. Click Generate post on its card when you're ready." });
        }}
      />
    </>
  );
}
