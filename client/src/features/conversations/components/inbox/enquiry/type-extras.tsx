import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAccommodationTypes } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import { FieldBox } from "./field-box";
import { CABIN_TYPES, holidayKind } from "./lib/enquiry-form";
import type { EnquiryFormApi } from "./use-enquiry-form";

function ToggleBox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <FieldBox label={label}>
      {(cls) => (
        <div className={cn(cls, "flex items-center")}>
          <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
          <span className="ml-2 text-[13px] text-social-muted">{checked ? "Yes" : "No"}</span>
        </div>
      )}
    </FieldBox>
  );
}

function HotTubExtras({ api }: { api: EnquiryFormApi }) {
  const { form } = api;
  const { data: types = [] } = useAccommodationTypes();
  const set = (patch: Partial<typeof form>) => api.patch(patch);
  return (
    <>
      <FieldBox label="Accommodation type">
        {(cls) => (
          <Select value={form.accommodationType} onValueChange={(v) => set({ accommodationType: v })}>
            <SelectTrigger className={cls} data-testid="select-accommodation-type">
              <SelectValue placeholder="Choose type" />
            </SelectTrigger>
            <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldBox>
      <FieldBox label="Guests">
        {(cls) => (
          <Input
            type="number"
            min={1}
            value={form.guests}
            onChange={(e) => set({ guests: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            className={cls}
            data-testid="input-guests"
          />
        )}
      </FieldBox>
      <FieldBox label="Pets">
        {(cls) => (
          <Select value={form.pets} onValueChange={(v) => set({ pets: v === "Yes" ? "Yes" : "No" })}>
            <SelectTrigger className={cls} data-testid="select-pets">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="No">No</SelectItem>
              <SelectItem value="Yes">Yes</SelectItem>
            </SelectContent>
          </Select>
        )}
      </FieldBox>
      <ToggleBox label="Weekend lodge" checked={form.weekendLodge} onChange={(v) => set({ weekendLodge: v })} />
      <ToggleBox label="Flexible on date" checked={form.flexibleOnDate} onChange={(v) => set({ flexibleOnDate: v })} />
    </>
  );
}

function CruiseExtras({ api }: { api: EnquiryFormApi }) {
  const { form } = api;
  const set = (patch: Partial<typeof form>) => api.patch(patch);
  const days = (key: "preCruiseDays" | "postCruiseDays", label: string) => (
    <FieldBox label={label}>
      {(cls) => (
        <Input
          type="number"
          min={0}
          value={form[key]}
          onChange={(e) => set({ [key]: e.target.value })}
          placeholder="0"
          className={cls}
        />
      )}
    </FieldBox>
  );
  return (
    <>
      <FieldBox label="Cabin type" span={2}>
        {(cls) => (
          <Select value={form.cabinType} onValueChange={(v) => set({ cabinType: v })}>
            <SelectTrigger className={cls} data-testid="select-cabin-type">
              <SelectValue placeholder="Choose cabin" />
            </SelectTrigger>
            <SelectContent>
              {CABIN_TYPES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldBox>
      {days("preCruiseDays", "Pre-cruise stay (days)")}
      {days("postCruiseDays", "Post-cruise stay (days)")}
    </>
  );
}

/** Extra rows for Hot Tub Break and Cruise Package holiday types. */
export function TypeExtras({ api }: { api: EnquiryFormApi }) {
  const kind = holidayKind(api.form.holidayTypeName);
  if (kind === "hottub") return <HotTubExtras api={api} />;
  if (kind === "cruise") return <CruiseExtras api={api} />;
  return null;
}
