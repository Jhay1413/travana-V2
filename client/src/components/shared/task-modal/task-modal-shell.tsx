import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface TaskModalShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  onSubmit: () => void;
  submitLabel: string;
  saving: boolean;
  submitDisabled: boolean;
  /** Fields rendered inside the 2-column grid. */
  children: ReactNode;
  contentTestId: string;
  cancelTestId: string;
  submitTestId: string;
}

/** Centred task pop-up frame shared by Add and Edit: title, subtitle, field grid and footer buttons. */
export function TaskModalShell({
  open,
  onOpenChange,
  title,
  subtitle,
  onSubmit,
  submitLabel,
  saving,
  submitDisabled,
  children,
  contentTestId,
  cancelTestId,
  submitTestId,
}: TaskModalShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[600] bg-[rgba(31,41,55,.5)]"
        className="z-[600] block max-h-[calc(100vh-32px)] w-[520px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[20px] border-social-border bg-background p-7 shadow-2xl sm:rounded-[20px]"
        data-testid={contentTestId}
      >
        <div className="pr-8">
          <DialogTitle className="text-[20px] font-semibold leading-tight tracking-normal">{title}</DialogTitle>
          <DialogDescription className="mt-1 text-[13px] text-social-muted">{subtitle}</DialogDescription>
        </div>

        <form
          className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3.5"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          {children}

          <div className="col-span-2 mt-2 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-[10px] px-5 text-[14px] font-semibold"
              onClick={() => onOpenChange(false)}
              data-testid={cancelTestId}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-[10px] bg-social-orange px-5 text-[14px] font-semibold text-slate-900 hover:bg-social-orange/90"
              disabled={saving || submitDisabled}
              data-testid={submitTestId}
            >
              {saving ? <Spinner className="h-3.5 w-3.5" /> : submitLabel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
