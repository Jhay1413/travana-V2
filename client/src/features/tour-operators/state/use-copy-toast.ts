import { useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { requestErrorMessage } from "@/lib/request-error";

export interface CopyApi {
  /** Copy a value and toast "{Label} copied". */
  copy: (label: string, value: string) => Promise<void>;
  /** Copy a value that has to be fetched first (the masked password). Keeps the click gesture where the browser allows it. */
  copyLater: (label: string, fetchValue: () => Promise<string | null>) => Promise<void>;
}

const NOTHING = "Nothing to copy";

/** Clipboard writes with the shared "{Label} copied" toast. */
export function useCopyToast(): CopyApi {
  const { toast } = useToast();

  const copied = useCallback((label: string) => toast({ title: `${label} copied` }), [toast]);

  const copy = useCallback(
    async (label: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        copied(label);
      } catch {
        toast({ title: `Couldn't copy the ${label.toLowerCase()}`, description: label === "Password" ? undefined : value, variant: "destructive" });
      }
    },
    [copied, toast],
  );

  const copyLater = useCallback(
    async (label: string, fetchValue: () => Promise<string | null>) => {
      try {
        const textPromise = fetchValue().then((v) => {
          if (!v) throw new Error(NOTHING);
          return v;
        });
        textPromise.catch(() => undefined); // surfaced below; avoids an unhandled rejection
        if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
          const item = new ClipboardItem({ "text/plain": textPromise.then((t) => new Blob([t], { type: "text/plain" })) });
          try {
            await navigator.clipboard.write([item]);
          } catch (writeErr) {
            // Prefer the reveal error (403, nothing to copy) over the browser's DOMException.
            await textPromise;
            throw writeErr;
          }
        } else {
          await navigator.clipboard.writeText(await textPromise);
        }
        copied(label);
      } catch (err) {
        toast({ title: `Couldn't copy the ${label.toLowerCase()}`, description: requestErrorMessage(err, "Please try again."), variant: "destructive" });
      }
    },
    [copied, toast],
  );

  return { copy, copyLater };
}
