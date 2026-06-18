import { useState, useCallback } from "react";
import { Anchor, Plus, Ship, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SectionHeader } from "@/features/quote/components/sections/SectionHeader";
import { formatUKDate } from "@/features/quote/components/quote-types";

const CRUISE_LINES = [
  "Royal Caribbean",
  "Celebrity Cruises",
  "P&O Cruises",
  "Cunard",
  "Princess Cruises",
  "MSC Cruises",
  "Norwegian Cruise Line",
];

const CABIN_TYPES = [
  "Interior",
  "Oceanview",
  "Balcony",
  "Suite",
  "Junior Suite",
];

interface ItineraryRow {
  id: string;
  day: string;
  port: string;
  subDescription: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 text-xs font-medium text-black/60">{children}</p>;
}

function SpecRow({
  testId,
  label,
  value,
}: {
  testId: string;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
      data-testid={`row-spec-${testId}`}
    >
      <div
        className="shrink-0 text-xs font-semibold text-black/65"
        data-testid={`text-spec-${testId}-label`}
      >
        {label}
      </div>
      <div
        className="min-w-0 flex-1 truncate text-right text-xs font-semibold text-black"
        data-testid={`text-spec-${testId}-value`}
      >
        {value}
      </div>
    </div>
  );
}

export default function CruiseQuotePreviewPage() {
  const [cruiseTitle, setCruiseTitle] = useState("Mediterranean Highlights");
  const [cruiseCompany, setCruiseCompany] = useState("Royal Caribbean");
  const [ship, setShip] = useState("Wonder of the Seas");
  const [departurePort, setDeparturePort] = useState("Barcelona, Spain");
  const [departureDate, setDepartureDate] = useState("2026-09-12");
  const [nights, setNights] = useState("7");
  const [guests, setGuests] = useState("2");
  const [cabinType, setCabinType] = useState("Balcony");
  const [cabinLocation, setCabinLocation] = useState("Deck 10, Cabin 10248");
  const [itinerary, setItinerary] = useState<ItineraryRow[]>([
    { id: makeId(), day: "Day 1", port: "Barcelona, Spain", subDescription: "Embarkation • Departs 6:00 PM" },
    { id: makeId(), day: "Day 2", port: "Palma de Mallorca, Spain", subDescription: "" },
    { id: makeId(), day: "Day 3", port: "At Sea", subDescription: "" },
    { id: makeId(), day: "Day 4", port: "Naples, Italy", subDescription: "" },
    { id: makeId(), day: "Day 5", port: "Rome (Civitavecchia), Italy", subDescription: "" },
    { id: makeId(), day: "Day 6", port: "Florence (La Spezia), Italy", subDescription: "" },
    { id: makeId(), day: "Day 7", port: "Provence (Marseille), France", subDescription: "" },
    { id: makeId(), day: "Day 8", port: "Barcelona, Spain", subDescription: "Disembarkation • Arrives 7:00 AM" },
  ]);

  const addItineraryRow = useCallback(() => {
    setItinerary((rows) => [
      ...rows,
      { id: makeId(), day: `Day ${rows.length + 1}`, port: "", subDescription: "" },
    ]);
  }, []);

  const removeItineraryRow = useCallback((id: string) => {
    setItinerary((rows) => rows.filter((r) => r.id !== id));
  }, []);

  const updateItineraryRow = useCallback((id: string, key: "day" | "port" | "subDescription", value: string) => {
    setItinerary((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [key]: value } : r))
    );
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-6 md:px-6" data-testid="page-cruise-quote-preview">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 flex items-center gap-2">
          <Ship className="h-5 w-5 text-black/70" />
          <h1 className="text-lg font-semibold text-black" data-testid="text-page-title">
            Cruise Quote Preview
          </h1>
        </div>

        <div className="grid gap-3 lg:grid-cols-2" data-testid="layout-cruise-preview">
          {/* FORM HALF */}
          <Card
            className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
            data-testid="card-cruise-form"
          >
            <SectionHeader icon={Anchor} title="Cruise Details" />

            <div className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <FieldLabel>Cruise Title</FieldLabel>
                <Input
                  value={cruiseTitle}
                  onChange={(e) => setCruiseTitle(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-cruise-title"
                />
              </div>

              <div>
                <FieldLabel>Cruise Company</FieldLabel>
                <Select value={cruiseCompany} onValueChange={setCruiseCompany}>
                  <SelectTrigger
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="select-cruise-company"
                  >
                    <SelectValue placeholder="Select cruise line..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CRUISE_LINES.map((line) => (
                      <SelectItem key={line} value={line} data-testid={`option-cruise-company-${line}`}>
                        {line}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <FieldLabel>Ship</FieldLabel>
                <Input
                  value={ship}
                  onChange={(e) => setShip(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-cruise-ship"
                />
              </div>

              <div>
                <FieldLabel>Leaving From</FieldLabel>
                <Input
                  value={departurePort}
                  onChange={(e) => setDeparturePort(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  placeholder="Departure port"
                  data-testid="input-cruise-departure-port"
                />
              </div>

              <div>
                <FieldLabel>Departure Date</FieldLabel>
                <DatePicker
                  value={departureDate}
                  onChange={setDepartureDate}
                  className="h-9"
                  data-testid="input-cruise-departure-date"
                />
              </div>

              <div>
                <FieldLabel>Number of Nights</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={nights}
                  onChange={(e) => setNights(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-cruise-nights"
                />
              </div>

              <div>
                <FieldLabel>Number of Guests</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  value={guests}
                  onChange={(e) => setGuests(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-cruise-guests"
                />
              </div>

              <div>
                <FieldLabel>Cabin Type</FieldLabel>
                <Select value={cabinType} onValueChange={setCabinType}>
                  <SelectTrigger
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="select-cruise-cabin-type"
                  >
                    <SelectValue placeholder="Select cabin type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CABIN_TYPES.map((type) => (
                      <SelectItem key={type} value={type} data-testid={`option-cabin-type-${type}`}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Location / Cabin Number</FieldLabel>
                <Input
                  value={cabinLocation}
                  onChange={(e) => setCabinLocation(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  placeholder="e.g. Deck 10, Cabin 10248"
                  data-testid="input-cruise-cabin-location"
                />
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <SectionHeader icon={Ship} title="Itinerary" />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-xl border-black/10 bg-white/70"
                  onClick={addItineraryRow}
                  data-testid="button-add-itinerary-row"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Add Day
                </Button>
              </div>

              <div className="grid gap-2" data-testid="list-itinerary-form-rows">
                {itinerary.map((row, i) => (
                  <div
                    key={row.id}
                    className="flex items-start gap-2"
                    data-testid={`row-itinerary-form-${i}`}
                  >
                    <Input
                      value={row.day}
                      onChange={(e) => updateItineraryRow(row.id, "day", e.target.value)}
                      className="h-9 w-28 rounded-xl border-black/10 bg-white/70"
                      placeholder="Day"
                      data-testid={`input-itinerary-day-${i}`}
                    />
                    <div className="flex flex-1 flex-col gap-2">
                      <Input
                        value={row.port}
                        onChange={(e) => updateItineraryRow(row.id, "port", e.target.value)}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="Port"
                        data-testid={`input-itinerary-port-${i}`}
                      />
                      <Input
                        value={row.subDescription}
                        onChange={(e) => updateItineraryRow(row.id, "subDescription", e.target.value)}
                        className="h-9 rounded-xl border-black/10 bg-white/70"
                        placeholder="Sub-description (optional)"
                        data-testid={`input-itinerary-subdescription-${i}`}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 shrink-0 rounded-xl text-black/50 hover:text-red-600"
                      onClick={() => removeItineraryRow(row.id)}
                      data-testid={`button-remove-itinerary-row-${i}`}
                      aria-label="Remove day"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                {itinerary.length === 0 && (
                  <p className="text-xs text-black/45" data-testid="text-itinerary-form-empty">
                    No itinerary days. Use "Add Day" to start.
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* VIEW HALF */}
          <Card
            className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4"
            data-testid="card-cruise-view"
          >
            <div className="mb-3">
              <div className="text-base font-semibold text-black" data-testid="text-view-cruise-title">
                {cruiseTitle || "Untitled Cruise"}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-view-cruise-meta">
                <span data-testid="text-view-meta-company">{cruiseCompany || "—"}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-view-meta-ship">{ship || "—"}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-view-meta-nights">{nights || "0"} nights</span>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-2" data-testid="grid-cruise-specs">
              <div className="grid content-start gap-2">
                <SpecRow testId="company" label="Cruise Company" value={cruiseCompany || "—"} />
                <SpecRow testId="ship" label="Ship" value={ship || "—"} />
                <SpecRow testId="departure-port" label="Leaving From" value={departurePort || "—"} />
                <SpecRow
                  testId="departure-date"
                  label="Departure Date"
                  value={departureDate ? formatUKDate(departureDate) : "—"}
                />
              </div>
              <div className="grid content-start gap-2">
                <SpecRow testId="nights" label="Number of Nights" value={nights || "—"} />
                <SpecRow testId="guests" label="Number of Guests" value={guests || "—"} />
                <SpecRow testId="cabin-type" label="Cabin Type" value={cabinType || "—"} />
                <SpecRow testId="cabin-location" label="Location / Cabin" value={cabinLocation || "—"} />
              </div>
            </div>

            <div className="mt-4">
              <SectionHeader icon={Ship} title="Itinerary" />
              <div className="grid gap-2" data-testid="list-itinerary-view-rows">
                {itinerary.length === 0 && (
                  <p className="text-xs text-black/45" data-testid="text-itinerary-view-empty">
                    No itinerary added yet.
                  </p>
                )}
                {itinerary.map((row, i) => (
                  <div
                    key={row.id}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2"
                    data-testid={`row-itinerary-view-${i}`}
                  >
                    <div
                      className="shrink-0 text-xs font-semibold text-black/65"
                      data-testid={`text-itinerary-day-${i}`}
                    >
                      {row.day || `Day ${i + 1}`}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-end">
                      <div
                        className="min-w-0 max-w-full truncate text-right text-xs font-semibold text-black"
                        data-testid={`text-itinerary-port-${i}`}
                      >
                        {row.port || "—"}
                      </div>
                      {row.subDescription ? (
                        <div
                          className="min-w-0 max-w-full truncate text-right text-xs font-normal text-black/55"
                          data-testid={`text-itinerary-subdescription-${i}`}
                        >
                          {row.subDescription}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
