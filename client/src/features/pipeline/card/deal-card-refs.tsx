import { Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Transaction } from "@/features/quote/types";

function RefLine({ label, value }: { label: string; value: string | null | undefined }) {
  const { toast } = useToast();
  const text = value || "—";
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="text-social-muted">{label}</span>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-semibold"
        disabled={!value}
        title={value ? "Copy" : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (!value) return;
          void navigator.clipboard?.writeText(value).then(() => toast({ title: `${label} copied` }));
        }}
      >
        {text}
        {value && <Copy className="h-[13px] w-[13px] text-[#8A94A6]" strokeWidth={2} />}
      </button>
    </div>
  );
}

/** Booking / tour references box on a Booked card. */
export function DealCardRefs({ transaction: t }: { transaction: Transaction }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-pipeline-card-border px-2.5 py-[9px]">
      <RefLine label="Booking ref" value={t.booking?.hays_ref} />
      <RefLine label="Tour ref" value={t.booking?.supplier_ref} />
    </div>
  );
}
