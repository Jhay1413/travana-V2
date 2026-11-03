import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/** The white rounded shell shared by the client and booking panels. */
export function PanelShell({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <aside
      aria-label={label}
      className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-social-border bg-card", className)}
    >
      {children}
    </aside>
  );
}

/** Section block in a side panel: label row (with an optional right-hand slot) and content. */
export function PanelSection({ title, right, children, first = false }: { title: string; right?: ReactNode; children: ReactNode; first?: boolean }) {
  return (
    <div className={cn("px-[18px] py-3.5", !first && "border-t border-social-border")}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

export interface KvItem {
  label: string;
  value: ReactNode;
  span?: 1 | 2;
  strong?: boolean;
}

/** Two-column label / value grid. */
export function KvGrid({ items }: { items: KvItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-2 px-[18px] pb-3">
      {items.map((item) => (
        <div key={item.label} className={cn("min-w-0", item.span === 2 && "col-span-2")}>
          <div className="text-[11px] text-social-muted">{item.label}</div>
          <div className={cn("break-words text-[13px] leading-[1.4]", item.strong ? "font-semibold" : "font-medium")}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      title={`Copy ${label}`}
      className="text-social-muted transition hover:text-foreground"
      onClick={() =>
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
            toast({ title: `${label} copied` });
          })
          .catch(() => toast({ title: "Couldn't copy", variant: "destructive" }))
      }
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

/** A reference (HAYS number, tour operator reference) with a copy button. */
export function RefRows({ refs }: { refs: Array<[string, string]> }) {
  if (refs.length === 0) return null;
  return (
    <div className="mx-[18px] mb-3 rounded-xl border border-social-border px-3 py-1.5">
      {refs.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-2 py-0.5 text-[12.5px]">
          <span className="text-social-muted">{label}</span>
          <span className="inline-flex items-center gap-1.5 font-semibold">
            {value}
            <CopyButton text={value} label={label} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function InfoNote({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-xl bg-pipeline-money-bg px-3 py-2.5 text-[12.5px] text-social-muted", className)}>
      <span className="mt-0.5 flex-none">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
