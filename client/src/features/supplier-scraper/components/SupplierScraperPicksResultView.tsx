import { AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import type { SupplierScraperPicksResult } from "../types";

interface SupplierScraperPicksResultViewProps {
  result: SupplierScraperPicksResult;
}

const CONFIDENCE_STYLE: Record<SupplierScraperPicksResult["applied"][number]["confidence"], string> = {
  high: "bg-emerald-500/15 text-emerald-700",
  medium: "bg-amber-500/15 text-amber-700",
  low: "bg-black/[0.06] text-black/50",
};

// Pure display of what POST /scrapers/picks did — no picker UI here, that
// lives in the bookmarklet. This just tells the agent, in one place: what got
// applied (and the real value it was verified against), what couldn't be
// mapped and why, and what was left alone from the existing spec.
export function SupplierScraperPicksResultView({ result }: SupplierScraperPicksResultViewProps) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-medium text-black/60">
          {result.supplierKey}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            result.specNeedsReview ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700"
          }`}
        >
          {result.specNeedsReview ? "Spec needs review" : "Spec unchanged from review status"}
        </span>
      </div>

      {result.applied.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-black/50">
            Applied ({result.applied.length})
          </p>
          <ul className="space-y-2">
            {result.applied.map((a) => (
              <li key={a.field} className="flex gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <div className="min-w-0 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium text-black/70">{a.field}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLE[a.confidence]}`}>
                      {a.confidence} confidence
                    </span>
                    {a.replaced && (
                      <span className="text-black/40">
                        replaced a <span className="font-medium">{a.replaced}</span> rule
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-black/50">
                    Verified value: <span className="font-mono text-black/70">&ldquo;{a.verifiedValue}&rdquo;</span>
                    <span className="text-black/35"> via {a.strategy}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.problems.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-black/50">
            Couldn't map ({result.problems.length})
          </p>
          <ul className="space-y-2">
            {result.problems.map((p) => (
              <li key={p.field} className="flex gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div className="text-xs text-black/70">
                  <span className="font-medium">{p.field}</span> — {p.reason}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.preserved.length > 0 && (
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-black/50">
            <ShieldCheck className="h-3.5 w-3.5" /> Preserved from the existing spec
          </p>
          <p className="text-xs text-black/60">{result.preserved.join(", ")}</p>
        </div>
      )}

      {result.applied.length === 0 && result.problems.length === 0 && result.preserved.length === 0 && (
        <p className="text-xs text-black/50">Nothing came back from this payload.</p>
      )}
    </div>
  );
}
