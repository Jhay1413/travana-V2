import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePortalPin } from "@/features/client/api/use-portal-pin";
import { useToast } from "@/hooks/use-toast";
import { isValidPin, randomPin, sanitisePin } from "@/features/client/lib/portal-pin";

/** Set, change or remove the four-digit PIN a client types to open their portal. */
export function PortalPinModal({
  clientId,
  open,
  onOpenChange,
}: {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { hasPin, saving, setPin, removePin } = usePortalPin(clientId);
  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft("");
      setTouched(false);
      setVisible(false);
    }
  }, [open]);

  const error = touched && !isValidPin(draft) ? "Enter four digits, for example 4821." : undefined;

  const save = async () => {
    setTouched(true);
    if (!isValidPin(draft)) return;
    if (await setPin(draft)) {
      toast({ title: hasPin ? "Portal PIN changed" : "Portal PIN set" });
      onOpenChange(false);
    }
  };

  const remove = async () => {
    if (await removePin()) {
      toast({ title: "Portal PIN removed" });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] rounded-2xl" data-testid="dialog-portal-pin">
        <DialogHeader>
          <DialogTitle>{hasPin ? "Change portal PIN" : "Set portal PIN"}</DialogTitle>
          <DialogDescription>The client types this four-digit PIN to open their portal.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          noValidate
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="portal-pin-input">New PIN</Label>
            <div className="relative">
              <Input
                id="portal-pin-input"
                type={visible ? "text" : "password"}
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="••••"
                value={draft}
                onChange={(e) => setDraft(sanitisePin(e.target.value))}
                aria-invalid={!!error}
                className="pr-10"
                data-testid="input-set-pin"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                aria-label={visible ? "Hide PIN" : "Show PIN"}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-social-muted transition hover:text-foreground"
                data-testid="button-toggle-pin-visibility"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p role="alert" className="text-xs text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => {
                  setDraft(randomPin());
                  setVisible(true);
                }} data-testid="button-make-pin">
                Make one up
              </Button>
              {hasPin && (
                <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" disabled={saving} onClick={() => void remove()} data-testid="button-remove-pin">
                  Remove PIN
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="button-confirm-pin">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save PIN
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
