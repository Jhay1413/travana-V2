import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { DatePicker } from "@/components/ui/date-picker";
import type { Enquiry } from "@/features/enquiry/types";
import type { EnquiryTable } from "@/features/quote/types";
import type { EnquiryIntent } from "@/features/conversations/api/ai-enquiry.api";
import { usePackageTypes, useCountries, useDestinations, useAllDestinations, useResortSearch, useBoardBasis, useAirports, useAccommodationTypes } from "@/hooks/queries";
import { useEnquiry } from "@/features/enquiry/api/use-enquiry-queries";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MultiSearchableSelect } from "@/components/ui/multi-searchable-select";
import { AddAirportModal } from "@/features/lookups/components/lookups/add-airport-modal";

const FLEXIBILITY_OPTIONS = [
  "Exact Date",
  "+/- 3 Days",
  "+/- 7 Days",
  "+ 3 Days",
  "+ 7 Days",
  "Anytime in Month",
];

const CRUISE_FLEXIBILITY_OPTIONS = [
  "Exact Date",
  "+/- 3 Days",
  "+/- 7 Days",
  "+ 3 Days",
  "+ 7 Days",
  "Any Time",
];

const STAR_RATINGS = ["2 Star", "3 Star", "4 Star", "5 Star"];

// Board basis options shown in the enquiry wizard, in display order. Matched by
// name (case-insensitive, trimmed) so it stays portable across environments.
// The near-duplicate lookup rows in the table (e.g. " All-Inclusive",
// "Self-Catering", "Bed & Breakfast") differ once normalized and are excluded.
const ALLOWED_BOARD_BASIS = [
  "All Inclusive",
  "Bed and Breakfast",
  "Self Catering",
  "Half Board",
  "Full Board",
  "Room Only",
  "Lodge",
];


const BUDGET_TYPES = ["Per Person", "Package"];


const HOT_TUB_FLEXIBILITY_OPTIONS = [
  "Exact Date",
  "+/- 3 Days",
  "+/- 7 Days",
  "+ 3 Days",
  "+ 7 Days",
  "Any Time",
];

const CABIN_TYPES = ["Inside Cabin", "Outside Cabin", "Balcony", "Suite"];

// Options for the "number of nights" multi-select — an enquiry can capture
// one or several acceptable durations (e.g. 7, 10 or 14 nights). The first
// selected value is stored as the primary no_of_nights.
const NIGHTS_MULTI_OPTIONS = Array.from({ length: 21 }, (_, i) => ({
  value: String(i + 1),
  label: `${i + 1} night${i === 0 ? "" : "s"}`,
}));

function NightsMultiField({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
      <MultiSearchableSelect
        value={value}
        onValueChange={onChange}
        options={NIGHTS_MULTI_OPTIONS}
        placeholder="Select nights..."
        searchPlaceholder="Search nights..."
        emptyMessage="No options."
        data-testid="select-nights"
      />
      <p className="text-[10px] text-black/40">Select one or more durations the customer would consider.</p>
    </div>
  );
}

interface EnquiryForm {
  enquiryTitle: string;
  holidayType: string;
  countries: string[];
  destinations: string[];
  resorts: string[];
  departureAirports: string[];
  travelDate: string;
  flexibility: string;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  childAges: number[];
  nights: number;
  /** Selected night durations (as strings). First entry is the primary no_of_nights. */
  flexibleNights: string[];
  starRating: string;
  boardBases: string[];
  budget: string;
  budgetType: string;
  notes: string;
  accommodationType: string;
  guests: number;
  pets: string;
  minBudget: string;
  maxBudget: string;
  weekendLodge: string;
  flexibleOnDate: string;
  cruiseDestination: string;
  cruiseNights: string;
  cruiseLine: string;
  cabinType: string;
  preCruiseStayDays: string;
  postCruiseStayDays: string;
  /** id -> display label cache, for rendering chips of async-fetched options */
  labels: Record<string, string>;
  /** destinationId|resortId -> countryId, for pruning when a country is removed */
  countryOf: Record<string, string>;
  /** resortId -> destinationId, for pruning when a destination is removed */
  destinationOf: Record<string, string>;
  is_test: boolean;
}

const defaultForm: EnquiryForm = {
  enquiryTitle: "",
  holidayType: "",
  countries: [],
  destinations: [],
  resorts: [],
  departureAirports: [],
  travelDate: "",
  flexibility: "",
  passengersAdults: 2,
  passengersChildren: 0,
  passengersInfants: 0,
  childAges: [],
  nights: 7,
  flexibleNights: ["7"],
  starRating: "",
  boardBases: [],
  budget: "",
  budgetType: "Per Person",
  notes: "",
  accommodationType: "",
  guests: 2,
  pets: "No",
  minBudget: "",
  maxBudget: "",
  weekendLodge: "No",
  flexibleOnDate: "No",
  cruiseDestination: "",
  cruiseNights: "",
  cruiseLine: "",
  cabinType: "",
  preCruiseStayDays: "",
  postCruiseStayDays: "",
  labels: {},
  countryOf: {},
  destinationOf: {},
  is_test: false,
};

// Lookup lists (loaded by the wizard) used to resolve the AI's free-text intent
// into the lookup IDs the form stores. Typed loosely to match the wizard's other
// lookup usages.
type LookupSets = {
  packageTypes: any[];
  countries: any[];
  destinations: any[];
  boardBasis: any[];
  airports: any[];
};

const normLower = (s: string | null | undefined) => (s || "").trim().toLowerCase();

// Maps an AI-extracted enquiry intent onto the wizard form: resolves country /
// destination / board-basis / airport / holiday-type names to IDs, keeps scalars,
// and drops anything unresolved (incl. resorts) into notes so it's never lost.
function resolveIntentToForm(intent: EnquiryIntent, lk: LookupSets): EnquiryForm {
  const labels: Record<string, string> = {};
  const countryOf: Record<string, string> = {};
  const unmapped: string[] = [];

  let holidayType = "";
  if (intent.holidayType) {
    const q = normLower(intent.holidayType);
    const pt = lk.packageTypes.find((p) => normLower(p.name) === q) || lk.packageTypes.find((p) => normLower(p.name).includes(q));
    if (pt) holidayType = pt.id;
  }

  const countries: string[] = [];
  for (const name of intent.countries) {
    const q = normLower(name);
    const c = lk.countries.find((x) => normLower(x.country_name) === q) || lk.countries.find((x) => normLower(x.country_name).includes(q));
    if (c) {
      if (!countries.includes(c.id)) countries.push(c.id);
      labels[c.id] = c.country_name;
    } else unmapped.push(`Country: ${name}`);
  }

  const destinations: string[] = [];
  for (const name of intent.destinations) {
    const q = normLower(name);
    const d =
      lk.destinations.find((x) => normLower(x.name) === q) ||
      lk.destinations.find((x) => normLower(x.name).includes(q) || q.includes(normLower(x.name)));
    if (d) {
      if (!destinations.includes(d.id)) destinations.push(d.id);
      labels[d.id] = d.name;
      if (d.country_id) {
        countryOf[d.id] = d.country_id;
        if (!countries.includes(d.country_id)) countries.push(d.country_id);
      }
    } else unmapped.push(`Destination: ${name}`);
  }

  const boardBases: string[] = [];
  for (const name of intent.boardBasis) {
    const q = normLower(name);
    const b = lk.boardBasis.find((x) => normLower(x.type) === q) || lk.boardBasis.find((x) => normLower(x.type).includes(q));
    if (b) boardBases.push(b.id);
    else unmapped.push(`Board basis: ${name}`);
  }

  const departureAirports: string[] = [];
  for (const name of intent.departureAirports) {
    const q = normLower(name);
    const a =
      lk.airports.find((x) => normLower(x.airport_name) === q || normLower(x.airport_code) === q) ||
      lk.airports.find((x) => normLower(x.airport_name).includes(q));
    if (a) {
      departureAirports.push(a.id);
      labels[a.id] = `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`;
    } else unmapped.push(`Departure airport: ${name}`);
  }

  const starRating = STAR_RATINGS.find((r) => normLower(r) === normLower(intent.starRating)) || "";
  const flexibility = FLEXIBILITY_OPTIONS.find((f) => normLower(f) === normLower(intent.flexibility)) || "";

  for (const r of intent.resorts) unmapped.push(`Resort: ${r}`);

  const nights = typeof intent.nights === "number" && intent.nights > 0 ? intent.nights : undefined;

  const noteParts: string[] = [];
  if (intent.notes?.trim()) noteParts.push(intent.notes.trim());
  if (unmapped.length) noteParts.push(`To confirm manually: ${unmapped.join("; ")}`);

  return {
    ...defaultForm,
    enquiryTitle: intent.enquiryTitle || "",
    holidayType,
    countries,
    destinations,
    boardBases,
    departureAirports,
    starRating,
    flexibility,
    travelDate: intent.travelDate || "",
    nights: nights ?? defaultForm.nights,
    flexibleNights: nights ? [String(nights)] : defaultForm.flexibleNights,
    passengersAdults: typeof intent.adults === "number" && intent.adults > 0 ? intent.adults : 2,
    passengersChildren: typeof intent.children === "number" && intent.children > 0 ? intent.children : 0,
    passengersInfants: typeof intent.infants === "number" && intent.infants > 0 ? intent.infants : 0,
    childAges: Array.isArray(intent.childAges) ? intent.childAges : [],
    budget: intent.budget || "",
    budgetType: intent.budgetType || "Per Person",
    notes: noteParts.join("\n\n"),
    labels,
    countryOf,
  };
}

function formFromEnquiry(enquiry: Enquiry): EnquiryForm {
  const destRecords = ((enquiry.destinations as any[]) || []);
  const resortRecords = ((enquiry.resorts as any[]) || []);
  const bbRecords = ((enquiry.boardBases as any[]) || []);
  const airportRecords = ((enquiry.airports as any[]) || []);

  const labels: Record<string, string> = {};
  const countryOf: Record<string, string> = {};

  const destinations: string[] = [];
  const countries: string[] = [];
  for (const d of destRecords) {
    const id = d?.destination_id || d?.destination;
    if (!id) continue;
    destinations.push(id);
    if (d?.destination_name || d?.name) labels[id] = d.destination_name || d.name;
    if (d?.country_id) {
      countryOf[id] = d.country_id;
      if (!countries.includes(d.country_id)) countries.push(d.country_id);
    }
  }

  const resorts: string[] = [];
  for (const r of resortRecords) {
    const id = r?.resorts_id || r?.resort;
    if (!id) continue;
    resorts.push(id);
    if (r?.resort_name || r?.name) labels[id] = r.resort_name || r.name;
  }

  const boardBases: string[] = [];
  for (const b of bbRecords) {
    const id = b?.board_basis_id || b?.board_basis;
    if (id) boardBases.push(id);
  }

  const departureAirports: string[] = [];
  for (const a of airportRecords) {
    const id = a?.airport_id || a?.airport;
    if (!id) continue;
    departureAirports.push(id);
    if (a?.airport_name) labels[id] = a.airport_name;
  }

  const destRecord = destRecords[0];

  return {
    enquiryTitle: enquiry.title || "",
    holidayType: enquiry.holiday_type_id || "",
    countries,
    destinations,
    resorts,
    departureAirports,
    travelDate: enquiry.travel_date || "",
    flexibility: enquiry.flexibility_date || enquiry.flexible_date || "",
    passengersAdults: enquiry.adults || 2,
    passengersChildren: enquiry.children || 0,
    passengersInfants: enquiry.infants || 0,
    childAges: (enquiry.passengers ?? [])
      .filter((p) => p.type === "child")
      .map((p) => p.age ?? 0),
    nights: enquiry.no_of_nights || 7,
    flexibleNights: Array.isArray(enquiry.flexible_nights) && enquiry.flexible_nights.length
      ? enquiry.flexible_nights.map((n) => String(n))
      : (enquiry.no_of_nights ? [String(enquiry.no_of_nights)] : []),
    starRating: enquiry.accom_min_star_rating || "",
    boardBases,
    budget: enquiry.budget || "",
    budgetType: enquiry.budget_type || "Per Person",
    notes: "",
    accommodationType: enquiry.accomodation_type_id || "",
    guests: enquiry.no_of_guests || 2,
    pets: enquiry.no_of_pets ? String(enquiry.no_of_pets) : "No",
    minBudget: enquiry.budget || "",
    maxBudget: enquiry.max_budget || "",
    weekendLodge: enquiry.weekend_lodge || "No",
    flexibleOnDate: enquiry.flexible_date || "No",
    cruiseDestination: destRecord?.destination_id || destRecord?.destination || "",
    cruiseNights: enquiry.no_of_nights ? String(enquiry.no_of_nights) : "",
    cruiseLine: "",
    cabinType: enquiry.cabin_type || "",
    preCruiseStayDays: enquiry.pre_cruise_stay ? String(enquiry.pre_cruise_stay) : "",
    postCruiseStayDays: enquiry.post_cruise_stay ? String(enquiry.post_cruise_stay) : "",
    labels,
    countryOf,
    destinationOf: {},
    is_test: (enquiry as any).is_test ?? false,
  };
}

interface EnquiryWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiry?: Enquiry | null;
  onSubmit: (data: Partial<EnquiryTable>) => void;
  isSaving: boolean;
  /** AI-drafted intent to pre-fill a NEW enquiry (resolved to lookup IDs on open). */
  aiPrefill?: EnquiryIntent | null;
}

type StepDef = { title: string; description: string };

const PACKAGE_STEPS: StepDef[] = [
  { title: "Holiday Details", description: "What kind of holiday are you looking for?" },
  { title: "Travel & Passengers", description: "When and who is travelling?" },
  { title: "Accommodation & Budget", description: "Accommodation preferences and budget." },
];

const HOT_TUB_STEPS: StepDef[] = [
  { title: "Holiday Details", description: "Tell us about your hot tub break." },
  { title: "Guests & Budget", description: "Who's going and what's the budget?" },
  { title: "Stay & Dates", description: "Duration and date preferences." },
];

const CRUISE_STEPS: StepDef[] = [
  { title: "Cruise Details", description: "Tell us about the cruise." },
  { title: "Budget & Passengers", description: "Budget and who's travelling?" },
  { title: "Cruise Preferences", description: "Cruise line and cabin preferences." },
];

function getSteps(holidayType: string): StepDef[] {
  if (holidayType === "Hot Tub Break") return HOT_TUB_STEPS;
  if (holidayType === "Cruise Package") return CRUISE_STEPS;
  return PACKAGE_STEPS;
}

export function EnquiryWizard({ open, onOpenChange, enquiry, onSubmit, isSaving, aiPrefill }: EnquiryWizardProps) {
  const isEdit = !!enquiry;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EnquiryForm>(defaultForm);
  const [direction, setDirection] = useState(1);
  const [resortSearch, setResortSearch] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [showAddAirport, setShowAddAirport] = useState(false);
  const [addedAirportLabels, setAddedAirportLabels] = useState<Record<string, string>>({});

  const primaryCountry = form.countries[0];
  const primaryDestination = form.destinations[0];

  const { data: countriesData } = useCountries();
  const { data: singleCountryDestinations } = useDestinations(
    form.countries.length === 1 ? primaryCountry : undefined,
  );
  const { data: allDestinationsData } = useAllDestinations();
  const destinationsData = form.countries.length === 1 ? singleCountryDestinations : allDestinationsData;
  // While the user is typing a search, ignore the selected destination/country pivot
  // so they can find ANY resort. With no search term, scope to the selected
  // destination (or country) to give a sensible default list.
  const { data: resortsData } = useResortSearch(
    resortSearch,
    resortSearch ? undefined : primaryDestination || undefined,
    resortSearch || primaryDestination ? undefined : primaryCountry || undefined,
  );
  const { data: boardBasisData } = useBoardBasis();
  const { data: airportsData } = useAirports();
  const { data: packageTypesData } = usePackageTypes();
  const { data: accommodationTypesData } = useAccommodationTypes();

  const holidayTypeName = useMemo(() => {
    if (!form.holidayType || !packageTypesData) return "";
    const pt = packageTypesData.find((p: any) => p.id === form.holidayType);
    return pt?.name || "";
  }, [form.holidayType, packageTypesData]);

  const steps = useMemo(() => getSteps(holidayTypeName), [holidayTypeName]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(enquiry ? formFromEnquiry(enquiry) : defaultForm);
      setDirection(1);
      setResortSearch("");
    }
  }, [open, enquiry]);

  // Some callers (e.g. the client page) open the wizard with a list-row enquiry
  // that omits relations like `passengers` (child ages), `destinations`, etc. —
  // the list endpoint doesn't load them. Fetch the full enquiry with relations
  // and re-prefill once it arrives so those fields populate when editing.
  const editId = enquiry?.id ? String(enquiry.id) : "";
  const { data: fullEnquiry } = useEnquiry(open && editId ? editId : "");
  useEffect(() => {
    if (open && fullEnquiry) {
      setForm(formFromEnquiry(fullEnquiry));
    }
  }, [open, fullEnquiry]);

  const set = (key: keyof EnquiryForm, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

  // Default the Holiday Type to "Package Holiday" for new enquiries once the
  // lookup loads. Options are keyed by id, so we resolve the name to its id.
  useEffect(() => {
    if (!open || enquiry || !packageTypesData) return;
    setForm((prev) => {
      if (prev.holidayType) return prev;
      const pkg = packageTypesData.find((p: any) => p.name === "Package Holiday");
      return pkg ? { ...prev, holidayType: pkg.id } : prev;
    });
  }, [open, enquiry, packageTypesData]);

  // Keep childAges array length in sync with passengersChildren
  useEffect(() => {
    const count = form.passengersChildren;
    setForm((prev) => {
      const current = prev.childAges;
      if (current.length === count) return prev;
      const next =
        count > current.length
          ? [...current, ...Array(count - current.length).fill(0)]
          : current.slice(0, count);
      return { ...prev, childAges: next };
    });
  }, [form.passengersChildren]); // eslint-disable-line react-hooks/exhaustive-deps

  // AI pre-fill: once the lookup lists are loaded, resolve the drafted intent into
  // the form. Runs after the reset/default effects so it wins for a new enquiry.
  useEffect(() => {
    if (!open || !aiPrefill) return;
    if (!packageTypesData || !countriesData || !allDestinationsData || !boardBasisData || !airportsData) return;
    setForm(
      resolveIntentToForm(aiPrefill, {
        packageTypes: packageTypesData,
        countries: countriesData,
        destinations: allDestinationsData,
        boardBasis: boardBasisData,
        airports: airportsData,
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, aiPrefill, packageTypesData, countriesData, allDestinationsData, boardBasisData, airportsData]);

  // ----- Multi-select handlers (Country / Destination / Resort) -----

  const handleCountriesChange = (next: string[]) => {
    setForm((prev) => {
      const removed = prev.countries.filter((c) => !next.includes(c));
      if (removed.length === 0) return { ...prev, countries: next };
      // Prune destinations/resorts that belonged only to removed countries
      const destinations = prev.destinations.filter((d) => {
        const c = prev.countryOf[d];
        return !c || next.includes(c);
      });
      const resorts = prev.resorts.filter((r) => {
        const c = prev.countryOf[r];
        return !c || next.includes(c);
      });
      return { ...prev, countries: next, destinations, resorts };
    });
  };

  const handleDestinationsChange = (next: string[]) => {
    setForm((prev) => {
      const removed = prev.destinations.filter((d) => !next.includes(d));
      const labels = { ...prev.labels };
      const countryOf = { ...prev.countryOf };
      for (const id of next) {
        if (!labels[id]) {
          const d = (destinationsData || []).find((x: any) => x.id === id);
          if (d) {
            labels[id] = d.name;
            if (d.country_id) countryOf[id] = d.country_id;
          }
        }
      }
      let resorts = prev.resorts;
      if (removed.length) {
        resorts = prev.resorts.filter((r) => {
          const dest = prev.destinationOf[r];
          return !dest || next.includes(dest);
        });
      }
      return { ...prev, destinations: next, resorts, labels, countryOf };
    });
  };

  const handleResortsChange = (next: string[]) => {
    setForm((prev) => {
      const labels = { ...prev.labels };
      const countryOf = { ...prev.countryOf };
      const destinationOf = { ...prev.destinationOf };
      const destinations = [...prev.destinations];
      const countries = [...prev.countries];
      const added = next.filter((r) => !prev.resorts.includes(r));
      for (const id of added) {
        const r = (resortsData || []).find((x: any) => x.id === id);
        if (!r) continue;
        labels[id] = r.name;
        if (r.destination_id) {
          destinationOf[id] = r.destination_id;
          if (!destinations.includes(r.destination_id)) {
            destinations.push(r.destination_id);
            if (r.destination_name) labels[r.destination_id] = r.destination_name;
          }
          if (r.country_id) countryOf[r.destination_id] = r.country_id;
        }
        if (r.country_id) {
          countryOf[id] = r.country_id;
          if (!countries.includes(r.country_id)) countries.push(r.country_id);
        }
      }
      return { ...prev, resorts: next, destinations, countries, labels, countryOf, destinationOf };
    });
  };

  // Every airport, so an imported or hand-picked departure is always selectable.
  const airportOptions = (airportsData || []).map((a) => ({
    value: a.id,
    label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
  }));
  const airportLabels = (airportsData || []).reduce<Record<string, string>>((acc, a) => {
    acc[a.id] = `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`;
    return acc;
  }, { ...form.labels, ...addedAirportLabels });

  const canProceed = () => {
    if (step === 0) return form.enquiryTitle.trim() !== "" && form.holidayType !== "";
    return true;
  };

  const handleNext = () => {
    if (step < 2) {
      setDirection(1);
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setDirection(-1);
      setStep(step - 1);
    }
  };

  const handleSubmit = () => {
    if (isSaving) return;
    // The "Number of Nights" field is a multi-select. All chosen durations are
    // stored in flexible_nights; the first one is the primary no_of_nights.
    const selectedNights = form.flexibleNights.map(Number).filter((n) => !Number.isNaN(n));
    const primaryNights = selectedNights[0];
    const flexibleNights = selectedNights.length ? selectedNights : undefined;

    const base: Record<string, any> = {
      title: form.enquiryTitle,
      holiday_type_id: form.holidayType,
      notes: form.notes || undefined,
      is_test: form.is_test,
    };

    if (holidayTypeName === "Hot Tub Break") {
      Object.assign(base, {
        budget: form.minBudget || form.maxBudget || undefined,
        max_budget: form.maxBudget || undefined,
        budget_type: form.budgetType || undefined,
        no_of_nights: primaryNights ?? undefined,
        flexible_nights: flexibleNights,
        no_of_guests: form.guests || undefined,
        no_of_pets: form.pets !== "No" ? parseInt(form.pets) || 0 : 0,
        travel_date: form.travelDate || undefined,
        flexible_date: form.flexibleOnDate || undefined,
        weekend_lodge: form.weekendLodge || undefined,
        accomodation_type_id: form.accommodationType || undefined,
        destinations: form.destinations.length ? form.destinations : undefined,
      });
    } else if (holidayTypeName === "Cruise Package") {
      const cruiseChildPassengers = form.childAges.map((age) => ({ type: "child", age }));
      Object.assign(base, {
        travel_date: form.travelDate || undefined,
        no_of_nights: primaryNights ?? undefined,
        flexible_nights: flexibleNights,
        budget: form.minBudget || form.maxBudget || undefined,
        max_budget: form.maxBudget || undefined,
        budget_type: form.budgetType || undefined,
        adults: form.passengersAdults,
        children: form.passengersChildren,
        infants: form.passengersInfants,
        cabin_type: form.cabinType || undefined,
        pre_cruise_stay: form.preCruiseStayDays ? parseInt(form.preCruiseStayDays) : undefined,
        post_cruise_stay: form.postCruiseStayDays ? parseInt(form.postCruiseStayDays) : undefined,
        destinations: form.cruiseDestination ? [form.cruiseDestination] : undefined,
        departureAirports: form.departureAirports.length ? form.departureAirports : undefined,
        passengers: cruiseChildPassengers.length ? cruiseChildPassengers : undefined,
      });
    } else {
      const childPassengers = form.childAges.map((age) => ({ type: "child", age }));
      Object.assign(base, {
        travel_date: form.travelDate || undefined,
        adults: form.passengersAdults,
        children: form.passengersChildren,
        infants: form.passengersInfants,
        no_of_nights: primaryNights ?? undefined,
        flexible_nights: flexibleNights,
        budget: form.budget || undefined,
        budget_type: form.budgetType || undefined,
        accom_min_star_rating: form.starRating || undefined,
        flexibility_date: form.flexibility || undefined,
        destinations: form.destinations.length ? form.destinations : undefined,
        resorts: form.resorts.length ? form.resorts : undefined,
        boardBases: form.boardBases.length ? form.boardBases : undefined,
        departureAirports: form.departureAirports.length ? form.departureAirports : undefined,
        passengers: childPassengers.length ? childPassengers : undefined,
      });
    }

    onSubmit(base);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const isHotTub = holidayTypeName === "Hot Tub Break";
  const isCruise = holidayTypeName === "Cruise Package";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-enquiry-wizard">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold" data-testid="text-wizard-title">
            {isEdit ? <Pencil className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
            {isEdit ? "Edit Enquiry" : "New Enquiry"}
          </DialogTitle>
          <DialogDescription className="text-sm text-black/55" data-testid="text-wizard-description">
            {steps[step].description}
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-2" data-testid="row-wizard-steps">
          {steps.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                if (idx < step || (idx <= step + 1 && canProceed())) {
                  setDirection(idx > step ? 1 : -1);
                  setStep(idx);
                }
              }}
              className={`flex flex-1 items-center gap-1.5 rounded-full px-2 py-1.5 text-[11px] font-semibold transition ${
                idx === step
                  ? "bg-black text-white"
                  : idx < step
                    ? "bg-black/10 text-black/70"
                    : "bg-black/[0.04] text-black/40"
              }`}
              data-testid={`button-wizard-step-${idx}`}
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                idx === step ? "bg-white text-black" : idx < step ? "bg-black/20 text-white" : "bg-black/10 text-black/40"
              }`}>
                {idx + 1}
              </span>
              <span className="hidden sm:inline">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="relative min-h-[260px]" data-testid="section-wizard-content">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${form.holidayType}-${step}`}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="grid gap-4"
            >
              {/* ===== STEP 0 ===== */}
              {step === 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Enquiry Title *</Label>
                    <Input
                      placeholder={
                        isHotTub ? "e.g. Lake District Hot Tub Weekend" :
                        isCruise ? "e.g. Mediterranean Cruise" :
                        "e.g. Maldives Family Holiday"
                      }
                      value={form.enquiryTitle}
                      onChange={(e) => set("enquiryTitle", e.target.value)}
                      className="h-10 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-enquiry-title"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Holiday Type *</Label>
                    <Select value={form.holidayType} onValueChange={(v) => set("holidayType", v)}>
                      <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-holiday-type">
                        <SelectValue placeholder="Select holiday type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {(packageTypesData || []).map((pt: any) => (
                          <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isHotTub && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Accommodation Type</Label>
                        <Select value={form.accommodationType} onValueChange={(v) => set("accommodationType", v)}>
                          <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-accommodation-type">
                            <SelectValue placeholder="Select accommodation type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(accommodationTypesData || []).map((t: any) => (
                              <SelectItem key={t.id} value={t.id}>{t.type}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Destinations</Label>
                        <MultiSearchableSelect
                          value={form.destinations}
                          onValueChange={handleDestinationsChange}
                          selectedLabels={form.labels}
                          options={(allDestinationsData || []).map((d: any) => ({ value: d.id, label: d.name }))}
                          placeholder="Search destinations..."
                          searchPlaceholder="Search destinations..."
                          emptyMessage="No destinations found."
                          data-testid="select-enquiry-destination"
                        />
                      </div>
                    </>
                  )}

                  {isCruise && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Cruise Destination</Label>
                        <SearchableSelect
                          value={form.cruiseDestination}
                          onValueChange={(v) => {
                            const label = (allDestinationsData || []).find((d: any) => d.id === v)?.name || "";
                            setForm((prev) => ({ ...prev, cruiseDestination: v, labels: { ...prev.labels, [v]: label } }));
                          }}
                          selectedLabel={form.labels[form.cruiseDestination]}
                          options={(allDestinationsData || []).map((d: any) => ({ value: d.id, label: d.name }))}
                          placeholder="Search destinations..."
                          searchPlaceholder="Search destinations..."
                          emptyMessage="No destinations found."
                          data-testid="select-cruise-destination"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                          <DatePicker
                            value={form.travelDate}
                            onChange={(v) => set("travelDate", v)}
                            placeholder="Pick a date"
                            data-testid="input-travel-date"
                          />
                        </div>
                        <NightsMultiField value={form.flexibleNights} onChange={(v) => set("flexibleNights", v)} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Flexibility</Label>
                        <Select value={form.flexibility} onValueChange={(v) => set("flexibility", v)}>
                          <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-flexibility">
                            <SelectValue placeholder="Select flexibility..." />
                          </SelectTrigger>
                          <SelectContent>
                            {CRUISE_FLEXIBILITY_OPTIONS.map((f) => (
                              <SelectItem key={f} value={f}>{f}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {!isHotTub && !isCruise && (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Countries</Label>
                        <MultiSearchableSelect
                          value={form.countries}
                          onValueChange={handleCountriesChange}
                          options={(countriesData || []).map((c: any) => ({ value: c.id, label: c.country_name }))}
                          placeholder="Select ..."
                          searchPlaceholder="Search countries..."
                          emptyMessage="No countries found."
                          data-testid="select-enquiry-country"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Destinations</Label>
                        <MultiSearchableSelect
                          value={form.destinations}
                          onValueChange={handleDestinationsChange}
                          selectedLabels={form.labels}
                          options={(destinationsData || []).map((d: any) => ({ value: d.id, label: d.name }))}
                          placeholder="Select ..."
                          searchPlaceholder="Search destinations..."
                          emptyMessage="No destinations found."
                          data-testid="select-enquiry-destination"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Resorts</Label>
                        <MultiSearchableSelect
                          value={form.resorts}
                          onValueChange={handleResortsChange}
                          selectedLabels={form.labels}
                          options={(resortsData || []).map((r: any) => ({ value: r.id, label: r.name }))}
                          onSearch={setResortSearch}
                          placeholder="Search ..."
                          searchPlaceholder="Search resorts..."
                          emptyMessage="No resorts found."
                          data-testid="select-enquiry-resort"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about the holiday details..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step0"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 1: HOT TUB ===== */}
              {step === 1 && isHotTub && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Guests</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.guests}
                        onChange={(e) => set("guests", parseInt(e.target.value) || 1)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-guests"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Pets</Label>
                      <Select value={form.pets} onValueChange={(v) => set("pets", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-pets">
                          <SelectValue placeholder="Pets?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Min Budget (£)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">£</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="0.00"
                          value={form.minBudget}
                          onChange={(e) => set("minBudget", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70 pl-7"
                          data-testid="input-min-budget"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Max Budget (£)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">£</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="0.00"
                          value={form.maxBudget}
                          onChange={(e) => set("maxBudget", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70 pl-7"
                          data-testid="input-max-budget"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Budget Type</Label>
                    <Select value={form.budgetType} onValueChange={(v) => set("budgetType", v)}>
                      <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-budget-type">
                        <SelectValue placeholder="Select type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_TYPES.map((bt) => (
                          <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about guests or budget..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step1"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 1: CRUISE ===== */}
              {step === 1 && isCruise && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Min Budget (£)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">£</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="0.00"
                          value={form.minBudget}
                          onChange={(e) => set("minBudget", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70 pl-7"
                          data-testid="input-min-budget"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Max Budget (£)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">£</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="0.00"
                          value={form.maxBudget}
                          onChange={(e) => set("maxBudget", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70 pl-7"
                          data-testid="input-max-budget"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Budget Type</Label>
                    <Select value={form.budgetType} onValueChange={(v) => set("budgetType", v)}>
                      <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-budget-type">
                        <SelectValue placeholder="Per person or package..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BUDGET_TYPES.map((bt) => (
                          <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Adults</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.passengersAdults}
                        onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-adults"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Children</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.passengersChildren}
                        onChange={(e) => set("passengersChildren", parseInt(e.target.value) || 0)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-children"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Infants</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.passengersInfants}
                        onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-infants"
                      />
                    </div>
                  </div>
                  {form.passengersChildren > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Child Ages</Label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: form.passengersChildren }, (_, i) => (
                          <Input
                            key={i}
                            type="number"
                            min={0}
                            max={17}
                            value={form.childAges[i] ?? 0}
                            onChange={(e) => {
                              const next = [...form.childAges];
                              next[i] = parseInt(e.target.value) || 0;
                              set("childAges", next);
                            }}
                            className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                            placeholder={`Child ${i + 1}`}
                            data-testid={`input-child-age-${i}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about budget or passengers..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step1"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 1: PACKAGE / OTHERS ===== */}
              {step === 1 && !isHotTub && !isCruise && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Airports</Label>
                    <MultiSearchableSelect
                      value={form.departureAirports}
                      onValueChange={(v) => set("departureAirports", v)}
                      selectedLabels={airportLabels}
                      options={airportOptions}
                      placeholder="Select airports..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      onSearchCapture={setAirportSearch}
                      onAddNew={airportSearch ? () => setShowAddAirport(true) : undefined}
                      addNewLabel="Add Airport"
                      data-testid="input-departure-airport"
                    />
                    <AddAirportModal
                      open={showAddAirport}
                      onOpenChange={setShowAddAirport}
                      initialName={airportSearch}
                      onSuccess={(airport) => {
                        const label = `${airport.airport_name}${airport.airport_code ? ` (${airport.airport_code})` : ""}`;
                        setAddedAirportLabels((prev) => ({ ...prev, [airport.id]: label }));
                        setForm((prev) => ({
                          ...prev,
                          departureAirports: [...prev.departureAirports, airport.id],
                        }));
                        setAirportSearch("");
                      }}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                      <DatePicker
                        value={form.travelDate}
                        onChange={(v) => set("travelDate", v)}
                        placeholder="Pick a date"
                        data-testid="input-travel-date"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Flexibility</Label>
                      <Select value={form.flexibility} onValueChange={(v) => set("flexibility", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-flexibility">
                          <SelectValue placeholder="Select flexibility..." />
                        </SelectTrigger>
                        <SelectContent>
                          {FLEXIBILITY_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Adults</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.passengersAdults}
                        onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-adults"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Children</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.passengersChildren}
                        onChange={(e) => set("passengersChildren", parseInt(e.target.value) || 0)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-children"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Infants</Label>
                      <Input
                        type="number"
                        min={0}
                        value={form.passengersInfants}
                        onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-infants"
                      />
                    </div>
                  </div>
                  {form.passengersChildren > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Child Ages</Label>
                      <div className="flex flex-wrap gap-2">
                        {Array.from({ length: form.passengersChildren }, (_, i) => (
                          <Input
                            key={i}
                            type="number"
                            min={0}
                            max={17}
                            value={form.childAges[i] ?? 0}
                            onChange={(e) => {
                              const next = [...form.childAges];
                              next[i] = parseInt(e.target.value) || 0;
                              set("childAges", next);
                            }}
                            className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                            placeholder={`Child ${i + 1}`}
                            data-testid={`input-child-age-${i}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about travel or passengers..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step1"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 2: HOT TUB ===== */}
              {step === 2 && isHotTub && (
                <>
                  <NightsMultiField value={form.flexibleNights} onChange={(v) => set("flexibleNights", v)} />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Weekend Lodge</Label>
                      <Select value={form.weekendLodge} onValueChange={(v) => set("weekendLodge", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-weekend-lodge">
                          <SelectValue placeholder="Weekend lodge?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Flexible on Date</Label>
                      <Select value={form.flexibleOnDate} onValueChange={(v) => set("flexibleOnDate", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-flexible-on-date">
                          <SelectValue placeholder="Flexible?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {form.flexibleOnDate === "Yes" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Flexibility Options</Label>
                      <Select value={form.flexibility} onValueChange={(v) => set("flexibility", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-flexibility">
                          <SelectValue placeholder="Select flexibility..." />
                        </SelectTrigger>
                        <SelectContent>
                          {HOT_TUB_FLEXIBILITY_OPTIONS.map((f) => (
                            <SelectItem key={f} value={f}>{f}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                    <DatePicker
                      value={form.travelDate}
                      onChange={(v) => set("travelDate", v)}
                      placeholder="Pick a date"
                      data-testid="input-travel-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about the stay or dates..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step2"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 2: CRUISE ===== */}
              {step === 2 && isCruise && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Line</Label>
                    <Input
                      placeholder="e.g. Royal Caribbean, MSC, P&O"
                      value={form.cruiseLine}
                      onChange={(e) => set("cruiseLine", e.target.value)}
                      className="h-10 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-cruise-line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cabin Type</Label>
                    <Select value={form.cabinType} onValueChange={(v) => set("cabinType", v)}>
                      <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-cabin-type">
                        <SelectValue placeholder="Select cabin type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {CABIN_TYPES.map((ct) => (
                          <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Pre-Cruise Stay Days</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={form.preCruiseStayDays}
                        onChange={(e) => set("preCruiseStayDays", e.target.value)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-pre-cruise-days"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Post-Cruise Stay Days</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={form.postCruiseStayDays}
                        onChange={(e) => set("postCruiseStayDays", e.target.value)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-post-cruise-days"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about cruise preferences..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step2"
                    />
                  </div>
                </>
              )}

              {/* ===== STEP 2: PACKAGE / OTHERS ===== */}
              {step === 2 && !isHotTub && !isCruise && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <NightsMultiField value={form.flexibleNights} onChange={(v) => set("flexibleNights", v)} />
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Min Star Rating</Label>
                      <Select value={form.starRating} onValueChange={(v) => set("starRating", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-star-rating">
                          <SelectValue placeholder="Select rating..." />
                        </SelectTrigger>
                        <SelectContent>
                          {STAR_RATINGS.map((r) => (
                            <SelectItem key={r} value={r}>{r}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                    <MultiSearchableSelect
                      value={form.boardBases}
                      onValueChange={(v) => set("boardBases", v)}
                      options={ALLOWED_BOARD_BASIS
                        .map((name) =>
                          (boardBasisData || []).find(
                            (b: any) => (b.type || "").trim().toLowerCase() === name.toLowerCase(),
                          ),
                        )
                        .filter(Boolean)
                        .map((b: any) => ({ value: b.id, label: (b.type || "").trim() }))}
                      placeholder="Select board basis..."
                      searchPlaceholder="Search board basis..."
                      emptyMessage="No board basis found."
                      data-testid="select-board-basis"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Budget</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-black/50">£</span>
                        <Input
                          type="number"
                          min={0}
                          step={50}
                          placeholder="0.00"
                          value={form.budget}
                          onChange={(e) => set("budget", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70 pl-7"
                          data-testid="input-budget"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Budget Type</Label>
                      <Select value={form.budgetType} onValueChange={(v) => set("budgetType", v)}>
                        <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-budget-type">
                          <SelectValue placeholder="Select type..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BUDGET_TYPES.map((bt) => (
                            <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Notes</Label>
                    <Textarea
                      placeholder="Any notes about accommodation or budget..."
                      value={form.notes}
                      onChange={(e) => set("notes", e.target.value)}
                      rows={2}
                      className="resize-none rounded-xl border-black/10 bg-white/70 text-sm"
                      data-testid="textarea-enquiry-notes-step2"
                    />
                  </div>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {step === 2 && (
          <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 mb-4">
            <Switch checked={form.is_test} onCheckedChange={(v) => set("is_test", v)} />
            <div>
              <p className="text-sm font-medium text-orange-700">Test Enquiry</p>
              <p className="text-xs text-orange-500">Will not appear in pipeline, stats, or generate social posts</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-black/10 pt-4" data-testid="row-wizard-actions">
          <Button
            variant="outline"
            size="sm"
            onClick={step === 0 ? () => onOpenChange(false) : handleBack}
            className="h-9 rounded-2xl border-black/10 px-4 text-xs font-semibold"
            data-testid="button-wizard-back"
          >
            {step === 0 ? "Cancel" : (
              <>
                <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                Back
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-black/40" data-testid="text-wizard-step-indicator">
              Step {step + 1} of 3
            </span>
            {step < 2 ? (
              <Button
                size="sm"
                onClick={handleNext}
                disabled={!canProceed()}
                className="h-9 rounded-2xl bg-black px-4 text-xs font-semibold text-white hover:bg-black/90"
                data-testid="button-wizard-next"
              >
                Next
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={isSaving || !canProceed()}
                className="h-9 rounded-2xl bg-[#3b82f6] px-4 text-xs font-semibold text-white hover:bg-[#3b82f6]/90 disabled:opacity-70"
                data-testid="button-wizard-submit"
              >
                {isSaving ? (
                  <>
                    <Spinner className="mr-1.5 h-3.5 w-3.5" />
                    Saving...
                  </>
                ) : isEdit ? "Update Enquiry" : "Create Enquiry"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
