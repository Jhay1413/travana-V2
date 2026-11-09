import { Chips, Field, Seg, Stepper } from "@/components/shared/form-shell";
import {
  BUDGET_TYPES,
  CABIN_TYPES,
  STAR_RATINGS,
  type HolidayKind,
} from "../lib/enquiry-form";
import { uniqueOptionsByLabel } from "../lib/unique-options";
import { MoneyInput, type ColumnProps } from "./enquiry-field-parts";

const BUDGET_TYPE_OPTIONS = BUDGET_TYPES.map((t) => ({ value: t, label: t }));
const STAR_OPTIONS = [{ value: "", label: "Any" }, ...STAR_RATINGS.map((r) => ({ value: r, label: r }))];

function Party({ api, errors, chip }: ColumnProps) {
  const { form, setParty } = api;
  return (
    <Field label="Who is travelling" chip={chip("travellers")} error={errors.travellers}>
      <div className="fm-party">
        <Stepper label="Adults" sub="18 and over" min={1} max={12} value={form.adults} onChange={(n) => setParty({ adults: n })} data-testid="input-adults" />
        <Stepper label="Children" sub="2 to 17 at travel" min={0} max={8} value={form.children} onChange={(n) => setParty({ children: n })} data-testid="input-children" />
        <Stepper label="Infants" sub="Under 2 at travel" min={0} max={4} value={form.infants} onChange={(n) => setParty({ infants: n })} data-testid="input-infants" />
        {form.children > 0 && (
          <div className="fm-ages">
            <div style={{ fontSize: 12, fontWeight: 500, color: "#6B7686", marginBottom: 6 }}>Child ages at travel</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {Array.from({ length: form.children }, (_, i) => (
                <label key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  Child {i + 1}
                  <input
                    className="fm-input"
                    id={`enq-age-${i}`}
                    type="number"
                    min={0}
                    max={17}
                    value={form.childAges[i] ?? 0}
                    onChange={(e) => {
                      const next = [...form.childAges];
                      next[i] = parseInt(e.target.value, 10) || 0;
                      setParty({ childAges: next });
                    }}
                    style={{ width: 78, height: 36, padding: "0 8px" }}
                    data-testid={`input-child-age-${i}`}
                  />
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

function BudgetType({ api, chip }: Pick<ColumnProps, "api" | "chip">) {
  return (
    <Field label="Budget is" chip={chip("budgetType")}>
      <Seg
        options={BUDGET_TYPE_OPTIONS}
        value={api.form.budgetType}
        onChange={(v) => api.edit("budgetType", { budgetType: v })}
        data-testid="select-budget-type"
        aria-label="Budget is"
      />
    </Field>
  );
}

function MinMaxBudget({ api, chip }: Pick<ColumnProps, "api" | "chip">) {
  const { form, edit, patch } = api;
  return (
    <div className="fm-2" style={{ gap: 14 }}>
      <Field label="Min budget" htmlFor="enq-budget" chip={chip("budget")}>
        <MoneyInput id="enq-budget" value={form.budget} onChange={(v) => edit("budget", { budget: v })} data-testid="input-min-budget" />
      </Field>
      <Field label="Max budget" htmlFor="enq-maxBudget">
        <MoneyInput id="enq-maxBudget" value={form.maxBudget} onChange={(v) => patch({ maxBudget: v })} data-testid="input-max-budget" />
      </Field>
    </div>
  );
}

function Notes({ api, chip }: Pick<ColumnProps, "api" | "chip">) {
  return (
    <Field label="Anything else?" hint="(optional)" htmlFor="enq-notes" chip={chip("notes")}>
      <textarea
        className="fm-input"
        id="enq-notes"
        value={api.form.notes}
        onChange={(e) => api.edit("notes", { notes: e.target.value })}
        placeholder="Sea view, adults only, near the beach, special occasion..."
        data-testid="textarea-enquiry-notes"
      />
    </Field>
  );
}

function PackageWho(props: ColumnProps) {
  const { api, chip } = props;
  const { form, edit, lookups } = api;
  return (
    <>
      <Party {...props} />
      <Field label="Minimum star rating" chip={chip("starRating")}>
        <Seg
          options={STAR_OPTIONS}
          value={form.starRating}
          onChange={(v) => edit("starRating", { starRating: v })}
          data-testid="select-star-rating"
          aria-label="Minimum star rating"
        />
      </Field>
      <Field label="Board basis" hint="(pick any)" chip={chip("boardBasis")}>
        <Chips
          multiple
          value={form.boardBasis}
          onChange={(v) => edit("boardBasis", { boardBasis: v })}
          options={uniqueOptionsByLabel(lookups.boardBasisOptions, form.boardBasis)}
          data-testid="select-board-basis"
          aria-label="Board basis"
        />
      </Field>
      <div className="fm-2" style={{ gap: 14, alignItems: "end" }}>
        <Field label="Budget" htmlFor="enq-budget" chip={chip("budget")}>
          <MoneyInput id="enq-budget" value={form.budget} onChange={(v) => edit("budget", { budget: v })} placeholder="3000" data-testid="input-budget" />
        </Field>
        <BudgetType api={api} chip={chip} />
      </div>
      <Notes api={api} chip={chip} />
    </>
  );
}

function HotTubWho(props: ColumnProps) {
  const { api, chip } = props;
  const { form, patch } = api;
  return (
    <>
      <div className="fm-party">
        <Stepper label="Guests" min={1} max={30} value={form.guests} onChange={(n) => patch({ guests: n })} data-testid="input-guests" />
        <Stepper label="Pets" sub="0 for none" min={0} max={6} value={form.pets} onChange={(n) => patch({ pets: n })} data-testid="input-pets" />
      </div>
      <MinMaxBudget api={api} chip={chip} />
      <BudgetType api={api} chip={chip} />
      <Notes api={api} chip={chip} />
    </>
  );
}

function CruiseWho(props: ColumnProps) {
  const { api, chip } = props;
  const { form, patch } = api;
  return (
    <>
      <Party {...props} />
      <MinMaxBudget api={api} chip={chip} />
      <BudgetType api={api} chip={chip} />
      <Field label="Cruise line" htmlFor="enq-cruiseLine">
        <input
          className="fm-input"
          id="enq-cruiseLine"
          value={form.cruiseLine}
          onChange={(e) => patch({ cruiseLine: e.target.value })}
          placeholder="e.g. Royal Caribbean, MSC, P&O"
          data-testid="input-cruise-line"
        />
      </Field>
      <Field label="Cabin type">
        <Chips
          value={form.cabinType}
          onChange={(v) => patch({ cabinType: v })}
          allowClear
          options={CABIN_TYPES.map((c) => ({ value: c, label: c }))}
          data-testid="select-cabin-type"
          aria-label="Cabin type"
        />
      </Field>
      <div className="fm-2" style={{ gap: 14 }}>
        <Field label="Pre-cruise stay days" htmlFor="enq-preCruise">
          <input
            className="fm-input"
            id="enq-preCruise"
            type="number"
            min={0}
            placeholder="0"
            value={form.preCruiseDays}
            onChange={(e) => patch({ preCruiseDays: e.target.value })}
            data-testid="input-pre-cruise-days"
          />
        </Field>
        <Field label="Post-cruise stay days" htmlFor="enq-postCruise">
          <input
            className="fm-input"
            id="enq-postCruise"
            type="number"
            min={0}
            placeholder="0"
            value={form.postCruiseDays}
            onChange={(e) => patch({ postCruiseDays: e.target.value })}
            data-testid="input-post-cruise-days"
          />
        </Field>
      </div>
      <Notes api={api} chip={chip} />
    </>
  );
}

/** Right column, "Who and what": party, budget and preferences for the chosen holiday type. */
export function EnquiryWhoColumn({ kind, ...props }: ColumnProps & { kind: HolidayKind }) {
  return (
    <div className="fm-col">
      <div className="fm-kicker">Who and what</div>
      {kind === "hottub" ? <HotTubWho {...props} /> : kind === "cruise" ? <CruiseWho {...props} /> : <PackageWho {...props} />}
    </div>
  );
}
