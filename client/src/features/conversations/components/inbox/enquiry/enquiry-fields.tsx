import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { orderBoardBasisRows } from "@/features/lookups";
import { useBoardBasis, usePackageTypes } from "@/hooks/queries";
import { FieldBox } from "./field-box";
import {
  BUDGET_TYPES,
  LEAD_SOURCES,
  NIGHT_OPTIONS,
  STAR_RATINGS,
  flexibilityOptionsFor,
  holidayKind,
  type FormErrors,
} from "./lib/enquiry-form";
import { AirportField, DestinationField, ResortField } from "./location-fields";
import { TravellersField } from "./travellers-field";
import { TypeExtras } from "./type-extras";
import type { EnquiryFormApi } from "./use-enquiry-form";

const LEAD_LABEL: Record<(typeof LEAD_SOURCES)[number], string> = {
  SHOP: "Shop",
  FACEBOOK: "Facebook",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  PHONE_ENQUIRY: "Phone enquiry",
};

/** The two-column grid of enquiry fields. Errors are only passed once the user tries to save. */
export function EnquiryFields({
  api,
  errors,
}: {
  api: EnquiryFormApi;
  errors: FormErrors;
}) {
  const { form, edit, setHolidayType, chipFor } = api;
  const { data: packageTypes = [] } = usePackageTypes();
  const { data: boardBasis = [] } = useBoardBasis();
  const kind = holidayKind(form.holidayTypeName);
  const boardOptions = orderBoardBasisRows(boardBasis).map((b) => ({
    value: b.id,
    label: b.type,
  }));
  const flexOptions = flexibilityOptionsFor(kind);

  return (
    <div className="grid grid-cols-2 gap-x-3.5 gap-y-2.5">
      <FieldBox
        label="Title"
        span={2}
        chip={chipFor("title")}
        error={errors.title}
      >
        {(cls) => (
          <Input
            value={form.title}
            onChange={(e) => edit("title", { title: e.target.value })}
            placeholder="e.g. Lanzarote family week"
            className={cls}
            data-testid="input-enquiry-title"
          />
        )}
      </FieldBox>

      <FieldBox
        label="Holiday type"
        chip={chipFor("holidayType")}
        error={errors.holidayType}
      >
        {(cls) => (
          <SearchableSelect
            value={form.holidayType}
            onValueChange={(id) =>
              setHolidayType(
                id,
                packageTypes.find((p) => p.id === id)?.name ?? "",
              )
            }
            options={packageTypes.map((p) => ({ value: p.id, label: p.name }))}
            placeholder="Choose type"
            searchPlaceholder="Search types..."
            className={cls}
            data-testid="select-holiday-type"
          />
        )}
      </FieldBox>

      <FieldBox label="Lead source" chip={chipFor("leadSource")}>
        {(cls) => (
          <Select
            value={form.leadSource}
            onValueChange={(v) =>
              edit("leadSource", {
                leadSource:
                  LEAD_SOURCES.find((s) => s === v) ?? form.leadSource,
              })
            }
          >
            <SelectTrigger className={cls} data-testid="select-lead-source">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_SOURCES.map((s) => (
                <SelectItem key={s} value={s}>
                  {LEAD_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldBox>

      <DestinationField api={api} error={errors.destinations} />
      {kind === "package" && <ResortField api={api} />}
      {kind !== "hottub" && <AirportField api={api} error={errors.airports} />}

      <FieldBox
        label="Travel date"
        chip={chipFor("travelDate")}
        error={errors.travelDate}
      >
        {(cls) => (
          <DatePicker
            value={form.travelDate}
            onChange={(v) => edit("travelDate", { travelDate: v })}
            placeholder="Pick a date"
            className={cls}
            data-testid="input-travel-date"
          />
        )}
      </FieldBox>

      {kind !== "hottub" && (
        <FieldBox label="Flexibility" chip={chipFor("flexibility")}>
          {(cls) => (
            <Select
              value={form.flexibility}
              onValueChange={(v) => edit("flexibility", { flexibility: v })}
            >
              <SelectTrigger className={cls} data-testid="select-flexibility">
                <SelectValue placeholder="Exact date?" />
              </SelectTrigger>
              <SelectContent>
                {flexOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FieldBox>
      )}

      <FieldBox label="Nights" chip={chipFor("nights")}>
        {(cls) => (
          <Select
            value={String(form.nights)}
            onValueChange={(v) =>
              edit("nights", { nights: parseInt(v, 10) || form.nights })
            }
          >
            <SelectTrigger className={cls} data-testid="select-nights">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NIGHT_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? "night" : "nights"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldBox>

      {kind !== "hottub" && (
        <TravellersField api={api} error={errors.travellers} />
      )}

      <FieldBox label="Budget" chip={chipFor("budget")}>
        {(cls) => (
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-social-muted">
              £
            </span>
            <Input
              inputMode="decimal"
              value={form.budget}
              onChange={(e) =>
                edit("budget", {
                  budget: e.target.value.replace(/[^0-9.]/g, ""),
                })
              }
              placeholder="e.g. 3000"
              className={`${cls} pl-7`}
              data-testid="input-budget"
            />
          </div>
        )}
      </FieldBox>

      <FieldBox label="Budget type" chip={chipFor("budgetType")}>
        {(cls) => (
          <Select
            value={form.budgetType}
            onValueChange={(v) => edit("budgetType", { budgetType: v })}
          >
            <SelectTrigger className={cls} data-testid="select-budget-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_TYPES.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FieldBox>

      {kind === "package" && (
        <>
          <FieldBox label="Board basis" chip={chipFor("boardBasis")}>
            {(cls) => (
              <MultiSearchableSelect
                chipClassName="font-normal text-[12px]"
                value={form.boardBasis}
                onValueChange={(next) =>
                  edit("boardBasis", { boardBasis: next })
                }
                options={boardOptions}
                placeholder="Any board"
                searchPlaceholder="Search board basis..."
                maxChips={2}
                className={cls}
                data-testid="select-board-basis"
              />
            )}
          </FieldBox>
          <FieldBox label="Min star rating" chip={chipFor("starRating")}>
            {(cls) => (
              <Select
                value={form.starRating || "any"}
                onValueChange={(v) =>
                  edit("starRating", { starRating: v === "any" ? "" : v })
                }
              >
                <SelectTrigger className={cls} data-testid="select-star-rating">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">No minimum</SelectItem>
                  {STAR_RATINGS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FieldBox>
        </>
      )}

      <TypeExtras api={api} />

      <FieldBox label="Must have / notes" span={2} chip={chipFor("notes")}>
        {(cls) => (
          <Textarea
            rows={3}
            value={form.notes}
            onChange={(e) => edit("notes", { notes: e.target.value })}
            placeholder="e.g. Kids club, quiet area, near the beach"
            className={`${cls} h-auto min-h-[78px] resize-none py-2`}
            data-testid="input-notes"
          />
        )}
      </FieldBox>
    </div>
  );
}
