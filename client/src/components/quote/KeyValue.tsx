export function KeyValue({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={testid}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45" data-testid={`${testid}-label`}>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-black/85" data-testid={`${testid}-value`}>
        {value}
      </div>
    </div>
  );
}
