import { useState, useEffect, useRef } from "react";
import { useRoute } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plane,
  Hotel,
  Calendar,
  Users,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  Car,
  Ticket,
  Ship,
  Armchair,
  ParkingCircle,
  ArrowRight,
  Check,
  MessageSquare,
  Send,
  Loader2,
  Globe,
  Sun,
  Utensils,
  Landmark,
  Heart,
  AlertCircle,
  X,
  PawPrint,
  Phone,
} from "lucide-react";
import {
  usePublicQuote,
  useLogQuoteView,
  useSubmitQuoteAction,
  type PublicQuoteData,
} from "@/hooks/queries/use-quote-public-queries";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";
import tinasLogo from "@assets/Tinas-Travel-Logo-Red-Orange-Final-2_1773285329238.png";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return "";
  try {
    const d = new Date(dateTimeStr);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatCurrency(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num) || num === 0) return "";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

function returnDate(travelDate: string | null, nights: number): string {
  if (!travelDate || !nights) return "";
  const d = new Date(travelDate);
  d.setDate(d.getDate() + nights);
  return formatDate(d.toISOString());
}

function SectionWrapper({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay }}
    >
      {children}
    </motion.div>
  );
}

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function getResponsiveImageUrl(
  url: string,
  width: number,
  height: number,
): string {
  const tuiMatch = url.match(/^(https?:\/\/content\.tui\.co\.uk\/.+\.(jpg|jpeg|png|webp))/i);
  if (tuiMatch) {
    return `${tuiMatch[1]}?i10c=img.resize(width:${width});img.crop(width:${width}%2Cheight:${height})`;
  }
  return url;
}

function HeroSection({ quote, images }: { quote: PublicQuoteData; images: Array<{ id: string; image_url: string | null; isPrimary: boolean | null }> }) {
  const validImages = images.filter(i => i.image_url);
  const primaryImage = validImages.find(i => i.isPrimary) || validImages[0];
  const heroUrl = primaryImage?.image_url || null;

  const mobileUrl = heroUrl ? getResponsiveImageUrl(heroUrl, 800, 1200) : null;
  const desktopUrl = heroUrl ? getResponsiveImageUrl(heroUrl, 1920, 1080) : null;

  const totalPax = quote.adults + quote.children + quote.infants;

  return (
    <div className="relative min-h-[70vh] md:min-h-[80vh] flex items-end overflow-hidden">
      {heroUrl ? (
        <div className="absolute inset-0">
          <picture>
            <source
              media="(max-width: 768px)"
              srcSet={mobileUrl!}
            />
            <source
              media="(min-width: 769px)"
              srcSet={desktopUrl!}
            />
            <img
              src={desktopUrl!}
              alt={quote.title || quote.destinationName || "Holiday destination"}
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
              data-testid="img-hero"
            />
          </picture>
        </div>
      ) : (
        <div className="absolute inset-0">
          <img
            src={defaultHeroBg}
            alt="Holiday destination"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />

      <div className="relative z-10 w-full px-4 md:px-8 pb-10 md:pb-14">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            {quote.holidayType && (
              <span className="inline-block px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-white/10 backdrop-blur-md border border-white/20 text-white/90 mb-4" data-testid="text-holiday-type">
                {quote.holidayType}
              </span>
            )}
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3 tracking-tight leading-tight" data-testid="text-quote-title">
              {quote.title || `${quote.destinationName || "Your Holiday"}`}
            </h1>
            {(quote.destinationName || quote.countryName) && (
              <p className="text-lg md:text-xl text-white/70 flex items-center gap-2 mb-6" data-testid="text-destination">
                <MapPin className="w-5 h-5" />
                {[quote.resortName, quote.destinationName, quote.countryName].filter(Boolean).join(", ")}
              </p>
            )}

            <div className="flex flex-wrap gap-3 md:gap-4">
              {quote.travelDate && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm" data-testid="text-travel-dates">
                  <Calendar className="w-4 h-4 text-blue-300" />
                  {formatDate(quote.travelDate)} — {returnDate(quote.travelDate, quote.numNights)}
                </div>
              )}
              {quote.numNights > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm" data-testid="text-nights">
                  <Clock className="w-4 h-4 text-purple-300" />
                  {quote.numNights} night{quote.numNights !== 1 ? "s" : ""}
                </div>
              )}
              {totalPax > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm" data-testid="text-passengers">
                  <Users className="w-4 h-4 text-green-300" />
                  {quote.adults} adult{quote.adults !== 1 ? "s" : ""}
                  {quote.children > 0 && `, ${quote.children} child${quote.children !== 1 ? "ren" : ""}`}
                  {quote.infants > 0 && `, ${quote.infants} infant${quote.infants !== 1 ? "s" : ""}`}
                </div>
              )}
              {quote.pets > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-sm" data-testid="text-pets">
                  <PawPrint className="w-4 h-4 text-amber-300" />
                  {quote.pets} pet{quote.pets !== 1 ? "s" : ""}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function ImageGallery({ images }: { images: PublicQuoteData["images"] }) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const validImages = images.filter(i => i.image_url);

  if (validImages.length <= 1) return null;

  return (
    <>
      <SectionWrapper delay={0.05}>
        <GlassCard className="p-4 md:p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white" data-testid="text-gallery-title">Gallery</h2>
            <span className="text-xs text-white/40 ml-auto">{validImages.length} photos</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
            {validImages.map((img, idx) => (
              <motion.button
                key={img.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedIdx(idx)}
                className="relative aspect-square rounded-xl overflow-hidden group cursor-pointer border border-white/10 hover:border-white/30 transition-colors"
                data-testid={`gallery-thumb-${idx}`}
              >
                <img
                  src={getResponsiveImageUrl(img.image_url!, 300, 300)}
                  alt={`Photo ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </motion.button>
            ))}
          </div>
        </GlassCard>
      </SectionWrapper>

      <AnimatePresence>
        {selectedIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setSelectedIdx(null)}
            data-testid="gallery-lightbox"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[85vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSelectedIdx(null)}
                className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors z-10"
                data-testid="button-close-lightbox"
              >
                <X className="w-5 h-5" />
              </button>

              <img
                src={validImages[selectedIdx]?.image_url || ""}
                alt={`Photo ${selectedIdx + 1}`}
                className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
                data-testid="img-lightbox"
              />

              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => setSelectedIdx(prev => prev !== null && prev > 0 ? prev - 1 : validImages.length - 1)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  data-testid="button-lightbox-prev"
                >
                  <ChevronUp className="w-5 h-5 -rotate-90" />
                </button>
                <span className="text-white/60 text-sm">{selectedIdx + 1} / {validImages.length}</span>
                <button
                  onClick={() => setSelectedIdx(prev => prev !== null && prev < validImages.length - 1 ? prev + 1 : 0)}
                  className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
                  data-testid="button-lightbox-next"
                >
                  <ChevronDown className="w-5 h-5 -rotate-90" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function DestinationGuruSection({ guru }: { guru: NonNullable<PublicQuoteData["destinationGuru"]> }) {
  const [expanded, setExpanded] = useState(false);
  const data = typeof guru.data === "string" ? tryParseJson(guru.data) : guru.data;
  if (!data) return null;

  const sections = [
    { key: "overview", icon: Globe, label: "Overview", color: "text-blue-400" },
    { key: "weather", icon: Sun, label: "Weather & Best Time", color: "text-amber-400" },
    { key: "food", icon: Utensils, label: "Food & Dining", color: "text-orange-400" },
    { key: "attractions", icon: Landmark, label: "Top Attractions", color: "text-purple-400" },
    { key: "tips", icon: Heart, label: "Travel Tips", color: "text-pink-400" },
  ];

  const availableSections = sections.filter(s => data[s.key]);

  if (availableSections.length === 0) return null;

  return (
    <SectionWrapper delay={0.1}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center">
              <Globe className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white" data-testid="text-guru-title">Destination Intelligence</h2>
              <p className="text-sm text-white/50">{guru.destination}{guru.country ? `, ${guru.country}` : ""}</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-white/50 hover:text-white transition-colors"
            data-testid="button-guru-toggle"
          >
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid gap-4">
                {availableSections.map(section => (
                  <div key={section.key} className="rounded-2xl bg-white/5 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <section.icon className={`w-4 h-4 ${section.color}`} />
                      <h3 className="text-sm font-semibold text-white/90">{section.label}</h3>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed whitespace-pre-line" data-testid={`text-guru-${section.key}`}>
                      {typeof data[section.key] === "string" ? data[section.key] : JSON.stringify(data[section.key], null, 2)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!expanded && availableSections.length > 0 && data.overview && (
          <p className="text-sm text-white/50 line-clamp-2">{typeof data.overview === "string" ? data.overview : ""}</p>
        )}
      </GlassCard>
    </SectionWrapper>
  );
}

function FlightsSection({ flights }: { flights: PublicQuoteData["flights"] }) {
  if (flights.length === 0) return null;

  const outbound = flights.filter(f => f.flightType === "outbound" || f.legOrder === 1);
  const inbound = flights.filter(f => f.flightType === "inbound" || f.legOrder === 2);
  const other = flights.filter(f => !outbound.includes(f) && !inbound.includes(f));

  const renderFlight = (f: PublicQuoteData["flights"][0], idx: number) => (
    <div key={idx} className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 p-4 rounded-2xl bg-white/5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white/50 mb-1">{f.flightType === "outbound" ? "Departing" : f.flightType === "inbound" ? "Returning" : "Flight"}</p>
        <p className="text-white font-medium truncate" data-testid={`text-flight-route-${idx}`}>{f.departingAirport || "TBC"}</p>
        <p className="text-xs text-white/40">{formatDate(f.departureDateTime)} · {formatTime(f.departureDateTime)}</p>
      </div>
      <div className="hidden md:flex flex-col items-center gap-1 px-4">
        <div className="w-24 h-px bg-gradient-to-r from-blue-500/50 to-purple-500/50 relative">
          <Plane className="w-4 h-4 text-blue-400 absolute -top-2 left-1/2 -translate-x-1/2" />
        </div>
        {f.flightNumber && <span className="text-[10px] text-white/30 mt-1">{f.flightNumber}</span>}
      </div>
      <div className="flex-1 min-w-0 md:text-right">
        <p className="text-sm text-white/50 mb-1">Arriving</p>
        <p className="text-white font-medium truncate" data-testid={`text-flight-arrival-${idx}`}>{f.arrivalAirport || "TBC"}</p>
        <p className="text-xs text-white/40">{formatDate(f.arrivalDateTime)} · {formatTime(f.arrivalDateTime)}</p>
      </div>
    </div>
  );

  return (
    <SectionWrapper delay={0.1}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center">
            <Plane className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-flights-title">Flights</h2>
        </div>
        <div className="grid gap-3">
          {outbound.map((f, i) => renderFlight(f, i))}
          {inbound.map((f, i) => renderFlight(f, outbound.length + i))}
          {other.map((f, i) => renderFlight(f, outbound.length + inbound.length + i))}
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function TransfersMealsSeatsSection({ quote }: { quote: PublicQuoteData }) {
  const transferType = quote.transferType && quote.transferType !== "none" ? quote.transferType : null;

  if (!transferType && !quote.flightMeals && !quote.preBookedSeats) return null;

  return (
    <SectionWrapper delay={0.12}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-500/30 to-cyan-500/30 flex items-center justify-center">
            <Utensils className="w-5 h-5 text-teal-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-transfers-meals-seats-title">Transfers, Meals & Seats</h2>
        </div>
        <div className="grid gap-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
            <Car className="w-4 h-4 text-green-400 shrink-0" />
            <div>
              <p className="text-xs text-white/40">Transfer Type</p>
              <p className="text-sm text-white/80 font-medium" data-testid="text-transfer-type">{transferType || "None"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
            <Utensils className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <p className="text-xs text-white/40">In-Flight Meals</p>
              <p className="text-sm text-white/80 font-medium" data-testid="text-flight-meals">{quote.flightMeals ? "Included" : "Not Included"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
            <Armchair className="w-4 h-4 text-blue-400 shrink-0" />
            <div>
              <p className="text-xs text-white/40">Pre-Booked Seats</p>
              <p className="text-sm text-white/80 font-medium" data-testid="text-pre-booked-seats">{quote.preBookedSeats || "None"}</p>
            </div>
          </div>
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function AccommodationSection({ accommodations }: { accommodations: PublicQuoteData["accommodations"] }) {
  if (accommodations.length === 0) return null;

  return (
    <SectionWrapper delay={0.15}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500/30 to-orange-500/30 flex items-center justify-center">
            <Hotel className="w-5 h-5 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-accommodation-title">Accommodation</h2>
        </div>
        <div className="grid gap-4">
          {accommodations.map((a, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-white/5">
              <h3 className="text-lg font-semibold text-white mb-2" data-testid={`text-accom-name-${idx}`}>{a.name || "Accommodation"}</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {a.roomType && (
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Room Type</p>
                    <p className="text-sm text-white/80" data-testid={`text-accom-room-${idx}`}>{a.roomType}</p>
                  </div>
                )}
                {a.boardBasis && (
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Board Basis</p>
                    <p className="text-sm text-white/80" data-testid={`text-accom-board-${idx}`}>{a.boardBasis}</p>
                  </div>
                )}
                {a.starRating && (
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Rating</p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: parseInt(a.starRating) || 0 }).map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  </div>
                )}
                {a.checkInDateTime && (
                  <div>
                    <p className="text-xs text-white/40 mb-0.5">Check In</p>
                    <p className="text-sm text-white/80">{formatDate(a.checkInDateTime)}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function TransfersSection({ transfers }: { transfers: PublicQuoteData["transfers"] }) {
  if (transfers.length === 0) return null;

  return (
    <SectionWrapper delay={0.2}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-green-500/30 to-emerald-500/30 flex items-center justify-center">
            <Car className="w-5 h-5 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-transfers-title">Transfers</h2>
        </div>
        <div className="grid gap-3">
          {transfers.map((t, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white/5">
              <div className="flex-1">
                <p className="text-sm text-white/80" data-testid={`text-transfer-${idx}`}>
                  {t.from || "Pickup"} <ArrowRight className="w-3 h-3 inline mx-1 text-white/40" /> {t.to || "Dropoff"}
                </p>
                {t.note && (
                  <p className="text-xs text-white/40 mt-1">{t.note}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function ExtrasSection({ quote }: { quote: PublicQuoteData }) {
  const hasCarHire = quote.carHires.length > 0;
  const hasAttractions = quote.attractionTickets.length > 0;
  const hasLounge = quote.loungePasses.length > 0;
  const hasParking = quote.airportParkings.length > 0;

  if (!hasCarHire && !hasAttractions && !hasLounge && !hasParking) return null;

  return (
    <SectionWrapper delay={0.25}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500/30 to-rose-500/30 flex items-center justify-center">
            <Ticket className="w-5 h-5 text-pink-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-extras-title">Extras & Add-ons</h2>
        </div>
        <div className="grid gap-3">
          {quote.carHires.map((c, idx) => (
            <div key={`car-${idx}`} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
              <Car className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-sm text-white/80" data-testid={`text-car-hire-${idx}`}>Car Hire{c.numDays > 0 ? ` — ${c.numDays} day${c.numDays > 1 ? "s" : ""}` : ""}</p>
                <p className="text-xs text-white/40">{[c.pickupLocation, c.dropoffLocation].filter(Boolean).join(" → ")}</p>
              </div>
            </div>
          ))}
          {quote.attractionTickets.map((t, idx) => (
            <div key={`attr-${idx}`} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
              <Ticket className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-sm text-white/80" data-testid={`text-attraction-${idx}`}>{t.type || "Attraction Ticket"}</p>
                <p className="text-xs text-white/40">{t.numberOfTickets > 0 ? `${t.numberOfTickets} ticket${t.numberOfTickets > 1 ? "s" : ""}` : ""}{t.dateOfVisit ? ` · ${formatDate(t.dateOfVisit)}` : ""}</p>
              </div>
            </div>
          ))}
          {quote.loungePasses.map((l, idx) => (
            <div key={`lounge-${idx}`} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
              <Armchair className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm text-white/80" data-testid={`text-lounge-${idx}`}>{l.airportName || "Lounge Pass"}</p>
                <p className="text-xs text-white/40">{[l.terminal ? `Terminal ${l.terminal}` : "", l.dateOfUsage ? formatDate(l.dateOfUsage) : ""].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
          ))}
          {quote.airportParkings.map((p, idx) => (
            <div key={`park-${idx}`} className="flex items-center gap-3 p-4 rounded-2xl bg-white/5">
              <ParkingCircle className="w-4 h-4 text-green-400 shrink-0" />
              <div>
                <p className="text-sm text-white/80" data-testid={`text-parking-${idx}`}>{p.parkingType || "Airport Parking"}</p>
                <p className="text-xs text-white/40">{p.airportName}{p.parkingDate ? ` · ${formatDate(p.parkingDate)}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function CruiseSection({ cruises }: { cruises: PublicQuoteData["cruises"] }) {
  if (cruises.length === 0) return null;

  return (
    <SectionWrapper delay={0.15}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center">
            <Ship className="w-5 h-5 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-cruise-title">Cruise</h2>
        </div>
        <div className="grid gap-4">
          {cruises.map((c, idx) => (
            <div key={idx} className="p-4 rounded-2xl bg-white/5">
              <h3 className="text-lg font-semibold text-white mb-2" data-testid={`text-cruise-name-${idx}`}>{c.cruiseName || c.ship || "Cruise"}</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {c.cruiseLine && <div><p className="text-xs text-white/40">Cruise Line</p><p className="text-sm text-white/80">{c.cruiseLine}</p></div>}
                {c.ship && <div><p className="text-xs text-white/40">Ship</p><p className="text-sm text-white/80">{c.ship}</p></div>}
                {c.cabinType && <div><p className="text-xs text-white/40">Cabin</p><p className="text-sm text-white/80">{c.cabinType}</p></div>}
                {c.cruiseDate && <div><p className="text-xs text-white/40">Date</p><p className="text-sm text-white/80">{formatDate(c.cruiseDate)}</p></div>}
              </div>
              {c.itinerary.length > 0 && (
                <div className="border-t border-white/10 pt-3 mt-3">
                  <p className="text-xs text-white/40 mb-2">Itinerary</p>
                  <div className="grid gap-1">
                    {c.itinerary.map((it, i) => (
                      <div key={i} className="flex gap-3 text-sm">
                        <span className="text-white/30 w-12 shrink-0">Day {it.day}</span>
                        <span className="text-white/70">{it.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function PricingSection({ quote }: { quote: PublicQuoteData }) {
  const total = formatCurrency(quote.salesPrice);
  const pp = formatCurrency(quote.pricePerPerson);

  if (!total) return null;

  return (
    <SectionWrapper delay={0.3}>
      <div className="rounded-3xl bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border border-white/15 p-6 md:p-8 backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white mb-6" data-testid="text-pricing-title">Your Price</h2>
        <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
          <div>
            <p className="text-sm text-white/50 mb-1">Total Package Price</p>
            <p className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent" data-testid="text-total-price">
              {total}
            </p>
          </div>
          {pp && (
            <div className="text-right">
              <p className="text-sm text-white/50 mb-1">Price Per Person</p>
              <p className="text-2xl font-semibold text-white/90" data-testid="text-price-pp">{pp}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-white/30 mt-4">Prices include all applicable taxes and fees. Subject to availability.</p>
      </div>
    </SectionWrapper>
  );
}

function AgentSection({ agent }: { agent: PublicQuoteData["agent"] }) {
  return (
    <SectionWrapper delay={0.35}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shrink-0 overflow-hidden">
            {agent.avatar ? (
              <img src={agent.avatar} alt={agent.name} className="w-full h-full object-cover" data-testid="img-agent-avatar" />
            ) : (
              agent.name.charAt(0)
            )}
          </div>
          <div>
            <p className="text-sm text-white/50">Your Travel Advisor</p>
            <p className="text-lg font-semibold text-white" data-testid="text-agent-name">{agent.name}</p>
            <a
              href="tel:01915947999"
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/20 hover:text-white"
              data-testid="button-call-agent"
            >
              <Phone className="h-3.5 w-3.5" />
              Call 0191 594 7999
            </a>
          </div>
        </div>
      </GlassCard>
    </SectionWrapper>
  );
}

function CustomerActionSection({ token }: { token: string }) {
  const [actionType, setActionType] = useState<"accepted" | "changes_requested" | null>(null);
  const [message, setMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submitAction = useSubmitQuoteAction();

  const handleSubmit = () => {
    if (!actionType) return;
    submitAction.mutate(
      { token, actionType, message: message || undefined, customerName: customerName || undefined },
      {
        onSuccess: () => setSubmitted(true),
      },
    );
  };

  if (submitted) {
    return (
      <SectionWrapper delay={0.4}>
        <GlassCard className="p-6 md:p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <Check className="w-8 h-8 text-green-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2" data-testid="text-action-success">Thank You!</h2>
          <p className="text-white/60">
            {actionType === "accepted"
              ? "We've received your booking confirmation. Your travel advisor will be in touch shortly."
              : "We've received your feedback. Your travel advisor will review and get back to you soon."}
          </p>
        </GlassCard>
      </SectionWrapper>
    );
  }

  return (
    <SectionWrapper delay={0.4}>
      <GlassCard className="p-6 md:p-8">
        <h2 className="text-xl font-bold text-white mb-2" data-testid="text-actions-title">What would you like to do?</h2>
        <p className="text-sm text-white/50 mb-6">Let your travel advisor know your decision</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => setActionType("accepted")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              actionType === "accepted"
                ? "border-green-500/50 bg-green-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
            data-testid="button-accept-quote"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                actionType === "accepted" ? "bg-green-500/30" : "bg-white/10"
              }`}>
                <Check className={`w-4 h-4 ${actionType === "accepted" ? "text-green-400" : "text-white/50"}`} />
              </div>
              <span className="font-semibold text-white">I'd like to book this</span>
            </div>
            <p className="text-xs text-white/40 pl-11">Confirm you're happy and want to proceed</p>
          </button>

          <button
            onClick={() => setActionType("changes_requested")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${
              actionType === "changes_requested"
                ? "border-blue-500/50 bg-blue-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
            data-testid="button-request-changes"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                actionType === "changes_requested" ? "bg-blue-500/30" : "bg-white/10"
              }`}>
                <MessageSquare className={`w-4 h-4 ${actionType === "changes_requested" ? "text-blue-400" : "text-white/50"}`} />
              </div>
              <span className="font-semibold text-white">Request changes</span>
            </div>
            <p className="text-xs text-white/40 pl-11">Let us know what you'd like to change</p>
          </button>
        </div>

        <AnimatePresence>
          {actionType && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-white/60 block mb-1.5">Your Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors"
                    data-testid="input-customer-name"
                  />
                </div>
                {actionType === "changes_requested" && (
                  <div>
                    <label className="text-sm text-white/60 block mb-1.5">What changes would you like?</label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="E.g. different dates, room upgrade, add activities..."
                      rows={3}
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors resize-none"
                      data-testid="input-change-message"
                    />
                  </div>
                )}
                <button
                  onClick={handleSubmit}
                  disabled={submitAction.isPending}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  data-testid="button-submit-action"
                >
                  {submitAction.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      {actionType === "accepted" ? "Confirm Booking" : "Send Request"}
                    </>
                  )}
                </button>
                {submitAction.isError && (
                  <p className="text-red-400 text-sm flex items-center gap-1" data-testid="text-action-error">
                    <AlertCircle className="w-4 h-4" />
                    Something went wrong. Please try again.
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </SectionWrapper>
  );
}

function tryParseJson(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

export default function PublicQuotePage() {
  const [, params] = useRoute("/view-quote/:token");
  const token = params?.token || "";
  const { data: quote, isLoading, error } = usePublicQuote(token);
  const logView = useLogQuoteView();
  const viewLogged = useRef(false);

  useEffect(() => {
    if (token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [token]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center" data-testid="loading-public-quote">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
          <p className="text-white/30 text-sm">Loading your quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-4" data-testid="error-public-quote">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <X className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Quote Not Found</h1>
          <p className="text-white/50">This quote link may have expired or is no longer available. Please contact your travel advisor for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]" data-testid="page-public-quote">
      <HeroSection quote={quote} images={quote.images} />

      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6 md:space-y-8">
        <ImageGallery images={quote.images} />

        {quote.destinationGuru && (
          <DestinationGuruSection guru={quote.destinationGuru} />
        )}

        <FlightsSection flights={quote.flights} />
        <TransfersMealsSeatsSection quote={quote} />
        <AccommodationSection accommodations={quote.accommodations} />
        <CruiseSection cruises={quote.cruises} />
        <TransfersSection transfers={quote.transfers} />
        <ExtrasSection quote={quote} />
        <PricingSection quote={quote} />
        <AgentSection agent={quote.agent} />
        <CustomerActionSection token={token} />
      </div>

      <footer className="border-t border-white/5 py-6 mt-8">
        <div className="max-w-5xl mx-auto px-4 md:px-8 text-center">
          <p className="text-white/20 text-xs">
            Powered by TravelHub · Quote prepared exclusively for you
          </p>
        </div>
      </footer>
    </div>
  );
}
