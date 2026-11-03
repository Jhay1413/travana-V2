import { CheckCircle2, X } from "lucide-react";
import { Link } from "wouter";

export interface CreatedEnquiryBarProps {
  href: string;
  onDismiss(): void;
}

/** Green bar above the composer once an enquiry was created from this chat. */
export function CreatedEnquiryBar({ href, onDismiss }: CreatedEnquiryBarProps) {
  return (
    <div
      className="mx-5 mb-2 flex items-center gap-2 rounded-xl border border-[#A7F3D0] bg-[#ECFDF5] px-3.5 py-2 text-[13px] text-[#047857] dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-200"
      data-testid="created-enquiry-bar"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="font-semibold">Enquiry created from this chat</span>
      <Link href={href} className="font-semibold underline underline-offset-2">
        Open enquiry
      </Link>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-auto rounded p-0.5 hover:bg-black/5 dark:hover:bg-white/10">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
