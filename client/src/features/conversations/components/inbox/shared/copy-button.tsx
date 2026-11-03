import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export interface CopyButtonProps {
  value: string;
  /** Accessible name, e.g. "Copy email". */
  label: string;
}

export function CopyButton({ value, label }: CopyButtonProps) {
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast({ title: "Copied" });
    } catch {
      toast({ title: "Could not copy", variant: "destructive" });
    }
  };

  return (
    <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={label} title={label} onClick={copy}>
      <Copy className="h-3.5 w-3.5" />
    </Button>
  );
}
