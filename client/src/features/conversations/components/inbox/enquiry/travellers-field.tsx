import { Minus, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FieldBox } from "./field-box";
import type { EnquiryFormApi } from "./use-enquiry-form";

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  const btn =
    "grid h-7 w-7 place-items-center rounded-full border border-social-border text-social-muted hover:bg-black/5 disabled:opacity-40 dark:hover:bg-white/10";
  return (
    <div className="flex flex-1 items-center justify-between gap-2">
      <span className="text-[13px]">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="h-3 w-3" />
        </button>
        <span className="w-5 text-center text-[14px] font-semibold tabular-nums" data-testid={`count-${label.toLowerCase()}`}>
          {value}
        </span>
        <button type="button" className={btn} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

/** Adults / children / infants steppers, plus one age box per child. */
export function TravellersField({ api, error }: { api: EnquiryFormApi; error?: string }) {
  const { form, setTravellers, chipFor } = api;
  const setAge = (i: number, raw: string) => {
    const age = Math.min(17, Math.max(0, parseInt(raw, 10) || 0));
    setTravellers({ childAges: form.childAges.map((a, idx) => (idx === i ? age : a)) });
  };
  return (
    <FieldBox label="Travellers" span={2} chip={chipFor("travellers")} error={error}>
      {(cls) => (
        <>
          <div className={`${cls} flex h-[42px] items-center gap-4`}>
            <Stepper label="Adults" value={form.adults} min={1} onChange={(n) => setTravellers({ adults: n })} />
            <Stepper label="Children" value={form.children} min={0} onChange={(n) => setTravellers({ children: n })} />
            <Stepper label="Infants" value={form.infants} min={0} onChange={(n) => setTravellers({ infants: n })} />
          </div>
          {form.children > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[12px] text-social-muted">Child ages</span>
              {form.childAges.map((age, i) => (
                <Input
                  key={i}
                  type="number"
                  min={0}
                  max={17}
                  value={age}
                  onChange={(e) => setAge(i, e.target.value)}
                  className="h-8 w-14 rounded-lg px-2 text-center text-[13px]"
                  aria-label={`Age of child ${i + 1}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </FieldBox>
  );
}
