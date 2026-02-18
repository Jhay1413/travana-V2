import { useEffect, useMemo } from "react";
import { Anchor, Hotel, PawPrint, Plane, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useAirports, useTourOperators, useBoardBasis, useAccommodations, useCountries, useDestinations, useAllDestinations, useResorts, usePackageTypes, useRoomTypes } from "@/hooks/queries";
import type { LookupCountry, LookupDestination, LookupResort, LookupAccommodation, LookupBoardBasis } from "@/api/endpoints/lookup.api";

export interface FlightLeg {
  departAirportId: string;
  departAirport: string;
  arriveAirportId: string;
  arriveAirport: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  flightNumber: string;
}

export const emptyFlightLeg: FlightLeg = {
  departAirportId: "",
  departAirport: "",
  arriveAirportId: "",
  arriveAirport: "",
  departDate: "",
  departTime: "",
  arriveDate: "",
  arriveTime: "",
  flightNumber: "",
};

export interface QuoteFormState {
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  leadSource: string;
  status: string;
  travelDate: string;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  childAges: number[];
  country: string;
  destination: string;
  resort: string;
  accommodation: string;
  accommodationId: string;
  boardBasis: string;
  boardBasisId: string;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  roomType: string;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  outboundDepartAirport: string;
  outboundDepartAirportId: string;
  outboundArriveAirport: string;
  outboundArriveAirportId: string;
  outboundDepartDate: string;
  outboundDepartTime: string;
  outboundArriveDate: string;
  outboundArriveTime: string;
  outboundFlightNumber: string;
  inboundDepartAirport: string;
  inboundDepartAirportId: string;
  inboundArriveAirport: string;
  inboundArriveAirportId: string;
  inboundDepartDate: string;
  inboundDepartTime: string;
  inboundArriveDate: string;
  inboundArriveTime: string;
  inboundFlightNumber: string;
  outboundConnectingLegs: FlightLeg[];
  inboundConnectingLegs: FlightLeg[];
  tourOperator: string;
  tourOperatorId: string;
  sales: string | number;
  price: string | number;
  commission: string | number;
  discount: string | number;
  serviceCharge: string | number;
  pricePerPerson: string | number;
  lodgeCode: string;
  parkName: string;
  pets: boolean;
  cabinType: string;
  cruiseTitle: string;
  cruiseLine: string;
  shipName: string;
  cruiseDate: string;
  embarkation: string;
  debarkation: string;
  cruiseExtras: string;
  cruiseOnly: boolean;
}

export const defaultQuoteFormState: QuoteFormState = {
  packageType: "",
  quoteTitle: "",
  quoteLink: "",
  leadSource: "",
  status: "draft",
  travelDate: "",
  passengersAdults: 2,
  passengersChildren: 0,
  passengersInfants: 0,
  childAges: [],
  country: "",
  destination: "",
  resort: "",
  accommodation: "",
  accommodationId: "",
  boardBasis: "",
  boardBasisId: "",
  checkInDate: "",
  checkInTime: "",
  nights: 7,
  roomType: "",
  transferType: "",
  preBookedSeats: "",
  flightMeals: "",
  outboundDepartAirport: "",
  outboundDepartAirportId: "",
  outboundArriveAirport: "",
  outboundArriveAirportId: "",
  outboundDepartDate: "",
  outboundDepartTime: "",
  outboundArriveDate: "",
  outboundArriveTime: "",
  outboundFlightNumber: "",
  inboundDepartAirport: "",
  inboundDepartAirportId: "",
  inboundArriveAirport: "",
  inboundArriveAirportId: "",
  inboundDepartDate: "",
  inboundDepartTime: "",
  inboundArriveDate: "",
  inboundArriveTime: "",
  inboundFlightNumber: "",
  outboundConnectingLegs: [],
  inboundConnectingLegs: [],
  tourOperator: "",
  tourOperatorId: "",
  sales: "",
  price: "",
  commission: "",
  discount: "",
  serviceCharge: "",
  pricePerPerson: "",
  lodgeCode: "",
  parkName: "",
  pets: false,
  cabinType: "",
  cruiseTitle: "",
  cruiseLine: "",
  shipName: "",
  cruiseDate: "",
  embarkation: "",
  debarkation: "",
  cruiseExtras: "",
  cruiseOnly: false,
};

interface QuoteFormFieldsProps {
  form: QuoteFormState;
  setForm: React.Dispatch<React.SetStateAction<QuoteFormState>>;
  mode: "edit" | "convert";
  packageTypeName?: string;
  onJsonUpload?: (file: File) => void;
}

export function QuoteFormFields({ form, setForm, mode, packageTypeName: externalPackageTypeName, onJsonUpload }: QuoteFormFieldsProps) {
  const set = (key: keyof QuoteFormState, val: string | number | boolean | number[]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const { data: airportsData } = useAirports();
  const { data: tourOperatorsData } = useTourOperators();
  const { data: boardBasisData } = useBoardBasis();
  const { data: roomTypeData } = useRoomTypes();
  const { data: accommodationsData } = useAccommodations(form.resort || undefined);
  const { data: countriesData } = useCountries();
  const { data: packageTypesData } = usePackageTypes();
  const { data: filteredDestinationsData } = useDestinations(form.country || undefined);
  const { data: allDestinationsData } = useAllDestinations();
  const { data: resortsData } = useResorts(form.destination || undefined);

  const destinationsData = form.country ? filteredDestinationsData : allDestinationsData;

  const packageTypeName = useMemo(() => {
    if (externalPackageTypeName) return externalPackageTypeName;
    if (!form.packageType || !packageTypesData) return form.packageType;
    const pt = packageTypesData.find((p: { id: string; name: string }) => p.id === form.packageType);
    return pt?.name || form.packageType;
  }, [form.packageType, packageTypesData, externalPackageTypeName]);

  const useUuidKeys = mode === "convert";

  const effectivePackageType = useUuidKeys ? packageTypeName : form.packageType;

  useEffect(() => {
    if (!form.destination || !allDestinationsData) return;
    const selectedDest = allDestinationsData.find((d: LookupDestination) => d.id === form.destination);
    if (selectedDest?.country_id) {
      setForm((prev) => {
        if (prev.country === selectedDest.country_id) return prev;
        return { ...prev, country: selectedDest.country_id as string };
      });
    }
  }, [form.destination, allDestinationsData, setForm]);

  const fieldValue = (key: keyof QuoteFormState) => (form[key] as string) || "";

  const airportOptions = (airportsData || []).map((a: { id: string; airport_name: string; airport_code?: string }) => ({
    value: a.id,
    label: `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`,
  }));

  const outboundDepartKey: keyof QuoteFormState = useUuidKeys ? "outboundDepartAirport" : "outboundDepartAirportId";
  const outboundArriveKey: keyof QuoteFormState = useUuidKeys ? "outboundArriveAirport" : "outboundArriveAirportId";
  const inboundDepartKey: keyof QuoteFormState = useUuidKeys ? "inboundDepartAirport" : "inboundDepartAirportId";
  const inboundArriveKey: keyof QuoteFormState = useUuidKeys ? "inboundArriveAirport" : "inboundArriveAirportId";
  const tourOperatorKey: keyof QuoteFormState = useUuidKeys ? "tourOperator" : "tourOperatorId";
  const accommodationKey: keyof QuoteFormState = useUuidKeys ? "accommodation" : "accommodationId";
  const boardBasisKey: keyof QuoteFormState = useUuidKeys ? "boardBasis" : "boardBasisId";

  const prefix = mode === "convert" ? "convert" : "edit";

  const showFlights = effectivePackageType !== "Hot Tub Break" && !(effectivePackageType === "Cruise Package" && form.cruiseOnly);

  const addConnectingLeg = (direction: "outbound" | "inbound") => {
    const key = direction === "outbound" ? "outboundConnectingLegs" : "inboundConnectingLegs";
    const currentLegs = form[key];
    if (currentLegs.length >= 2) return;
    setForm(prev => ({ ...prev, [key]: [...prev[key], { ...emptyFlightLeg }] }));
  };

  const removeConnectingLeg = (direction: "outbound" | "inbound", index: number) => {
    const key = direction === "outbound" ? "outboundConnectingLegs" : "inboundConnectingLegs";
    setForm(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const updateConnectingLeg = (direction: "outbound" | "inbound", index: number, field: keyof FlightLeg, value: string) => {
    const key = direction === "outbound" ? "outboundConnectingLegs" : "inboundConnectingLegs";
    setForm(prev => ({
      ...prev,
      [key]: prev[key].map((leg, i) => i === index ? { ...leg, [field]: value } : leg),
    }));
  };

  return (
    <div className="grid gap-6">
      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="mb-3 text-sm font-semibold">Package Details</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Package Type</Label>
            {useUuidKeys ? (
              <SearchableSelect
                value={form.packageType}
                onValueChange={(v) => set("packageType", v)}
                options={(packageTypesData || []).map((pt: { id: string; name: string }) => ({ value: pt.id, label: pt.name }))}
                placeholder="Select type..."
                searchPlaceholder="Search types..."
                emptyMessage="No types found."
                data-testid={`${prefix}-select-package-type`}
              />
            ) : (
              <Select value={form.packageType} onValueChange={(v) => set("packageType", v)}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid={`${prefix}-select-package-type`}>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Package Holiday">Package Holiday</SelectItem>
                  <SelectItem value="Hot Tub Break">Hot Tub Break</SelectItem>
                  <SelectItem value="Cruise Package">Cruise Package</SelectItem>
                  <SelectItem value="Flight Only">Flight Only</SelectItem>
                  <SelectItem value="Hotel Only">Hotel Only</SelectItem>
                  <SelectItem value="Tour">Tour</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Quote Title</Label>
            <Input
              placeholder="e.g. Maldives — Overwater Villa, 9 nights"
              value={form.quoteTitle}
              onChange={(e) => set("quoteTitle", e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-quote-title`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Quote Link</Label>
            <Input
              placeholder="https://..."
              value={form.quoteLink}
              onChange={(e) => set("quoteLink", e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-quote-link`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Lead Source</Label>
            <Select value={form.leadSource} onValueChange={(v) => set("leadSource", v)}>
              <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid={`${prefix}-select-lead-source`}>
                <SelectValue placeholder="Select source..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SHOP">Shop</SelectItem>
                <SelectItem value="FACEBOOK">Facebook</SelectItem>
                <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                <SelectItem value="PHONE_ENQUIRY">Phone Enquiry</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {onJsonUpload && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">JSON Upload</Label>
              <Input
                type="file"
                accept=".json"
                onChange={(e) => {
                  console.log('🔵 File input onChange triggered');
                  const file = e.target.files?.[0];
                  console.log('🔵 Selected file:', file?.name, file?.type, file?.size);
                  if (file) {
                    console.log('🔵 Calling onJsonUpload with file:', file.name);
                    onJsonUpload(file);
                  } else {
                    console.log('🔵 No file selected');
                  }
                }}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-json-upload`}
              />
            </div>
          )}
          {mode === "edit" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid={`${prefix}-select-status`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {mode === "convert" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Travel Date</Label>
              <Input
                type="date"
                value={form.travelDate}
                onChange={(e) => set("travelDate", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-travel-date`}
              />
            </div>
          )}
        </div>
      </div>

      {effectivePackageType === "Hot Tub Break" ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-travel-date-only`}>
          <div className="mb-3 text-sm font-semibold">Travel Details</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Travel Date</Label>
              <DatePicker
                value={form.travelDate}
                onChange={(v) => set("travelDate", v)}
                placeholder="Pick a date"
                data-testid={`${prefix}-input-travel-date`}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-travel-details`}>
          <div className="mb-3 text-sm font-semibold">Travel Details</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Travel Date</Label>
              <DatePicker
                value={form.travelDate}
                onChange={(v) => set("travelDate", v)}
                placeholder="Pick a date"
                data-testid={`${prefix}-input-travel-date`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Adults</Label>
              <Input
                type="number"
                min={1}
                value={form.passengersAdults}
                onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-adults`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Children</Label>
              <Input
                type="number"
                min={0}
                value={form.passengersChildren}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 0;
                  set("passengersChildren", count);
                  set("childAges", Array(count).fill(0));
                }}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-children`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Infants</Label>
              <Input
                type="number"
                min={0}
                value={form.passengersInfants}
                onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-infants`}
              />
            </div>
            {form.passengersChildren > 0 && (
              <div className="space-y-1.5 md:col-span-2">
                <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                <div className="flex flex-wrap gap-2">
                  {form.childAges.map((age: number, idx: number) => (
                    <Input
                      key={idx}
                      type="number"
                      min={0}
                      max={17}
                      value={age}
                      onChange={(e) => {
                        const ages = [...form.childAges];
                        ages[idx] = parseInt(e.target.value) || 0;
                        set("childAges", ages);
                      }}
                      className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-child-age-${idx}`}
                      placeholder={`Child ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {effectivePackageType === "Cruise Package" ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-cruise-cabin`}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Anchor className="h-4 w-4" />
            Cruise & Cabin
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Cruise Title</Label>
              <Input
                placeholder="e.g. Western Mediterranean"
                value={form.cruiseTitle}
                onChange={(e) => set("cruiseTitle", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-cruise-title`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Cruise Line</Label>
              <Input
                placeholder="e.g. Royal Caribbean"
                value={form.cruiseLine}
                onChange={(e) => set("cruiseLine", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-cruise-line`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Ship Name</Label>
              <Input
                placeholder="e.g. Harmony of the Seas"
                value={form.shipName}
                onChange={(e) => set("shipName", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-ship-name`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Cruise Date</Label>
              <DatePicker
                value={form.cruiseDate}
                onChange={(v) => set("cruiseDate", v)}
                placeholder="Pick a date"
                data-testid={`${prefix}-input-cruise-date`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Cabin Type</Label>
              <Select value={form.cabinType} onValueChange={(v) => set("cabinType", v)}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid={`${prefix}-select-cabin-type`}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inside">Inside</SelectItem>
                  <SelectItem value="Outside">Outside</SelectItem>
                  <SelectItem value="Balcony">Balcony</SelectItem>
                  <SelectItem value="Suite">Suite</SelectItem>
                  <SelectItem value="Mini Suite">Mini Suite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Embarkation</Label>
              <Input
                placeholder="e.g. Southampton"
                value={form.embarkation}
                onChange={(e) => set("embarkation", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-embarkation`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Debarkation</Label>
              <Input
                placeholder="e.g. Barcelona"
                value={form.debarkation}
                onChange={(e) => set("debarkation", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-debarkation`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Cruise Extras Included</Label>
              <Input
                placeholder="e.g. Drinks package, WiFi"
                value={form.cruiseExtras}
                onChange={(e) => set("cruiseExtras", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-cruise-extras`}
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Cruise Only</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.cruiseOnly}
                    onCheckedChange={(v) => set("cruiseOnly", v)}
                    data-testid={`${prefix}-switch-cruise-only`}
                  />
                  <span className="text-xs text-black/55">{form.cruiseOnly ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : effectivePackageType === "Hot Tub Break" ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-lodge-details`}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Hotel className="h-4 w-4" />
            Lodge Details
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Lodge Code</Label>
              <Input
                placeholder="e.g. HT-2451"
                value={form.lodgeCode}
                onChange={(e) => set("lodgeCode", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-lodge-code`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Park Name</Label>
              <Input
                placeholder="e.g. Forest Holidays"
                value={form.parkName}
                onChange={(e) => set("parkName", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-park-name`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
              <Input
                type="number"
                min={1}
                value={form.nights}
                onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-lodge-nights`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
              <DatePicker
                value={form.checkInDate}
                onChange={(v) => set("checkInDate", v)}
                placeholder="Pick a date"
                data-testid={`${prefix}-input-lodge-checkin`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Adults</Label>
              <Input
                type="number"
                min={1}
                value={form.passengersAdults}
                onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-lodge-adults`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Children</Label>
              <Input
                type="number"
                min={0}
                value={form.passengersChildren}
                onChange={(e) => {
                  const count = parseInt(e.target.value) || 0;
                  set("passengersChildren", count);
                  set("childAges", Array(count).fill(0));
                }}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-lodge-children`}
              />
            </div>
            {form.passengersChildren > 0 && (
              <div className="space-y-1.5 md:col-span-3">
                <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                <div className="flex flex-wrap gap-2">
                  {form.childAges.map((age: number, idx: number) => (
                    <Input
                      key={idx}
                      type="number"
                      min={0}
                      max={17}
                      value={age}
                      onChange={(e) => {
                        const ages = [...form.childAges];
                        ages[idx] = parseInt(e.target.value) || 0;
                        set("childAges", ages);
                      }}
                      className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-lodge-child-age-${idx}`}
                      placeholder={`Child ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Infants</Label>
              <Input
                type="number"
                min={0}
                value={form.passengersInfants}
                onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-lodge-infants`}
              />
            </div>
            <div className="flex items-end gap-3 pb-1">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">
                  <span className="flex items-center gap-1.5">
                    <PawPrint className="h-3.5 w-3.5" />
                    Pets
                  </span>
                </Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.pets}
                    onCheckedChange={(v) => set("pets", v)}
                    data-testid={`${prefix}-switch-pets`}
                  />
                  <span className="text-xs text-black/55">{form.pets ? "Yes" : "No"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-destination-accommodation`}>
          <div className="mb-3 text-sm font-semibold">Destination & Accommodation</div>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Country</Label>
              <SearchableSelect
                value={form.country}
                onValueChange={(v) => {
                  set("country", v);
                  set("destination", "");
                  set("resort", "");
                  set("accommodation", "");
                  set("accommodationId", "");
                }}
                options={(countriesData || []).map((c: LookupCountry) => ({ value: c.id, label: c.country_name }))}
                placeholder="Select country..."
                searchPlaceholder="Search countries..."
                emptyMessage="No countries found."
                data-testid={`${prefix}-select-country`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Destination</Label>
              <SearchableSelect
                value={form.destination}
                onValueChange={(v) => {
                  set("destination", v);
                  set("resort", "");
                  set("accommodation", "");
                  set("accommodationId", "");
                  const selectedDest = (destinationsData || []).find((d: LookupDestination) => d.id === v);
                  if (selectedDest?.country_id && selectedDest.country_id !== form.country) {
                    set("country", selectedDest.country_id);
                  }
                }}
                options={(destinationsData || []).map((d: LookupDestination) => ({ value: d.id, label: d.name }))}
                placeholder="Select destination..."
                searchPlaceholder="Search destinations..."
                emptyMessage={form.country ? "No destinations found." : "Select a country first."}
                data-testid={`${prefix}-select-destination`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Resort</Label>
              <SearchableSelect
                value={form.resort}
                onValueChange={(v) => {
                  set("resort", v);
                  set("accommodation", "");
                  set("accommodationId", "");
                }}
                options={(resortsData || []).map((r: LookupResort) => ({ value: r.id, label: r.name }))}
                placeholder="Select resort..."
                searchPlaceholder="Search resorts..."
                emptyMessage={form.destination ? "No resorts found." : "Select a destination first."}
                data-testid={`${prefix}-select-resort`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Accommodation</Label>
              <SearchableSelect
                value={fieldValue(accommodationKey)}
                onValueChange={(v) => set(accommodationKey, v)}
                options={(accommodationsData || []).map((a: LookupAccommodation) => ({ value: a.id, label: a.name }))}
                placeholder="Select accommodation..."
                searchPlaceholder="Search accommodations..."
                emptyMessage={form.resort ? "No accommodations found." : "Select a resort first."}
                data-testid={`${prefix}-select-accommodation`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
              <DatePicker
                value={form.checkInDate}
                onChange={(v) => set("checkInDate", v)}
                placeholder="Pick a date"
                data-testid={`${prefix}-input-checkin-date`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
              <Input
                type="time"
                value={form.checkInTime}
                onChange={(e) => set("checkInTime", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-checkin-time`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
              <Input
                type="number"
                min={1}
                value={form.nights}
                onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-nights`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Board Basis</Label>
              <SearchableSelect
                value={fieldValue(boardBasisKey)}
                onValueChange={(v) => set(boardBasisKey, v)}
                options={(boardBasisData || []).map((b: LookupBoardBasis) => ({ value: b.id, label: b.type }))}
                placeholder="Select board basis..."
                searchPlaceholder="Search..."
                emptyMessage="No options found."
                data-testid={`${prefix}-select-board-basis`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Room Type</Label>
              <SearchableSelect
                value={form.roomType}
                onValueChange={(v) => set("roomType", v)}
                options={(roomTypeData || []).map((r: { id: string; name: string | null }) => ({ value: r.name || "", label: r.name || "Unknown" }))}
                placeholder="Select room type..."
                searchPlaceholder="Search..."
                emptyMessage="No options found."
                data-testid={`${prefix}-select-room-type`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
              <Select value={form.transferType} onValueChange={(v) => set("transferType", v)}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid={`${prefix}-select-transfer-type`}>
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private Transfer">Private Transfer</SelectItem>
                  <SelectItem value="Shared Transfer">Shared Transfer</SelectItem>
                  <SelectItem value="Seaplane">Seaplane</SelectItem>
                  <SelectItem value="Speedboat">Speedboat</SelectItem>
                  <SelectItem value="Self-drive">Self-drive</SelectItem>
                  <SelectItem value="None">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Pre-booked Seats</Label>
              <Input
                placeholder="e.g. Extra legroom (row 12)"
                value={form.preBookedSeats}
                onChange={(e) => set("preBookedSeats", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-prebooked-seats`}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
              <Input
                placeholder="e.g. Standard + child meal"
                value={form.flightMeals}
                onChange={(e) => set("flightMeals", e.target.value)}
                className="h-9 rounded-xl border-black/10 bg-white/70"
                data-testid={`${prefix}-input-flight-meals`}
              />
            </div>
          </div>
        </div>
      )}

      {showFlights && (
        <>
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-outbound-flights`}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4" />
              Flights — Outbound
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                <SearchableSelect
                  value={fieldValue(outboundDepartKey)}
                  onValueChange={(v) => set(outboundDepartKey, v)}
                  options={airportOptions}
                  placeholder="Select airport..."
                  searchPlaceholder="Search airports..."
                  emptyMessage="No airports found."
                  data-testid={`${prefix}-select-outbound-depart-airport`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                <DatePicker
                  value={form.outboundDepartDate}
                  onChange={(v) => set("outboundDepartDate", v)}
                  placeholder="Pick a date"
                  data-testid={`${prefix}-input-outbound-depart-date`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                <Input
                  type="time"
                  value={form.outboundDepartTime}
                  onChange={(e) => set("outboundDepartTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-outbound-depart-time`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                <SearchableSelect
                  value={fieldValue(outboundArriveKey)}
                  onValueChange={(v) => set(outboundArriveKey, v)}
                  options={airportOptions}
                  placeholder="Select airport..."
                  searchPlaceholder="Search airports..."
                  emptyMessage="No airports found."
                  data-testid={`${prefix}-select-outbound-arrive-airport`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                <DatePicker
                  value={form.outboundArriveDate}
                  onChange={(v) => set("outboundArriveDate", v)}
                  placeholder="Pick a date"
                  data-testid={`${prefix}-input-outbound-arrive-date`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                <Input
                  type="time"
                  value={form.outboundArriveTime}
                  onChange={(e) => set("outboundArriveTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-outbound-arrive-time`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                <Input
                  placeholder="e.g. BA123"
                  value={form.outboundFlightNumber}
                  onChange={(e) => set("outboundFlightNumber", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-outbound-flight-number`}
                />
              </div>
            </div>

            {form.outboundConnectingLegs.map((leg, idx) => (
              <div key={idx} className="mt-3 rounded-xl border border-blue-200/60 bg-blue-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-700">Connecting Flight {idx + 2}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConnectingLeg("outbound", idx)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    data-testid={`${prefix}-remove-outbound-leg-${idx}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={leg.departAirportId}
                      onValueChange={(v) => updateConnectingLeg("outbound", idx, "departAirportId", v)}
                      options={airportOptions}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid={`${prefix}-select-outbound-leg-${idx}-depart-airport`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={leg.departDate}
                      onChange={(v) => updateConnectingLeg("outbound", idx, "departDate", v)}
                      placeholder="Pick a date"
                      data-testid={`${prefix}-input-outbound-leg-${idx}-depart-date`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={leg.departTime}
                      onChange={(e) => updateConnectingLeg("outbound", idx, "departTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-outbound-leg-${idx}-depart-time`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={leg.arriveAirportId}
                      onValueChange={(v) => updateConnectingLeg("outbound", idx, "arriveAirportId", v)}
                      options={airportOptions}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid={`${prefix}-select-outbound-leg-${idx}-arrive-airport`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={leg.arriveDate}
                      onChange={(v) => updateConnectingLeg("outbound", idx, "arriveDate", v)}
                      placeholder="Pick a date"
                      data-testid={`${prefix}-input-outbound-leg-${idx}-arrive-date`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={leg.arriveTime}
                      onChange={(e) => updateConnectingLeg("outbound", idx, "arriveTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-outbound-leg-${idx}-arrive-time`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                    <Input
                      placeholder="e.g. BA789"
                      value={leg.flightNumber}
                      onChange={(e) => updateConnectingLeg("outbound", idx, "flightNumber", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-outbound-leg-${idx}-flight-number`}
                    />
                  </div>
                </div>
              </div>
            ))}

            {form.outboundConnectingLegs.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addConnectingLeg("outbound")}
                className="mt-3 gap-1.5 rounded-xl border-dashed border-blue-300 text-blue-600 hover:bg-blue-50"
                data-testid={`${prefix}-add-outbound-connecting`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Connecting Flight
              </Button>
            )}
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid={`${prefix}-section-inbound-flights`}>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4 rotate-180" />
              Flights — Inbound
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                <SearchableSelect
                  value={fieldValue(inboundDepartKey)}
                  onValueChange={(v) => set(inboundDepartKey, v)}
                  options={airportOptions}
                  placeholder="Select airport..."
                  searchPlaceholder="Search airports..."
                  emptyMessage="No airports found."
                  data-testid={`${prefix}-select-inbound-depart-airport`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                <DatePicker
                  value={form.inboundDepartDate}
                  onChange={(v) => set("inboundDepartDate", v)}
                  placeholder="Pick a date"
                  data-testid={`${prefix}-input-inbound-depart-date`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                <Input
                  type="time"
                  value={form.inboundDepartTime}
                  onChange={(e) => set("inboundDepartTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-inbound-depart-time`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                <SearchableSelect
                  value={fieldValue(inboundArriveKey)}
                  onValueChange={(v) => set(inboundArriveKey, v)}
                  options={airportOptions}
                  placeholder="Select airport..."
                  searchPlaceholder="Search airports..."
                  emptyMessage="No airports found."
                  data-testid={`${prefix}-select-inbound-arrive-airport`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                <DatePicker
                  value={form.inboundArriveDate}
                  onChange={(v) => set("inboundArriveDate", v)}
                  placeholder="Pick a date"
                  data-testid={`${prefix}-input-inbound-arrive-date`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                <Input
                  type="time"
                  value={form.inboundArriveTime}
                  onChange={(e) => set("inboundArriveTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-inbound-arrive-time`}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                <Input
                  placeholder="e.g. BA456"
                  value={form.inboundFlightNumber}
                  onChange={(e) => set("inboundFlightNumber", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid={`${prefix}-input-inbound-flight-number`}
                />
              </div>
            </div>

            {form.inboundConnectingLegs.map((leg, idx) => (
              <div key={idx} className="mt-3 rounded-xl border border-purple-200/60 bg-purple-50/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-purple-700">Connecting Flight {idx + 2}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeConnectingLeg("inbound", idx)}
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    data-testid={`${prefix}-remove-inbound-leg-${idx}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={leg.departAirportId}
                      onValueChange={(v) => updateConnectingLeg("inbound", idx, "departAirportId", v)}
                      options={airportOptions}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid={`${prefix}-select-inbound-leg-${idx}-depart-airport`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={leg.departDate}
                      onChange={(v) => updateConnectingLeg("inbound", idx, "departDate", v)}
                      placeholder="Pick a date"
                      data-testid={`${prefix}-input-inbound-leg-${idx}-depart-date`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={leg.departTime}
                      onChange={(e) => updateConnectingLeg("inbound", idx, "departTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-inbound-leg-${idx}-depart-time`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={leg.arriveAirportId}
                      onValueChange={(v) => updateConnectingLeg("inbound", idx, "arriveAirportId", v)}
                      options={airportOptions}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid={`${prefix}-select-inbound-leg-${idx}-arrive-airport`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={leg.arriveDate}
                      onChange={(v) => updateConnectingLeg("inbound", idx, "arriveDate", v)}
                      placeholder="Pick a date"
                      data-testid={`${prefix}-input-inbound-leg-${idx}-arrive-date`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={leg.arriveTime}
                      onChange={(e) => updateConnectingLeg("inbound", idx, "arriveTime", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-inbound-leg-${idx}-arrive-time`}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                    <Input
                      placeholder="e.g. BA789"
                      value={leg.flightNumber}
                      onChange={(e) => updateConnectingLeg("inbound", idx, "flightNumber", e.target.value)}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid={`${prefix}-input-inbound-leg-${idx}-flight-number`}
                    />
                  </div>
                </div>
              </div>
            ))}

            {form.inboundConnectingLegs.length < 2 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addConnectingLeg("inbound")}
                className="mt-3 gap-1.5 rounded-xl border-dashed border-purple-300 text-purple-600 hover:bg-purple-50"
                data-testid={`${prefix}-add-inbound-connecting`}
              >
                <Plus className="h-3.5 w-3.5" />
                Add Connecting Flight
              </Button>
            )}
          </div>
        </>
      )}

      <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
        <div className="mb-3 text-sm font-semibold">Package Commissions</div>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
            <SearchableSelect
              value={fieldValue(tourOperatorKey)}
              onValueChange={(v) => set(tourOperatorKey, v)}
              options={(tourOperatorsData || []).map((t: { id: string; name: string | null }) => ({ value: t.id, label: t.name || "Unnamed" }))}
              placeholder="Select tour operator..."
              searchPlaceholder="Search tour operators..."
              emptyMessage="No tour operators found."
              data-testid={`${prefix}-select-tour-operator`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.sales}
              onChange={(e) => set("sales", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-sales`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Price (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => set("price", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-price`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.commission}
              onChange={(e) => set("commission", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-commission`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.discount}
              onChange={(e) => set("discount", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-discount`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.serviceCharge}
              onChange={(e) => set("serviceCharge", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-service-charge`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
            <Input
              type="number"
              min={0}
              value={form.pricePerPerson}
              onChange={(e) => set("pricePerPerson", mode === "edit" ? (parseFloat(e.target.value) || 0) : e.target.value)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid={`${prefix}-input-price-per-person`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
