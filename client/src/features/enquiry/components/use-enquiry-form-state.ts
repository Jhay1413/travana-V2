import { useEffect, useRef, useState } from "react";
import type { LookupDestination, LookupResort } from "@/features/lookups";
import type { LookupAccommodation } from "@/features/lookups/api/lookup.api";
import { useEnquiry } from "../api/use-enquiry-queries";
import type { Enquiry } from "../types";
import {
  DEFAULT_FORM,
  fitChildAges,
  type ChipKind,
  type EnquiryForm,
  type FieldKey,
  type Sources,
} from "../lib/enquiry-form";
import {
  accommodationsPatch,
  chipForField,
  countriesPatch,
  destinationsPatch,
  holidayTypePatch,
  resortsPatch,
} from "../lib/enquiry-form-reducers";
import { enquiryToForm } from "../lib/enquiry-from-record";
import { useEnquiryLookups } from "./use-enquiry-lookups";

/** Prefilled form for the inbox: the resolved intent plus where each value came from. */
export interface EnquiryFormInit {
  form: EnquiryForm;
  sources: Sources;
  /** The title is still the auto "{destination} holiday", so it may follow the destination. */
  titleIsAuto: boolean;
}

export type EnquiryModalKind = "country" | "destination" | "resort" | "accommodation";

type AddedAccommodation = Pick<LookupAccommodation, "id" | "name" | "resorts_id" | "resort_name" | "destination_id" | "destination_name" | "country_id">;

type PartyPatch = Partial<Pick<EnquiryForm, "adults" | "children" | "infants" | "childAges">>;

/**
 * Form state for the enquiry pop-up: values, source chips (inbox), the lookups behind the pickers
 * and the country / destination / resort / accommodation linkage.
 */
export function useEnquiryFormState(args: { enquiry?: Enquiry | null; init?: EnquiryFormInit }) {
  const { enquiry, init } = args;
  const [form, setForm] = useState<EnquiryForm>(() => init?.form ?? (enquiry ? enquiryToForm(enquiry) : DEFAULT_FORM));
  const [sources, setSources] = useState<Sources | null>(() => init?.sources ?? null);
  const [touched, setTouched] = useState<ReadonlySet<FieldKey>>(() => new Set());
  // True once the user has changed a field (auto-prefill and lookup follow-ups do not count).
  const [userEdited, setUserEdited] = useState(false);
  const titleIsAuto = useRef(init?.titleIsAuto ?? false);
  const lookups = useEnquiryLookups(form);
  const [openModal, setOpenModal] = useState<EnquiryModalKind | null>(null);

  // The list row omits relations (child ages, destinations...), so edit mode fetches the full
  // enquiry and re-prefills once, when it first arrives.
  const editId = enquiry?.id ? String(enquiry.id) : "";
  const { data: fullEnquiry } = useEnquiry(editId);
  const loadedFull = useRef(false);
  useEffect(() => {
    if (!fullEnquiry || loadedFull.current) return;
    loadedFull.current = true;
    setForm(enquiryToForm(fullEnquiry));
  }, [fullEnquiry]);

  // New enquiries default to "Package Holiday"; the holiday type name always follows the id.
  const { packageTypes } = lookups;
  const isNew = !enquiry && !init;
  useEffect(() => {
    if (packageTypes.length === 0) return;
    setForm((prev) => {
      if (!prev.holidayType) {
        if (!isNew) return prev;
        const pkg = packageTypes.find((p) => p.name === "Package Holiday");
        return pkg ? { ...prev, ...holidayTypePatch(prev, pkg.id, pkg.name) } : prev;
      }
      const name = packageTypes.find((p) => p.id === prev.holidayType)?.name;
      return name && name !== prev.holidayTypeName ? { ...prev, holidayTypeName: name } : prev;
    });
  }, [packageTypes, form.holidayType, isNew]);

  const touch = (key: FieldKey) => setTouched((prev) => (prev.has(key) ? prev : new Set(prev).add(key)));

  /** Edit one field's value(s); marks it as checked by the user. */
  const edit = (key: FieldKey, patch: Partial<EnquiryForm>) => {
    if (key === "title") titleIsAuto.current = false;
    setForm((prev) => ({ ...prev, ...patch }));
    setUserEdited(true);
    touch(key);
  };

  /** Edit a field that carries no source chip. */
  const patch = (p: Partial<EnquiryForm>) => {
    setForm((prev) => ({ ...prev, ...p }));
    setUserEdited(true);
  };

  /** Applies a destination / resort patch; a followed title shows as "set for you". */
  const editLinked = (key: FieldKey, p: Partial<EnquiryForm>) => {
    if (titleIsAuto.current && p.title !== undefined) setSources((s) => (s ? { ...s, title: "set" } : s));
    edit(key, p);
  };

  const setHolidayType = (id: string, name: string) => edit("holidayType", holidayTypePatch(form, id, name));

  const pickCountries = (next: string[]) => patch(countriesPatch(form, next));

  /** `extra` lists rows just created in an "Add new" modal, which the fetched lists do not have yet. */
  const pickDestinations = (next: string[], extra: LookupDestination[] = []) =>
    editLinked(
      "destinations",
      destinationsPatch(form, next, [...extra, ...lookups.allDestinations, ...lookups.destinations], lookups.countries, titleIsAuto.current),
    );

  const pickResorts = (next: string[], extra: LookupResort[] = []) =>
    editLinked("resorts", resortsPatch(form, next, [...extra, ...lookups.resorts], lookups.countries, titleIsAuto.current));

  const pickAccommodations = (next: string[], extra: AddedAccommodation[] = []) =>
    patch(accommodationsPatch(form, next, [...extra, ...lookups.accommodations], lookups.countries));

  /** Cruises take a single destination. */
  const pickCruiseDestination = (id: string) => pickDestinations(id ? [id] : []);

  const setAirports = (next: string[]) => edit("airports", { airports: next });

  const setParty = (p: PartyPatch) => {
    const children = p.children ?? form.children;
    edit("travellers", { ...p, childAges: fitChildAges(p.childAges ?? form.childAges, children) });
  };

  const chipFor = (key: FieldKey): ChipKind | null => (sources ? chipForField(form, sources, touched, key) : null);

  /** Back to an empty form (create mode); the holiday type defaults again. */
  const reset = () => {
    titleIsAuto.current = false;
    setUserEdited(false);
    setForm(DEFAULT_FORM);
  };

  return {
    form,
    userEdited,
    lookups,
    modals: { current: openModal, open: setOpenModal, close: () => setOpenModal(null) },
    edit,
    patch,
    reset,
    setHolidayType,
    pickCountries,
    pickDestinations,
    pickResorts,
    pickAccommodations,
    pickCruiseDestination,
    setAirports,
    setParty,
    chipFor,
  };
}

export type EnquiryFormApi = ReturnType<typeof useEnquiryFormState>;
