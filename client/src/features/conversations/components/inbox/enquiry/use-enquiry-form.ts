import { useRef, useState } from "react";
import type { LookupCountry, LookupDestination, LookupResort } from "@/features/lookups";
import { fitChildAges, type EnquiryForm, type FieldKey, type Sources } from "./lib/enquiry-form";
import { chipForField, destinationsPatch, holidayTypePatch, resortsPatch } from "./lib/form-reducers";
import type { ResolvedIntent } from "./lib/resolve-intent";
import type { ChipKind } from "./source-chip";

/** Form state for the drawer: edits, source chips, and the destination/resort linkage. */
export function useEnquiryForm(initial: ResolvedIntent) {
  const [form, setForm] = useState<EnquiryForm>(initial.form);
  const [sources, setSources] = useState<Sources>(initial.sources);
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(() => new Set());
  const titleIsAuto = useRef(initial.titleIsAuto);

  const touch = (key: FieldKey) => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  /** Edit one field's value(s); marks it as checked by the user. */
  const edit = (key: FieldKey, patch: Partial<EnquiryForm>) => {
    if (key === "title") titleIsAuto.current = false;
    setForm((prev) => ({ ...prev, ...patch }));
    touch(key);
  };

  /** Edit without a source chip (extras for hot tub / cruise). */
  const patch = (p: Partial<EnquiryForm>) => setForm((prev) => ({ ...prev, ...p }));

  const setHolidayType = (id: string, name: string) => edit("holidayType", holidayTypePatch(form, id, name));

  /** Applies a destination/resort patch; a followed title shows as "set for you". */
  const editLinked = (key: FieldKey, p: Partial<EnquiryForm>) => {
    if (titleIsAuto.current && p.title !== undefined) setSources((s) => ({ ...s, title: "set" }));
    edit(key, p);
  };

  const pickDestinations = (next: string[], known: LookupDestination[], countries: LookupCountry[]) =>
    editLinked("destinations", destinationsPatch(form, next, known, countries, titleIsAuto.current));

  const pickResorts = (next: string[], known: LookupResort[], countries: LookupCountry[]) =>
    editLinked("resorts", resortsPatch(form, next, known, countries, titleIsAuto.current));

  const setTravellers = (patch: Partial<Pick<EnquiryForm, "adults" | "children" | "infants" | "childAges">>) => {
    const children = patch.children ?? form.children;
    edit("travellers", { ...patch, childAges: fitChildAges(patch.childAges ?? form.childAges, children) });
  };

  const chipFor = (key: FieldKey): ChipKind | null => chipForField(form, sources, touched, key);

  return { form, edit, patch, setHolidayType, pickDestinations, pickResorts, setTravellers, chipFor };
}

export type EnquiryFormApi = ReturnType<typeof useEnquiryForm>;
