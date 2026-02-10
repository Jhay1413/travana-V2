import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Sparkles, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import type { Enquiry, CreateEnquiryData } from "@/types/enquiry";

const HOLIDAY_TYPES = [
  "Package Holiday",
  "Hot Tub Break",
  "Cruise Package",
  "Others",
];

const FLEXIBILITY_OPTIONS = [
  "Exact Date",
  "+/- 3 Days",
  "+/- 7 Days",
  "+ 3 Days",
  "+ 7 Days",
  "Anytime in Month",
];

const STAR_RATINGS = ["2 Star", "3 Star", "4 Star", "5 Star"];

const BOARD_BASIS_OPTIONS = [
  "Room Only",
  "Bed and Breakfast",
  "Half Board",
  "Full Board",
  "All Inclusive",
  "Ultra All-Inclusive",
  "Self Catering",
];

const BUDGET_TYPES = ["Per Person", "Package"];

const ACCOMMODATION_TYPES = ["Lodge", "Cottage", "Hotel"];

const HOT_TUB_FLEXIBILITY_OPTIONS = [
  "Exact Date",
  "+/- 3 Days",
  "+/- 7 Days",
  "+ 3 Days",
  "+ 7 Days",
  "Anytime",
];

interface EnquiryForm {
  enquiryTitle: string;
  holidayType: string;
  country: string;
  destination: string;
  resort: string;
  departureAirport: string;
  travelDate: string;
  flexibility: string;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  nights: number;
  starRating: string;
  boardBasis: string;
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
}

const defaultForm: EnquiryForm = {
  enquiryTitle: "",
  holidayType: "",
  country: "",
  destination: "",
  resort: "",
  departureAirport: "",
  travelDate: "",
  flexibility: "",
  passengersAdults: 2,
  passengersChildren: 0,
  passengersInfants: 0,
  nights: 7,
  starRating: "",
  boardBasis: "",
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
};

function formFromEnquiry(enquiry: Enquiry): EnquiryForm {
  return {
    enquiryTitle: enquiry.enquiryTitle,
    holidayType: enquiry.holidayType,
    country: enquiry.country || "",
    destination: enquiry.destination || "",
    resort: enquiry.resort || "",
    departureAirport: enquiry.departureAirport || "",
    travelDate: enquiry.travelDate || "",
    flexibility: enquiry.flexibility || "",
    passengersAdults: enquiry.passengersAdults,
    passengersChildren: enquiry.passengersChildren,
    passengersInfants: enquiry.passengersInfants,
    nights: enquiry.nights || 7,
    starRating: enquiry.starRating || "",
    boardBasis: enquiry.boardBasis || "",
    budget: enquiry.budget || "",
    budgetType: enquiry.budgetType || "Per Person",
    notes: enquiry.notes || "",
    accommodationType: (enquiry as any).accommodationType || "",
    guests: (enquiry as any).guests || 2,
    pets: (enquiry as any).pets || "No",
    minBudget: (enquiry as any).minBudget || "",
    maxBudget: (enquiry as any).maxBudget || "",
    weekendLodge: (enquiry as any).weekendLodge || "No",
    flexibleOnDate: (enquiry as any).flexibleOnDate || "No",
  };
}

interface EnquiryWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enquiry?: Enquiry | null;
  onSubmit: (data: Partial<CreateEnquiryData>) => void;
  isSaving: boolean;
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

function getSteps(holidayType: string): StepDef[] {
  if (holidayType === "Hot Tub Break") return HOT_TUB_STEPS;
  return PACKAGE_STEPS;
}

export function EnquiryWizard({ open, onOpenChange, enquiry, onSubmit, isSaving }: EnquiryWizardProps) {
  const isEdit = !!enquiry;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<EnquiryForm>(defaultForm);
  const [direction, setDirection] = useState(1);

  const steps = useMemo(() => getSteps(form.holidayType), [form.holidayType]);

  useEffect(() => {
    if (open) {
      setStep(0);
      setForm(enquiry ? formFromEnquiry(enquiry) : defaultForm);
      setDirection(1);
    }
  }, [open, enquiry]);

  const set = (key: keyof EnquiryForm, val: any) => setForm((prev) => ({ ...prev, [key]: val }));

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
    const base: Partial<CreateEnquiryData> = {
      enquiryTitle: form.enquiryTitle,
      holidayType: form.holidayType,
      notes: form.notes || undefined,
    };

    if (form.holidayType === "Hot Tub Break") {
      Object.assign(base, {
        accommodationType: form.accommodationType || undefined,
        destination: form.destination || undefined,
        guests: form.guests,
        pets: form.pets || undefined,
        minBudget: form.minBudget || undefined,
        maxBudget: form.maxBudget || undefined,
        budget: form.minBudget || undefined,
        budgetType: form.budgetType || undefined,
        nights: form.nights || undefined,
        weekendLodge: form.weekendLodge || undefined,
        flexibleOnDate: form.flexibleOnDate || undefined,
        flexibility: form.flexibleOnDate === "Yes" ? form.flexibility : undefined,
        travelDate: form.travelDate || undefined,
      });
    } else {
      Object.assign(base, {
        country: form.country || undefined,
        destination: form.destination || undefined,
        resort: form.resort || undefined,
        departureAirport: form.departureAirport || undefined,
        travelDate: form.travelDate || undefined,
        flexibility: form.flexibility || undefined,
        passengersAdults: form.passengersAdults,
        passengersChildren: form.passengersChildren,
        passengersInfants: form.passengersInfants,
        nights: form.nights || undefined,
        starRating: form.starRating || undefined,
        boardBasis: form.boardBasis || undefined,
        budget: form.budget || undefined,
        budgetType: form.budgetType || undefined,
      });
    }

    onSubmit(base);
  };

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 60 : -60, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -60 : 60, opacity: 0 }),
  };

  const isHotTub = form.holidayType === "Hot Tub Break";

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
              {step === 0 && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Enquiry Title *</Label>
                    <Input
                      placeholder={isHotTub ? "e.g. Lake District Hot Tub Weekend" : "e.g. Maldives Family Holiday"}
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
                        {HOLIDAY_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {isHotTub ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Accommodation Type</Label>
                        <Select value={form.accommodationType} onValueChange={(v) => set("accommodationType", v)}>
                          <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-accommodation-type">
                            <SelectValue placeholder="Select accommodation type..." />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOMMODATION_TYPES.map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Destination</Label>
                        <Input
                          placeholder="e.g. Lake District"
                          value={form.destination}
                          onChange={(e) => set("destination", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70"
                          data-testid="input-enquiry-destination"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Country</Label>
                        <Input
                          placeholder="e.g. Spain"
                          value={form.country}
                          onChange={(e) => set("country", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70"
                          data-testid="input-enquiry-country"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Destination</Label>
                        <Input
                          placeholder="e.g. Canary Islands"
                          value={form.destination}
                          onChange={(e) => set("destination", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70"
                          data-testid="input-enquiry-destination"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Resort</Label>
                        <Input
                          placeholder="e.g. Costa Adeje"
                          value={form.resort}
                          onChange={(e) => set("resort", e.target.value)}
                          className="h-10 rounded-xl border-black/10 bg-white/70"
                          data-testid="input-enquiry-resort"
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

              {step === 1 && !isHotTub && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Airport</Label>
                    <Input
                      placeholder="e.g. Manchester (MAN)"
                      value={form.departureAirport}
                      onChange={(e) => set("departureAirport", e.target.value)}
                      className="h-10 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-departure-airport"
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

              {step === 2 && isHotTub && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                    <Input
                      type="number"
                      min={1}
                      value={form.nights}
                      onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                      className="h-10 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-nights"
                    />
                  </div>
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

              {step === 2 && !isHotTub && (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                      <Input
                        type="number"
                        min={1}
                        value={form.nights}
                        onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                        className="h-10 rounded-xl border-black/10 bg-white/70"
                        data-testid="input-nights"
                      />
                    </div>
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
                    <Select value={form.boardBasis} onValueChange={(v) => set("boardBasis", v)}>
                      <SelectTrigger className="h-10 rounded-xl border-black/10 bg-white/70" data-testid="select-board-basis">
                        <SelectValue placeholder="Select board basis..." />
                      </SelectTrigger>
                      <SelectContent>
                        {BOARD_BASIS_OPTIONS.map((b) => (
                          <SelectItem key={b} value={b}>{b}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                className="h-9 rounded-2xl bg-[#3b82f6] px-4 text-xs font-semibold text-white hover:bg-[#3b82f6]/90"
                data-testid="button-wizard-submit"
              >
                {isSaving ? "Saving..." : isEdit ? "Update Enquiry" : "Create Enquiry"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
