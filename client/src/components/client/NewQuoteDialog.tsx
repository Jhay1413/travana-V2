import { useRef } from "react";
import { Anchor, Hotel, ImagePlus, PawPrint, Plane, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import type { LookupPackageType, LookupCountry, LookupDestination, LookupResort, LookupAccommodation, LookupBoardBasis, LookupPark, LookupLodge } from "@/api/endpoints/lookup.api";
import type { Airport } from "@/types/airport";
import type { TourOperator } from "@/types/tour-operator";
import type { NewQuoteFormState } from "./client-types";

export function NewQuoteDialog({
  open,
  onOpenChange,
  clientName,
  isBooking,
  convertingFromEnquiryTxnId,
  newQuote,
  setNewQuote,
  quoteImageFiles,
  setQuoteImageFiles,
  quoteImageUrls,
  setQuoteImageUrls,
  packageTypesData,
  packageTypeName,
  airportsData,
  tourOperatorsData,
  countriesData,
  destinationsData,
  resortsData,
  accommodationsData,
  boardBasisData,
  roomTypeData,
  parksData,
  lodgesData,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  isBooking: boolean;
  convertingFromEnquiryTxnId: string | null;
  newQuote: NewQuoteFormState;
  setNewQuote: React.Dispatch<React.SetStateAction<NewQuoteFormState>>;
  quoteImageFiles: File[];
  setQuoteImageFiles: React.Dispatch<React.SetStateAction<File[]>>;
  quoteImageUrls: string[];
  setQuoteImageUrls: React.Dispatch<React.SetStateAction<string[]>>;
  packageTypesData: LookupPackageType[] | undefined;
  packageTypeName: string;
  airportsData: Airport[] | undefined;
  tourOperatorsData: TourOperator[] | undefined;
  countriesData: LookupCountry[] | undefined;
  destinationsData: LookupDestination[] | undefined;
  resortsData: LookupResort[] | undefined;
  accommodationsData: LookupAccommodation[] | undefined;
  boardBasisData: LookupBoardBasis[] | undefined;
  roomTypeData: { id: string; name: string | null }[] | undefined;
  parksData: LookupPark[] | undefined;
  lodgesData: LookupLodge[] | undefined;
  onSubmit: () => void;
  isPending: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);

  const dialogTitle = convertingFromEnquiryTxnId
    ? "Convert Enquiry to Quote"
    : isBooking
    ? "New Booking"
    : "New Quote";

  const dialogDescription = `${
    convertingFromEnquiryTxnId
      ? "Review and adjust the details from the enquiry, then create the quote."
      : isBooking
      ? "Create a new booking"
      : "Create a new quote"
  } for ${clientName}.`;

  const submitLabel = isPending
    ? "Creating..."
    : convertingFromEnquiryTxnId
    ? "Convert to Quote"
    : isBooking
    ? "Create Booking"
    : "Create Quote";

  const showFlights = packageTypeName !== "Hot Tub Break" && !(packageTypeName === "Cruise Package" && newQuote.cruiseOnly);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-sm text-black/55">{dialogDescription}</DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-6">
          {/* Package Details */}
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Details</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Package Type</Label>
                <SearchableSelect
                  value={newQuote.packageType}
                  onValueChange={(v) => setNewQuote({ ...newQuote, packageType: v })}
                  options={(packageTypesData || []).map((pt: LookupPackageType) => ({ value: pt.id, label: pt.name }))}
                  placeholder="Select type..."
                  searchPlaceholder="Search types..."
                  emptyMessage="No types found."
                  data-testid="select-package-type"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                <Input
                  placeholder="e.g. Maldives — Overwater Villa, 9 nights"
                  value={newQuote.quoteTitle}
                  onChange={(e) => setNewQuote({ ...newQuote, quoteTitle: e.target.value })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-quote-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Link</Label>
                <Input
                  placeholder="https://..."
                  value={newQuote.quoteLink}
                  onChange={(e) => setNewQuote({ ...newQuote, quoteLink: e.target.value })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-quote-link"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Lead Source</Label>
                <Select value={newQuote.leadSource} onValueChange={(v) => setNewQuote({ ...newQuote, leadSource: v })}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-lead-source">
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
              {isBooking && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
                    <Input
                      placeholder="e.g. HAYS-12345"
                      value={newQuote.haysReference}
                      onChange={(e) => setNewQuote({ ...newQuote, haysReference: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-booking-hays-ref"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
                    <Input
                      placeholder="e.g. TOUR-67890"
                      value={newQuote.tourReference}
                      onChange={(e) => setNewQuote({ ...newQuote, tourReference: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-booking-tour-ref"
                    />
                  </div>
                </>
              )}
              <div className="flex items-center">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-xl border border-black/10 bg-white/70 px-3 py-1.5 text-xs font-medium text-black/60 transition hover:bg-black/[0.05]">
                  <Upload className="h-3.5 w-3.5" />
                  Import JSON
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    data-testid="input-json-upload"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = async (ev) => {
                          const content = ev.target?.result as string || "";
                          const toIsoDate = (d: string | undefined): string => {
                            if (!d) return "";
                            const match = d.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
                            if (match) {
                              const [, day, month, year] = match;
                              return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                            }
                            return d;
                          };
                          try {
                            const data = JSON.parse(content);

                            const isScraperFormat = Array.isArray(data.flights) || data.sales_price !== undefined || data.departure_airport !== undefined;

                            const idOnlyFields = new Set([
                              'country', 'destination', 'resort', 'accommodation',
                              'boardBasis', 'tourOperator', 'roomType',
                              'outboundDepartAirport', 'outboundArriveAirport',
                              'inboundDepartAirport', 'inboundArriveAirport',
                            ]);

                            const applyMappedIds = async (textFields: Record<string, string | undefined>) => {
                              try {
                                const { jsonMapperApi } = await import("@/api/endpoints/json-mapper.api");
                                const idMapping = await jsonMapperApi.mapToIds(textFields);
                                setNewQuote((prev) => {
                                  const updated = { ...prev };
                                  if (idMapping.countryId) updated.country = idMapping.countryId;
                                  if (idMapping.parkId) updated.parkId = idMapping.parkId;
                                  if (idMapping.lodgeId) updated.lodgeId = idMapping.lodgeId;
                                  if (idMapping.destinationId) updated.destination = idMapping.destinationId;
                                  if (idMapping.resortId) updated.resort = idMapping.resortId;
                                  if (idMapping.accommodationId) updated.accommodation = idMapping.accommodationId;
                                  if (idMapping.boardBasisId) updated.boardBasis = idMapping.boardBasisId;
                                  if (idMapping.tourOperatorId) updated.tourOperator = idMapping.tourOperatorId;
                                  if (idMapping.outboundDepartAirportId) updated.outboundDepartAirport = idMapping.outboundDepartAirportId;
                                  if (idMapping.outboundArriveAirportId) updated.outboundArriveAirport = idMapping.outboundArriveAirportId;
                                  if (idMapping.inboundDepartAirportId) updated.inboundDepartAirport = idMapping.inboundDepartAirportId;
                                  if (idMapping.inboundArriveAirportId) updated.inboundArriveAirport = idMapping.inboundArriveAirportId;
                                  if (idMapping.roomTypeId) updated.roomType = idMapping.roomTypeId;
                                  return updated;
                                });
                              } catch (err) {
                                console.error("ID mapping failed:", err);
                              }
                            };

                            if (isScraperFormat) {
                              const { mapScraperJsonToFormFields } = await import("@/lib/scraper-json-parser");
                              const result = mapScraperJsonToFormFields(data);

                              const resolveAirportId = (airportText: string | undefined): string => {
                                if (!airportText || !airportsData) return "";
                                const needle = airportText.trim().toLowerCase();
                                if (!needle) return "";

                                const exact = airportsData.find((airport: Airport) => {
                                  const name = (airport.airport_name || "").trim().toLowerCase();
                                  const code = (airport.airport_code || "").trim().toLowerCase();
                                  return needle === name || needle === code;
                                });
                                if (exact) return exact.id;

                                const partial = airportsData.find((airport: Airport) => {
                                  const name = (airport.airport_name || "").trim().toLowerCase();
                                  const code = (airport.airport_code || "").trim().toLowerCase();
                                  return name.includes(needle) || needle.includes(name) || (code.length > 0 && (code.includes(needle) || needle.includes(code)));
                                });

                                return partial?.id || "";
                              };

                              setNewQuote((prev) => {
                                const updated = { ...prev, jsonPayload: content };
                                for (const [k, v] of Object.entries(result.fields)) {
                                  if (v !== "" && v !== null && v !== undefined && !idOnlyFields.has(k)) {
                                    (updated as Record<string, unknown>)[k] = v;
                                  }
                                }

                                updated.outboundConnectingLegs = result.outboundConnectingLegs.map((leg) => ({
                                  ...leg,
                                  departAirportId: resolveAirportId(leg.departAirport),
                                  arriveAirportId: resolveAirportId(leg.arriveAirport),
                                }));

                                updated.inboundConnectingLegs = result.inboundConnectingLegs.map((leg) => ({
                                  ...leg,
                                  departAirportId: resolveAirportId(leg.departAirport),
                                  arriveAirportId: resolveAirportId(leg.arriveAirport),
                                }));
                                return updated;
                              });
                              if (result.images.length > 0) {
                                setQuoteImageUrls((prev) => [...prev, ...result.images.filter((u: string) => !prev.includes(u))]);
                              }
                              await applyMappedIds({
                                country: result.fields.country,
                                destination: result.fields.destination,
                                resort: result.fields.resort,
                                accommodation: result.fields.accommodation,
                                boardBasis: result.fields.boardBasis,
                                tourOperator: result.fields.tourOperator,
                                outboundDepartAirport: result.fields.outboundDepartAirport,
                                outboundArriveAirport: result.fields.outboundArriveAirport,
                                inboundDepartAirport: result.fields.inboundDepartAirport,
                                inboundArriveAirport: result.fields.inboundArriveAirport,
                                roomType: result.fields.roomType,
                              });
                              return;
                            }

                            const textCountry = data.country || "";
                            const textDestination = data.destination || "";
                            const textResort = data.resort || "";
                            const textAccommodation = data.accommodation || data.hotel || data.property || "";
                            const textBoardBasis = data.boardBasis || data.board_basis || data.board || "";
                            const textTourOperator = data.commissions?.tourOperator || data.tourOperator || data.tour_operator || data.operator || "";
                            const textRoomType = data.roomType || data.room_type || data.room || "";
                            const textOutboundDepart = data.flights?.outbound?.departAirport || data.outbound?.from || data.departureAirport || "";
                            const textOutboundArrive = data.flights?.outbound?.arriveAirport || data.outbound?.to || data.arrivalAirport || "";
                            const textInboundDepart = data.flights?.inbound?.departAirport || data.inbound?.from || "";
                            const textInboundArrive = data.flights?.inbound?.arriveAirport || data.inbound?.to || "";

                            setNewQuote((prev) => ({
                              ...prev,
                              jsonPayload: content,
                              packageType: data.packageType || data.package_type || prev.packageType,
                              quoteTitle: data.quoteTitle || data.quote_title || data.title || prev.quoteTitle,
                              quoteLink: data.quoteLink || data.quote_link || data.link || prev.quoteLink,
                              travelDate: toIsoDate(data.travelDate || data.travel_date || data.departureDate) || prev.travelDate,
                              passengersAdults: data.passengers?.adults || data.adults || data.passengersAdults || prev.passengersAdults,
                              passengersChildren: data.passengers?.children || data.children || data.passengersChildren || prev.passengersChildren,
                              passengersInfants: data.passengers?.infants || data.infants || data.passengersInfants || prev.passengersInfants,
                              childAges: data.childAges || data.child_ages || data.passengers?.childAges || prev.childAges,
                              checkInDate: toIsoDate(data.checkInDate || data.check_in_date || data.checkin) || prev.checkInDate,
                              checkInTime: data.checkInTime || data.check_in_time || prev.checkInTime,
                              nights: data.nights || data.duration || prev.nights,
                              transferType: data.transferType || data.transfer_type || data.transfers || prev.transferType,
                              preBookedSeats: data.preBookedSeats || data.pre_booked_seats || data.seats || prev.preBookedSeats,
                              flightMeals: data.flightMeals || data.flight_meals || data.meals || prev.flightMeals,
                              outboundDepartDate: toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date) || prev.outboundDepartDate,
                              outboundDepartTime: data.flights?.outbound?.departTime || data.outbound?.time || prev.outboundDepartTime,
                              outboundArriveDate: toIsoDate(data.flights?.outbound?.arriveDate) || prev.outboundArriveDate,
                              outboundArriveTime: data.flights?.outbound?.arriveTime || prev.outboundArriveTime,
                              inboundDepartDate: toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date) || prev.inboundDepartDate,
                              inboundDepartTime: data.flights?.inbound?.departTime || data.inbound?.time || prev.inboundDepartTime,
                              inboundArriveDate: toIsoDate(data.flights?.inbound?.arriveDate) || prev.inboundArriveDate,
                              inboundArriveTime: data.flights?.inbound?.arriveTime || prev.inboundArriveTime,
                              sales: data.commissions?.sales || data.sales || prev.sales,
                              price: data.commissions?.price || data.price || data.total || prev.price,
                              commission: data.commissions?.commission || data.commission || prev.commission,
                              discount: data.commissions?.discount || data.discount || prev.discount,
                              serviceCharge: data.commissions?.serviceCharge || data.serviceCharge || data.service_charge || prev.serviceCharge,
                              pricePerPerson: data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp || prev.pricePerPerson,
                            }));

                            await applyMappedIds({
                              country: textCountry,
                              destination: textDestination,
                              resort: textResort,
                              accommodation: textAccommodation,
                              boardBasis: textBoardBasis,
                              tourOperator: textTourOperator,
                              outboundDepartAirport: textOutboundDepart,
                              outboundArriveAirport: textOutboundArrive,
                              inboundDepartAirport: textInboundDepart,
                              inboundArriveAirport: textInboundArrive,
                              roomType: textRoomType,
                            });
                            const extractedImages: string[] = [];
                            const imageFields = [
                              data.images, data.image, data.photos, data.photo,
                              data.imageUrl, data.image_url, data.imageUrls, data.image_urls,
                              data.thumbnails, data.thumbnail, data.gallery,
                              data.accommodation?.image, data.accommodation?.imageUrl,
                              data.hotel?.image, data.hotel?.imageUrl,
                            ];
                            for (const field of imageFields) {
                              if (typeof field === "string" && field.startsWith("http")) {
                                extractedImages.push(field);
                              } else if (Array.isArray(field)) {
                                for (const item of field) {
                                  if (typeof item === "string" && item.startsWith("http")) {
                                    extractedImages.push(item);
                                  } else if (item?.url && typeof item.url === "string") {
                                    extractedImages.push(item.url);
                                  }
                                }
                              }
                            }
                            if (extractedImages.length > 0) {
                              setQuoteImageUrls((prev) => [...prev, ...extractedImages.filter((u) => !prev.includes(u))]);
                            }
                          } catch {
                            setNewQuote((prev) => ({ ...prev, jsonPayload: content }));
                          }
                        };
                        reader.readAsText(file);
                      }
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Quote Images */}
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ImagePlus className="h-4 w-4" />
              Quote Images
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Upload Images</Label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  multiple
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      setQuoteImageFiles((prev) => [...prev, ...files]);
                    }
                    if (imageInputRef.current) imageInputRef.current.value = "";
                  }}
                  className="hidden"
                  data-testid="input-quote-images"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 w-full rounded-xl border-black/10 bg-white/70 text-sm"
                  onClick={() => imageInputRef.current?.click()}
                  data-testid="button-add-images"
                >
                  <ImagePlus className="mr-2 h-4 w-4" />
                  Add images
                </Button>
              </div>

              {(quoteImageFiles.length > 0 || quoteImageUrls.length > 0) && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {quoteImageFiles.map((file, idx) => (
                    <div key={`file-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="h-20 w-full object-cover"
                        data-testid={`img-quote-preview-file-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={() => setQuoteImageFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                        data-testid={`button-remove-image-file-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white truncate">
                        {file.name}
                      </div>
                    </div>
                  ))}
                  {quoteImageUrls.map((url, idx) => (
                    <div key={`url-${idx}`} className="group relative overflow-hidden rounded-xl border border-black/10">
                      <img
                        src={url}
                        alt={`Image ${idx + 1}`}
                        className="h-20 w-full object-cover"
                        data-testid={`img-quote-preview-url-${idx}`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "";
                          (e.target as HTMLImageElement).alt = "Failed to load";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setQuoteImageUrls((prev) => prev.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                        data-testid={`button-remove-image-url-${idx}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5 text-[9px] text-white">
                        From JSON
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Travel Details */}
          {packageTypeName === "Hot Tub Break" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-travel-date-only">
              <div className="mb-3 text-sm font-semibold">Travel Details</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                  <DatePicker
                    value={newQuote.travelDate}
                    onChange={(v) => setNewQuote({ ...newQuote, travelDate: v })}
                    placeholder="Pick a date"
                    data-testid="input-travel-date"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-travel-details">
              <div className="mb-3 text-sm font-semibold">Travel Details</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                  <DatePicker
                    value={newQuote.travelDate}
                    onChange={(v) => setNewQuote({ ...newQuote, travelDate: v })}
                    placeholder="Pick a date"
                    data-testid="input-travel-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.passengersAdults}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersAdults: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-adults"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.passengersChildren}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setNewQuote({ ...newQuote, passengersChildren: count, childAges: Array(count).fill(0) });
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-children"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Infants</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.passengersInfants}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersInfants: parseInt(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-infants"
                  />
                </div>
                {newQuote.passengersChildren > 0 && (
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                    <div className="flex flex-wrap gap-2">
                      {newQuote.childAges.map((age, idx) => (
                        <Input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const ages = [...newQuote.childAges];
                            ages[idx] = parseInt(e.target.value) || 0;
                            setNewQuote({ ...newQuote, childAges: ages });
                          }}
                          className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-child-age-${idx}`}
                          placeholder={`Child ${idx + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Cruise & Cabin / Lodge Details / Destination & Accommodation */}
          {packageTypeName === "Cruise Package" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-cruise-cabin">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Anchor className="h-4 w-4" />
                Cruise &amp; Cabin
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Title</Label>
                  <Input
                    placeholder="e.g. Western Mediterranean"
                    value={newQuote.cruiseTitle}
                    onChange={(e) => setNewQuote({ ...newQuote, cruiseTitle: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-cruise-title"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Line</Label>
                  <Input
                    placeholder="e.g. Royal Caribbean"
                    value={newQuote.cruiseLine}
                    onChange={(e) => setNewQuote({ ...newQuote, cruiseLine: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-cruise-line"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Ship Name</Label>
                  <Input
                    placeholder="e.g. Harmony of the Seas"
                    value={newQuote.shipName}
                    onChange={(e) => setNewQuote({ ...newQuote, shipName: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-ship-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Date</Label>
                  <DatePicker
                    value={newQuote.cruiseDate}
                    onChange={(v) => setNewQuote({ ...newQuote, cruiseDate: v })}
                    placeholder="Pick a date"
                    data-testid="input-cruise-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cabin Type</Label>
                  <Select value={newQuote.cabinType} onValueChange={(v) => setNewQuote({ ...newQuote, cabinType: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-cabin-type">
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
                    value={newQuote.embarkation}
                    onChange={(e) => setNewQuote({ ...newQuote, embarkation: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-embarkation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Debarkation</Label>
                  <Input
                    placeholder="e.g. Barcelona"
                    value={newQuote.debarkation}
                    onChange={(e) => setNewQuote({ ...newQuote, debarkation: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-debarkation"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Cruise Extras Included</Label>
                  <Input
                    placeholder="e.g. Drinks package, WiFi"
                    value={newQuote.cruiseExtras}
                    onChange={(e) => setNewQuote({ ...newQuote, cruiseExtras: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-cruise-extras"
                  />
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Cruise Only</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={newQuote.cruiseOnly}
                        onCheckedChange={(v) => setNewQuote({ ...newQuote, cruiseOnly: v })}
                        data-testid="switch-cruise-only"
                      />
                      <span className="text-xs text-black/55">{newQuote.cruiseOnly ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : packageTypeName === "Hot Tub Break" ? (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-lodge-details">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <Hotel className="h-4 w-4" />
                Lodge Details
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Park Name</Label>
                  <Select value={newQuote.parkId} onValueChange={(v) => setNewQuote({ ...newQuote, parkId: v, lodgeId: "" })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-park-name">
                      <SelectValue placeholder="Select park..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(parksData || []).map((park: LookupPark) => (
                        <SelectItem key={park.id} value={park.id}>{park.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Lodge Code</Label>
                  <Select value={newQuote.lodgeId} onValueChange={(v) => setNewQuote({ ...newQuote, lodgeId: v })} disabled={!newQuote.parkId}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-lodge-code">
                      <SelectValue placeholder="Select lodge..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(lodgesData || []).map((lodge: LookupLodge) => (
                        <SelectItem key={lodge.id} value={lodge.id}>{lodge.lodge_name}{lodge.lodge_code ? ` (${lodge.lodge_code})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.nights}
                    onChange={(e) => setNewQuote({ ...newQuote, nights: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-lodge-nights"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                  <DatePicker
                    value={newQuote.checkInDate}
                    onChange={(v) => setNewQuote({ ...newQuote, checkInDate: v })}
                    placeholder="Pick a date"
                    data-testid="input-lodge-checkin"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.passengersAdults}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersAdults: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-lodge-adults"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Children</Label>
                  <Input
                    type="number"
                    min={0}
                    value={newQuote.passengersChildren}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 0;
                      setNewQuote({ ...newQuote, passengersChildren: count, childAges: Array(count).fill(0) });
                    }}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-lodge-children"
                  />
                </div>
                {newQuote.passengersChildren > 0 && (
                  <div className="space-y-1.5 md:col-span-3">
                    <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                    <div className="flex flex-wrap gap-2">
                      {newQuote.childAges.map((age, idx) => (
                        <Input
                          key={idx}
                          type="number"
                          min={0}
                          max={17}
                          value={age}
                          onChange={(e) => {
                            const ages = [...newQuote.childAges];
                            ages[idx] = parseInt(e.target.value) || 0;
                            setNewQuote({ ...newQuote, childAges: ages });
                          }}
                          className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-lodge-child-age-${idx}`}
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
                    value={newQuote.passengersInfants}
                    onChange={(e) => setNewQuote({ ...newQuote, passengersInfants: parseInt(e.target.value) || 0 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-lodge-infants"
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
                        checked={newQuote.pets}
                        onCheckedChange={(v) => setNewQuote({ ...newQuote, pets: v })}
                        data-testid="switch-pets"
                      />
                      <span className="text-xs text-black/55">{newQuote.pets ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-destination-accommodation">
              <div className="mb-3 text-sm font-semibold">Destination &amp; Accommodation</div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Country</Label>
                  <Select value={newQuote.country} onValueChange={(v) => setNewQuote({ ...newQuote, country: v, destination: "", resort: "", accommodation: "" })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-country">
                      <SelectValue placeholder="Select country..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(countriesData || []).map((c: LookupCountry) => (
                        <SelectItem key={c.id} value={c.id}>{c.country_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Destination</Label>
                  <Select value={newQuote.destination} onValueChange={(v) => setNewQuote({ ...newQuote, destination: v, resort: "", accommodation: "" })} disabled={!newQuote.country}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-destination">
                      <SelectValue placeholder="Select destination..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(destinationsData || []).map((d: LookupDestination) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Resort</Label>
                  <Select value={newQuote.resort} onValueChange={(v) => setNewQuote({ ...newQuote, resort: v, accommodation: "" })} disabled={!newQuote.destination}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-resort">
                      <SelectValue placeholder="Select resort..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(resortsData || []).map((r: LookupResort) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Accommodation</Label>
                  <Select value={newQuote.accommodation} onValueChange={(v) => setNewQuote({ ...newQuote, accommodation: v })} disabled={!newQuote.resort}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-accommodation">
                      <SelectValue placeholder="Select accommodation..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(accommodationsData || []).map((a: LookupAccommodation) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                  <DatePicker
                    value={newQuote.checkInDate}
                    onChange={(v) => setNewQuote({ ...newQuote, checkInDate: v })}
                    placeholder="Pick a date"
                    data-testid="input-checkin-date"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
                  <Input
                    type="time"
                    value={newQuote.checkInTime}
                    onChange={(e) => setNewQuote({ ...newQuote, checkInTime: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-checkin-time"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newQuote.nights}
                    onChange={(e) => setNewQuote({ ...newQuote, nights: parseInt(e.target.value) || 1 })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-nights"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                  <Select value={newQuote.boardBasis} onValueChange={(v) => setNewQuote({ ...newQuote, boardBasis: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-board-basis">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(boardBasisData || []).map((bb: LookupBoardBasis) => (
                        <SelectItem key={bb.id} value={bb.id}>{bb.type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Room Type</Label>
                  <SearchableSelect
                    value={newQuote.roomType}
                    onValueChange={(v) => setNewQuote({ ...newQuote, roomType: v })}
                    options={(roomTypeData || []).map((r) => ({ value: r.name || "", label: r.name || "Unknown" }))}
                    placeholder="Select room type..."
                    searchPlaceholder="Search..."
                    emptyMessage="No options found."
                    data-testid="select-room-type"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
                  <Select value={newQuote.transferType} onValueChange={(v) => setNewQuote({ ...newQuote, transferType: v })}>
                    <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-transfer-type">
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
                    value={newQuote.preBookedSeats}
                    onChange={(e) => setNewQuote({ ...newQuote, preBookedSeats: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-prebooked-seats"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
                  <Input
                    placeholder="e.g. Standard + child meal"
                    value={newQuote.flightMeals}
                    onChange={(e) => setNewQuote({ ...newQuote, flightMeals: e.target.value })}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="input-flight-meals"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Flights */}
          {showFlights && (
            <>
              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-outbound-flights">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Plane className="h-4 w-4" />
                  Flights — Outbound
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={newQuote.outboundDepartAirport}
                      onValueChange={(v) => setNewQuote({ ...newQuote, outboundDepartAirport: v })}
                      options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="input-outbound-depart-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={newQuote.outboundDepartDate}
                      onChange={(v) => setNewQuote({ ...newQuote, outboundDepartDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-outbound-depart-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={newQuote.outboundDepartTime}
                      onChange={(e) => setNewQuote({ ...newQuote, outboundDepartTime: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-outbound-depart-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={newQuote.outboundArriveAirport}
                      onValueChange={(v) => setNewQuote({ ...newQuote, outboundArriveAirport: v })}
                      options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="input-outbound-arrive-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={newQuote.outboundArriveDate}
                      onChange={(v) => setNewQuote({ ...newQuote, outboundArriveDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-outbound-arrive-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={newQuote.outboundArriveTime}
                      onChange={(e) => setNewQuote({ ...newQuote, outboundArriveTime: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-outbound-arrive-time"
                    />
                  </div>
                </div>
                {newQuote.outboundConnectingLegs.map((leg, idx) => (
                  <div key={idx} className="rounded-xl border border-blue-200/60 bg-blue-50/30 p-3 mt-3" data-testid={`outbound-connecting-leg-${idx}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-blue-700">Connecting Flight {idx + 2}</span>
                      <button
                        type="button"
                        onClick={() => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.filter((_, i) => i !== idx) }))}
                        className="text-blue-400 hover:text-red-500 transition-colors"
                        data-testid={`remove-outbound-connecting-leg-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                        <SearchableSelect
                          value={leg.departAirportId}
                          onValueChange={(v) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, departAirportId: v } : l) }))}
                          options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                          placeholder="Select airport..."
                          searchPlaceholder="Search airports..."
                          emptyMessage="No airports found."
                          data-testid={`input-outbound-connecting-${idx}-depart-airport`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                        <DatePicker
                          value={leg.departDate}
                          onChange={(v) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, departDate: v } : l) }))}
                          placeholder="Pick a date"
                          data-testid={`input-outbound-connecting-${idx}-depart-date`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                        <Input
                          type="time"
                          value={leg.departTime}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, departTime: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-outbound-connecting-${idx}-depart-time`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                        <SearchableSelect
                          value={leg.arriveAirportId}
                          onValueChange={(v) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveAirportId: v } : l) }))}
                          options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                          placeholder="Select airport..."
                          searchPlaceholder="Search airports..."
                          emptyMessage="No airports found."
                          data-testid={`input-outbound-connecting-${idx}-arrive-airport`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                        <DatePicker
                          value={leg.arriveDate}
                          onChange={(v) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveDate: v } : l) }))}
                          placeholder="Pick a date"
                          data-testid={`input-outbound-connecting-${idx}-arrive-date`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                        <Input
                          type="time"
                          value={leg.arriveTime}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveTime: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-outbound-connecting-${idx}-arrive-time`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                        <Input
                          value={leg.flightNumber}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: prev.outboundConnectingLegs.map((l, i) => i === idx ? { ...l, flightNumber: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          placeholder="e.g. BA123"
                          data-testid={`input-outbound-connecting-${idx}-flight-number`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {newQuote.outboundConnectingLegs.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs gap-1"
                    onClick={() => setNewQuote(prev => ({ ...prev, outboundConnectingLegs: [...prev.outboundConnectingLegs, { departAirportId: "", departAirport: "", arriveAirportId: "", arriveAirport: "", departDate: "", departTime: "", arriveDate: "", arriveTime: "", flightNumber: "" }] }))}
                    data-testid="btn-add-outbound-connecting-flight"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Connecting Flight
                  </Button>
                )}
              </div>

              <div className="rounded-2xl border border-black/10 bg-white/70 p-4" data-testid="new-section-inbound-flights">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                  <Plane className="h-4 w-4 rotate-180" />
                  Flights — Inbound
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                    <SearchableSelect
                      value={newQuote.inboundDepartAirport}
                      onValueChange={(v) => setNewQuote({ ...newQuote, inboundDepartAirport: v })}
                      options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="input-inbound-depart-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                    <DatePicker
                      value={newQuote.inboundDepartDate}
                      onChange={(v) => setNewQuote({ ...newQuote, inboundDepartDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-inbound-depart-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                    <Input
                      type="time"
                      value={newQuote.inboundDepartTime}
                      onChange={(e) => setNewQuote({ ...newQuote, inboundDepartTime: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-inbound-depart-time"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                    <SearchableSelect
                      value={newQuote.inboundArriveAirport}
                      onValueChange={(v) => setNewQuote({ ...newQuote, inboundArriveAirport: v })}
                      options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                      placeholder="Select airport..."
                      searchPlaceholder="Search airports..."
                      emptyMessage="No airports found."
                      data-testid="input-inbound-arrive-airport"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                    <DatePicker
                      value={newQuote.inboundArriveDate}
                      onChange={(v) => setNewQuote({ ...newQuote, inboundArriveDate: v })}
                      placeholder="Pick a date"
                      data-testid="input-inbound-arrive-date"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                    <Input
                      type="time"
                      value={newQuote.inboundArriveTime}
                      onChange={(e) => setNewQuote({ ...newQuote, inboundArriveTime: e.target.value })}
                      className="h-9 rounded-xl border-black/10 bg-white/70"
                      data-testid="input-inbound-arrive-time"
                    />
                  </div>
                </div>
                {newQuote.inboundConnectingLegs.map((leg, idx) => (
                  <div key={idx} className="rounded-xl border border-purple-200/60 bg-purple-50/30 p-3 mt-3" data-testid={`inbound-connecting-leg-${idx}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-purple-700">Connecting Flight {idx + 2}</span>
                      <button
                        type="button"
                        onClick={() => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.filter((_, i) => i !== idx) }))}
                        className="text-purple-400 hover:text-red-500 transition-colors"
                        data-testid={`remove-inbound-connecting-leg-${idx}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                        <SearchableSelect
                          value={leg.departAirportId}
                          onValueChange={(v) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, departAirportId: v } : l) }))}
                          options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                          placeholder="Select airport..."
                          searchPlaceholder="Search airports..."
                          emptyMessage="No airports found."
                          data-testid={`input-inbound-connecting-${idx}-depart-airport`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                        <DatePicker
                          value={leg.departDate}
                          onChange={(v) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, departDate: v } : l) }))}
                          placeholder="Pick a date"
                          data-testid={`input-inbound-connecting-${idx}-depart-date`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                        <Input
                          type="time"
                          value={leg.departTime}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, departTime: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-inbound-connecting-${idx}-depart-time`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                        <SearchableSelect
                          value={leg.arriveAirportId}
                          onValueChange={(v) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveAirportId: v } : l) }))}
                          options={(airportsData || []).map((a: Airport) => ({ value: a.id, label: `${a.airport_name} (${a.airport_code})` }))}
                          placeholder="Select airport..."
                          searchPlaceholder="Search airports..."
                          emptyMessage="No airports found."
                          data-testid={`input-inbound-connecting-${idx}-arrive-airport`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                        <DatePicker
                          value={leg.arriveDate}
                          onChange={(v) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveDate: v } : l) }))}
                          placeholder="Pick a date"
                          data-testid={`input-inbound-connecting-${idx}-arrive-date`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                        <Input
                          type="time"
                          value={leg.arriveTime}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, arriveTime: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          data-testid={`input-inbound-connecting-${idx}-arrive-time`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-black/60">Flight Number</Label>
                        <Input
                          value={leg.flightNumber}
                          onChange={(e) => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: prev.inboundConnectingLegs.map((l, i) => i === idx ? { ...l, flightNumber: e.target.value } : l) }))}
                          className="h-9 rounded-xl border-black/10 bg-white/70"
                          placeholder="e.g. BA456"
                          data-testid={`input-inbound-connecting-${idx}-flight-number`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                {newQuote.inboundConnectingLegs.length < 2 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 text-xs gap-1"
                    onClick={() => setNewQuote(prev => ({ ...prev, inboundConnectingLegs: [...prev.inboundConnectingLegs, { departAirportId: "", departAirport: "", arriveAirportId: "", arriveAirport: "", departDate: "", departTime: "", arriveDate: "", arriveTime: "", flightNumber: "" }] }))}
                    data-testid="btn-add-inbound-connecting-flight"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Connecting Flight
                  </Button>
                )}
              </div>
            </>
          )}

          {/* Package Commissions */}
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Commissions</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                <SearchableSelect
                  value={newQuote.tourOperator}
                  onValueChange={(v) => setNewQuote({ ...newQuote, tourOperator: v })}
                  options={(tourOperatorsData || []).map((t: TourOperator) => ({ value: t.id, label: t.name || "" }))}
                  placeholder="Select tour operator..."
                  searchPlaceholder="Search tour operators..."
                  emptyMessage="No tour operators found."
                  data-testid="input-tour-operator"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.sales}
                  onChange={(e) => setNewQuote({ ...newQuote, sales: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-sales"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.price}
                  onChange={(e) => setNewQuote({ ...newQuote, price: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.commission}
                  onChange={(e) => setNewQuote({ ...newQuote, commission: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-commission"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.discount}
                  onChange={(e) => setNewQuote({ ...newQuote, discount: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-discount"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.serviceCharge}
                  onChange={(e) => setNewQuote({ ...newQuote, serviceCharge: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-service-charge"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={newQuote.pricePerPerson}
                  onChange={(e) => setNewQuote({ ...newQuote, pricePerPerson: parseFloat(e.target.value) || 0 })}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-price-per-person"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="rounded-2xl border-black/10 px-4"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-quote"
            >
              Cancel
            </Button>
            <Button
              className="rounded-2xl bg-black px-4 text-white hover:bg-black/90"
              disabled={isPending}
              onClick={onSubmit}
              data-testid="button-save-quote"
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
