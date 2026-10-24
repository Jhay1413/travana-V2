import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { useToast } from "@/hooks/use-toast";
import { useDelegateConnect } from "../api/use-channels-extra";
import { channelLabel } from "../lib/channel-status";
import type { DelegateConnectResult } from "../types";
import { copyText } from "./link-panel";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DelegateDialogProps {
  /** Channel type the link is for, or null when closed. */
  channelType: string | null;
  onClose: () => void;
}

/** Email a connect link to a colleague who holds the Meta Business access. */
export function DelegateDialog({ channelType, onClose }: DelegateDialogProps) {
  const { toast } = useToast();
  const delegate = useDelegateConnect();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<DelegateConnectResult | null>(null);

  // Channel type of the in-flight request; cleared when the dialog closes or the type changes.
  const activeRef = useRef<string | null>(null);

  useEffect(() => {
    activeRef.current = null;
    setEmail("");
    setName("");
    setNote("");
    setResult(null);
    delegate.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelType]);

  const valid = EMAIL.test(email.trim());

  const close = () => {
    activeRef.current = null;
    setEmail("");
    setName("");
    setNote("");
    setResult(null);
    delegate.reset();
    onClose();
  };

  const submit = async () => {
    if (!channelType || !valid || delegate.isPending) return;
    const submittedFor = channelType;
    activeRef.current = submittedFor;
    try {
      const res = await delegate.mutateAsync({
        email: email.trim(),
        channel_types: [channelType],
        recipient_name: name.trim() || undefined,
        note: note.trim() || undefined,
      });
      if (activeRef.current !== submittedFor) return;
      if (res.email_sent) {
        toast({ title: `Link sent to ${res.sent_to || email.trim()}` });
        close();
      } else {
        setResult(res);
      }
    } catch (err) {
      if (activeRef.current !== submittedFor) return;
      toast({ title: "Couldn't create the link", description: (err as Error).message, variant: "destructive" });
    }
  };

  const copy = async () => {
    if (!result) return;
    const ok = await copyText(result.connect_url);
    toast(ok ? { title: "Link copied" } : { title: "Copy failed", description: "Copy the link manually.", variant: "destructive" });
  };

  return (
    <Dialog open={channelType !== null} onOpenChange={(o) => !o && !delegate.isPending && close()}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-delegate-connect">
        <DialogHeader>
          <DialogTitle>Email link to a colleague</DialogTitle>
          <DialogDescription>
            They will get a link to connect {channelType ? channelLabel(channelType) : "the channel"} without needing a Travana login.
          </DialogDescription>
        </DialogHeader>
        {result ? (
          <div className="min-w-0 space-y-3">
            <p className="text-[13px]">We couldn't send the email — copy the link and send it yourself.</p>
            <div className="truncate rounded-lg border border-social-border bg-muted/40 px-2.5 py-2 font-mono text-[12px]">{result.connect_url}</div>
            <DialogFooter>
              <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={() => void copy()} data-testid="button-copy-delegate-link">
                Copy link
              </Button>
              <Button type="button" className={PRIMARY_ACTION} onClick={close}>
                Done
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form
            className="min-w-0 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="delegate-email">Email address</Label>
              <Input id="delegate-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-delegate-email" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delegate-name">Name (optional)</Label>
              <Input id="delegate-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="delegate-note">Note (optional)</Label>
              <Textarea id="delegate-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" className={OUTLINE_ACTION} disabled={delegate.isPending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" className={PRIMARY_ACTION} disabled={!valid || delegate.isPending} data-testid="button-send-delegate">
                {delegate.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                Send link
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
