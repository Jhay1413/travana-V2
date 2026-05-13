import { Button } from "@/components/ui/button";

interface QuoteFormActionsProps {
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

export function QuoteFormActions({ isLoading, submitLabel = "Save", onCancel }: QuoteFormActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      {onCancel && (
        <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
      )}
      <Button type="submit" className="rounded-xl" disabled={isLoading}>
        {isLoading ? "Saving..." : submitLabel}
      </Button>
    </div>
  );
}
