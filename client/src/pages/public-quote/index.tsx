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
  Zap,
  CreditCard,
  Languages,
  ShieldAlert,
  Droplets,
  Plug,
  Info,
} from "lucide-react";
import {
  usePublicQuote,
  useLogQuoteView,
  useSubmitQuoteAction,
  useShareQuote,
  type PublicQuoteData,
} from "@/hooks/queries/use-quote-public-queries";
import { getPortalToken } from "@/hooks/use-portal-api";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";
import tinasLogo from "@assets/Tinas-Travel-Logo-Red-Orange-Final-2_1773285329238.png";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    // Parse date parts directly from the string to avoid browser timezone conversion.
    // new Date("2025-12-15T00:30:00") is treated as UTC and shifts to local time,
    // which can change the displayed date for clients in different timezones.
    const datePart = dateStr.includes("T") ? dateStr.substring(0, 10) : dateStr.substring(0, 10);
    const [year, month, day] = datePart.split("-").map(Number);
    const d = new Date(year, month - 1, day); // local date, no UTC conversion
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return "";
  const tIdx = dateTimeStr.indexOf("T");
  if (tIdx === -1) return "";
  return dateTimeStr.substring(tIdx + 1).substring(0, 5);
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

type GuruMonthTemp = { month: string; avgHigh: number; avgLow: number; rainfall: number };
type GuruMustDoItem = {
  rank: number; name: string; category?: string; shortDesc?: string;
  price?: string; openingHours?: string; tips?: string; bestFor?: string;
  duration?: string; address?: string;
};

function ClimateBar({ entry, maxHigh }: { entry: GuruMonthTemp; maxHigh: number }) {
  const h = maxHigh > 0 ? Math.max(4, Math.round((entry.avgHigh / maxHigh) * 56)) : 20;
  const c = entry.avgHigh >= 35 ? "#ef4444" : entry.avgHigh >= 30 ? "#f97316" : entry.avgHigh >= 25 ? "#eab308" : entry.avgHigh >= 20 ? "#22c55e" : entry.avgHigh >= 15 ? "#06b6d4" : "#3b82f6";
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-[9px] text-white/50 font-mono tabular-nums">{entry.avgHigh}°</span>
      <div className="w-full max-w-[20px] rounded-t" style={{ height: h, backgroundColor: c, opacity: 0.8 }} />
      <span className="text-[9px] text-white/35">{entry.month}</span>
    </div>
  );
}

function EssentialRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/[0.06] last:border-0">
      <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-3.5 h-3.5 text-[#FF6B35]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold mb-0.5">{label}</p>
        <p className="text-sm text-white/70 leading-snug">{value}</p>
      </div>
    </div>
  );
}

function DestinationGuruSection({ guru }: { guru: NonNullable<PublicQuoteData["destinationGuru"]> }) {
  const [guruExpanded, setGuruExpanded] = useState(false);
  const [openActivities, setOpenActivities] = useState<Set<number>>(new Set());

  const data = (typeof guru.data === "string" ? tryParseJson(guru.data) : guru.data) as any;
  if (!data) return null;

  const toggleActivity = (rank: number) => {
    setOpenActivities(prev => {
      const next = new Set(prev);
      if (next.has(rank)) next.delete(rank); else next.add(rank);
      return next;
    });
  };

  const temps: GuruMonthTemp[] = Array.isArray(data.temperatures) ? data.temperatures : [];
  const maxHigh = temps.length > 0 ? Math.max(...temps.map((t: GuruMonthTemp) => t.avgHigh)) : 0;
  const mustDo: GuruMustDoItem[] = Array.isArray(data.mustDo) ? data.mustDo : [];

  const hasMeaningfulData = data.travelInfo || mustDo.length > 0 || data.bestTimeToVisit || data.tagline || data.flightTimesFromUK || temps.length > 0;
  if (!hasMeaningfulData) return null;

  return (
    <SectionWrapper delay={0.12}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500/30 to-teal-500/30 flex items-center justify-center">
              {data.heroEmoji ? (
                <span className="text-xl leading-none">{data.heroEmoji}</span>
              ) : (
                <Globe className="w-5 h-5 text-emerald-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white" data-testid="text-guru-title">Destination Guide</h2>
              <p className="text-sm text-white/40">{guru.destination}{guru.country ? `, ${guru.country}` : ""}</p>
            </div>
          </div>
          <button
            onClick={() => setGuruExpanded(e => !e)}
            className="text-white/40 hover:text-white transition-colors p-1"
            data-testid="button-guru-toggle"
          >
            <ChevronDown className={`w-10 h-10 transition-transform duration-300 ${guruExpanded ? "rotate-180" : ""}`} />
          </button>
        </div>

        {data.travelInfo.summary && (
          <p className="text-white/40 text-xs leading-relaxed mt-4 pl-3 border-l-2 border-[#FF6B35]/40">
            {data.travelInfo.summary}
          </p>
        )}

        <AnimatePresence>
          {guruExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="overflow-hidden"
            >
              <div className="mt-6 space-y-5">
                {data.bestTimeToVisit && (
                  <div className="p-5 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35] mb-3">Best Time to Visit</p>
                    {data.bestTimeToVisit.months && (
                      <p className="text-white text-2xl font-extrabold tracking-tight mb-2">{data.bestTimeToVisit.months}</p>
                    )}
                    {data.bestTimeToVisit.reason && (
                      <p className="text-white/55 text-sm leading-relaxed mb-4">{data.bestTimeToVisit.reason}</p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      {data.bestTimeToVisit.peakSeason && (
                        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                          <Zap className="w-3.5 h-3.5 text-[#FF6B35]" />
                          <span className="text-xs text-white/50">Peak</span>
                          <span className="text-xs font-bold text-white">{data.bestTimeToVisit.peakSeason}</span>
                        </div>
                      )}
                      {data.bestTimeToVisit.budgetSeason && (
                        <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                          <CreditCard className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-xs text-white/50">Best value</span>
                          <span className="text-xs font-bold text-white">{data.bestTimeToVisit.budgetSeason}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {temps.length > 0 && (
                  <div className="p-5 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35] mb-4">Climate by Month</p>
                    <div className="flex items-end gap-2 justify-between">
                      {temps.map((t) => <ClimateBar key={t.month} entry={t} maxHigh={maxHigh} />)}
                    </div>
                    <p className="text-white/30 text-xs mt-3">Average high °C</p>
                  </div>
                )}

                {data.flightTimesFromUK && (
                  <div className="p-5 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35] mb-4">Getting There from the UK</p>
                    <div className="grid grid-cols-3 gap-px bg-white/10 rounded-xl overflow-hidden">
                      {data.flightTimesFromUK.directHours && (
                        <div className="bg-[#0a0a0f] px-3 py-4 text-center">
                          <Clock className="w-4 h-4 text-[#FF6B35] mx-auto mb-2" />
                          <p className="text-white font-bold text-sm">{data.flightTimesFromUK.directHours}</p>
                          <p className="text-white/40 text-xs mt-0.5">Flight time</p>
                        </div>
                      )}
                      {data.flightTimesFromUK.airports?.length > 0 && (
                        <div className="bg-[#0a0a0f] px-3 py-4 text-center">
                          <MapPin className="w-4 h-4 text-[#FF6B35] mx-auto mb-2" />
                          <p className="text-white font-bold text-sm">{(data.flightTimesFromUK.airports as string[]).join(", ")}</p>
                          <p className="text-white/40 text-xs mt-0.5">UK airports</p>
                        </div>
                      )}
                      {data.flightTimesFromUK.airlines?.length > 0 && (
                        <div className="bg-[#0a0a0f] px-3 py-4 text-center">
                          <Plane className="w-4 h-4 text-[#FF6B35] mx-auto mb-2" />
                          <p className="text-white font-bold text-sm">{(data.flightTimesFromUK.airlines as string[]).join(", ")}</p>
                          <p className="text-white/40 text-xs mt-0.5">Airlines</p>
                        </div>
                      )}
                    </div>
                    {data.flightTimesFromUK.tips && (
                      <p className="text-white/40 text-xs leading-relaxed mt-4 pl-3 border-l-2 border-[#FF6B35]/40">
                        {data.flightTimesFromUK.tips}
                      </p>
                    )}
                  </div>
                )}

                {data.travelInfo && (
                  <div className="p-5 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35] mb-2">Travel Essentials</p>
                    {data.travelInfo.currency && <EssentialRow icon={CreditCard} label="Currency" value={data.travelInfo.currency} />}
                    {data.travelInfo.language && <EssentialRow icon={Languages} label="Language" value={data.travelInfo.language} />}
                    {data.travelInfo.timezone && <EssentialRow icon={Clock} label="Time Zone" value={data.travelInfo.timezone} />}
                    {data.travelInfo.visaRequired && <EssentialRow icon={ShieldAlert} label="Visa" value={data.travelInfo.visaRequired} />}
                    {data.travelInfo.waterSafety && <EssentialRow icon={Droplets} label="Tap Water" value={data.travelInfo.waterSafety} />}
                    {data.travelInfo.plugType && <EssentialRow icon={Plug} label="Plug Type" value={data.travelInfo.plugType} />}
                    {data.travelInfo.summary && (
                      <p className="text-white/40 text-xs leading-relaxed mt-4 pl-3 border-l-2 border-[#FF6B35]/40">
                        {data.travelInfo.summary}
                      </p>
                    )}
                  </div>
                )}

                {mustDo.length > 0 && (
                  <div className="p-5 rounded-2xl bg-white/5">
                    <p className="text-xs font-bold uppercase tracking-widest text-[#FF6B35] mb-4">Top Things to Do</p>
                    {mustDo.map((item, idx) => {
                      const isOpen = openActivities.has(item.rank);
                      const hasDetails = !!(item.shortDesc || item.tips || item.bestFor || item.price || item.duration || item.openingHours || item.address);
                      return (
                        <div key={item.rank} className={idx < mustDo.length - 1 ? "border-b border-white/[0.08]" : ""}>
                          <button
                            onClick={() => hasDetails && toggleActivity(item.rank)}
                            className={`w-full flex gap-5 py-4 text-left transition-opacity ${hasDetails ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}
                          >
                            <div className="text-2xl font-extrabold text-[#FF6B35]/30 leading-none w-7 shrink-0 text-right tabular-nums pt-0.5">
                              {item.rank}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <h4 className="font-bold text-white text-sm leading-tight">{item.name}</h4>
                                  {item.category && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#FF6B35] mt-0.5 inline-block">{item.category}</span>
                                  )}
                                </div>
                                {hasDetails && (
                                  <ChevronDown className={`w-4 h-4 text-white/40 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                                )}
                              </div>
                            </div>
                          </button>
                          <div className="overflow-hidden transition-all duration-300 ease-in-out" style={{ maxHeight: isOpen ? "400px" : "0px" }}>
                            <div className="pb-4" style={{ paddingLeft: "52px" }}>
                              <div className="flex flex-wrap gap-2 mb-2">
                                {item.price && <span className="text-xs font-bold text-white bg-white/10 px-3 py-1 rounded-full">{item.price}</span>}
                                {item.duration && (
                                  <span className="text-xs text-white/50 flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                    <Clock className="w-3 h-3" />{item.duration}
                                  </span>
                                )}
                                {item.openingHours && (
                                  <span className="text-xs text-white/50 flex items-center gap-1 bg-white/5 px-3 py-1 rounded-full">
                                    <Info className="w-3 h-3" />{item.openingHours}
                                  </span>
                                )}
                              </div>
                              {item.shortDesc && <p className="text-white/55 text-sm leading-relaxed mb-2">{item.shortDesc}</p>}
                              {item.tips && <p className="text-white/40 text-xs leading-relaxed italic pl-3 border-l border-[#FF6B35]/30 mb-2">{item.tips}</p>}
                              {item.bestFor && (
                                <p className="text-xs text-white/40">
                                  <span className="text-white/60 font-semibold">Best for: </span>{item.bestFor}
                                </p>
                              )}
                              {item.address && (
                                <p className="text-xs text-white/35 flex items-center gap-1.5 mt-1.5">
                                  <MapPin className="w-3 h-3 shrink-0" />{item.address}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassCard>
    </SectionWrapper>
  );
}

function FlightsSection({ flights }: { flights: PublicQuoteData["flights"] }) {
  if (flights.length === 0) return null;

  const outboundLegs = flights
    .filter(f => f.flightType === "outbound")
    .sort((a, b) => (a.legOrder || 0) - (b.legOrder || 0));
  const inboundLegs = flights
    .filter(f => f.flightType === "inbound")
    .sort((a, b) => (a.legOrder || 0) - (b.legOrder || 0));

  const renderFlightLeg = (f: PublicQuoteData["flights"][0], label: string, legIdx: number) => (
    <div className="p-4 rounded-2xl bg-white/5">
      <p className="text-[11px] font-bold uppercase tracking-widest text-white/40 mb-3">{label}</p>
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm sm:truncate" data-testid={`text-flight-from-${legIdx}`}>{f.departingAirport || "TBC"}</p>
          <p className="text-xs text-white/40 mt-0.5">{formatDate(f.departureDateTime)}</p>
          <p className="text-base font-mono font-bold text-white/80 mt-1">{formatTime(f.departureDateTime)}</p>
        </div>
        <div className="flex items-center sm:flex-col sm:items-center gap-1 sm:shrink-0 sm:px-2">
          <div className="flex-1 sm:hidden h-px bg-gradient-to-r from-blue-500/40 to-transparent" />
          <Plane className="w-4 h-4 text-blue-400 shrink-0" />
          {f.flightNumber && (
            <span className="text-[10px] text-white/25 font-mono">{f.flightNumber}</span>
          )}
          <div className="flex-1 sm:flex-none sm:w-12 h-px bg-gradient-to-r from-transparent to-purple-500/40 sm:from-blue-500/40 sm:to-purple-500/40" />
        </div>
        <div className="flex-1 min-w-0 sm:text-right">
          <p className="text-white font-semibold text-sm sm:truncate" data-testid={`text-flight-to-${legIdx}`}>{f.arrivalAirport || "TBC"}</p>
          <p className="text-xs text-white/40 mt-0.5">{formatDate(f.arrivalDateTime)}</p>
          <p className="text-base font-mono font-bold text-white/80 mt-1">{formatTime(f.arrivalDateTime)}</p>
        </div>
      </div>
    </div>
  );

  const renderJourney = (legs: PublicQuoteData["flights"], direction: "outbound" | "inbound") => {
    if (legs.length === 0) return null;
    const isOutbound = direction === "outbound";

    return (
      <div className={`rounded-2xl border overflow-hidden ${isOutbound ? "border-blue-500/20" : "border-purple-500/20"}`}>
        <div className={`flex items-center gap-2 px-4 py-2.5 ${isOutbound ? "bg-blue-500/10" : "bg-purple-500/10"}`}>
          <Plane className={`w-3.5 h-3.5 ${isOutbound ? "text-blue-400" : "text-purple-400"}`} />
          <span className={`text-xs font-bold tracking-wide ${isOutbound ? "text-blue-300" : "text-purple-300"}`}>
            {isOutbound ? "Outbound Journey" : "Return Journey"}
          </span>
          {legs.length > 1 && (
            <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${isOutbound ? "bg-blue-500/20 text-blue-300/70" : "bg-purple-500/20 text-purple-300/70"}`}>
              {legs.length} legs
            </span>
          )}
        </div>
        <div className="p-3 grid gap-1.5">
          {legs.map((f, i) => {
            const label = i === 0
              ? isOutbound ? "Outbound Flight" : "Return Flight"
              : `Connecting Flight ${i + 1}`;
            return (
              <div key={i}>
                {i > 0 && (
                  <div className="flex items-center gap-2 my-1.5 px-1">
                    <div className="flex-1 border-t border-dashed border-white/10" />
                    <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">Connecting</span>
                    <div className="flex-1 border-t border-dashed border-white/10" />
                  </div>
                )}
                {renderFlightLeg(f, label, i)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <SectionWrapper delay={0.1}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center">
            <Plane className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-xl font-bold text-white" data-testid="text-flights-title">Flights</h2>
        </div>
        <div className="grid gap-4">
          {renderJourney(outboundLegs, "outbound")}
          {renderJourney(inboundLegs, "inbound")}
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
  // Show the calculated customer total (sales − discount + service charge), not the raw sales price.
  const total = formatCurrency(quote.totalPrice ?? quote.salesPrice);
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

function ShareSection({ token, quote }: { token: string; quote: PublicQuoteData }) {
  const [copied, setCopied] = useState(false);
  const shareMutation = useShareQuote();
  const quoteUrl = window.location.href;
  const shareText = `Check out this amazing ${quote.destinationName || "holiday"} quote from Tinas Travel!`;

  const handleShare = (method: string) => {
    shareMutation.mutate({ token, method });

    switch (method) {
      case "WhatsApp":
        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + quoteUrl)}`, "_blank");
        break;
      case "Facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(quoteUrl)}`, "_blank");
        break;
      case "Email":
        window.open(`mailto:?subject=${encodeURIComponent(`Holiday Quote - ${quote.destinationName || "Your Trip"}`)}&body=${encodeURIComponent(shareText + "\n\n" + quoteUrl)}`, "_blank");
        break;
      case "Copy Link":
        navigator.clipboard.writeText(quoteUrl).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
        break;
    }
  };

  return (
    <SectionWrapper delay={0.35}>
      <GlassCard className="p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 flex items-center justify-center">
            <Send className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white" data-testid="text-share-title">Share This Quote</h2>
            <p className="text-xs text-white/40">Love this holiday? Share it with friends & family</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => handleShare("WhatsApp")}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#25D366]/10 border border-[#25D366]/20 hover:bg-[#25D366]/20 transition-colors text-[#25D366] text-sm font-medium"
            data-testid="button-share-whatsapp"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            WhatsApp
          </button>
          <button
            onClick={() => handleShare("Facebook")}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#1877F2]/10 border border-[#1877F2]/20 hover:bg-[#1877F2]/20 transition-colors text-[#1877F2] text-sm font-medium"
            data-testid="button-share-facebook"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
            Facebook
          </button>
          <button
            onClick={() => handleShare("Email")}
            className="flex items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white/80 text-sm font-medium"
            data-testid="button-share-email"
          >
            <MessageSquare className="w-5 h-5" />
            Email
          </button>
          <button
            onClick={() => handleShare("Copy Link")}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border text-sm font-medium transition-all ${copied
              ? "bg-green-500/10 border-green-500/20 text-green-400"
              : "bg-white/5 border-white/10 hover:bg-white/10 text-white/80"
              }`}
            data-testid="button-share-copy"
          >
            {copied ? <Check className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
            {copied ? "Copied!" : "Copy Link"}
          </button>
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
            className={`p-4 rounded-2xl border-2 transition-all text-left ${actionType === "accepted"
              ? "border-green-500/50 bg-green-500/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            data-testid="button-accept-quote"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${actionType === "accepted" ? "bg-green-500/30" : "bg-white/10"
                }`}>
                <Check className={`w-4 h-4 ${actionType === "accepted" ? "text-green-400" : "text-white/50"}`} />
              </div>
              <span className="font-semibold text-white">I'd like to book this</span>
            </div>
            <p className="text-xs text-white/40 pl-11">Confirm you're happy and want to proceed</p>
          </button>

          <button
            onClick={() => setActionType("changes_requested")}
            className={`p-4 rounded-2xl border-2 transition-all text-left ${actionType === "changes_requested"
              ? "border-blue-500/50 bg-blue-500/10"
              : "border-white/10 bg-white/5 hover:bg-white/10"
              }`}
            data-testid="button-request-changes"
          >
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${actionType === "changes_requested" ? "bg-blue-500/30" : "bg-white/10"
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
      logView.mutate({ token });
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

  return <PublicQuoteContent quote={quote} token={token} />;
}

export function PublicQuoteContent({ quote, token, isPortal = false }: { quote: PublicQuoteData; token: string; isPortal?: boolean }) {
  // The booking decision section is only available to clients viewing through
  // the authenticated portal — public link viewers cannot accept/request changes.
  const canTakeAction = isPortal && getPortalToken() !== null;
  return (
    <div className="min-h-screen bg-[#0a0a0f]" data-testid="page-public-quote">
      <HeroSection quote={quote} images={quote.images} />


      <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-6 md:space-y-8">
        {quote.destinationGuru && (
          <DestinationGuruSection guru={quote.destinationGuru} />
        )}
        <ImageGallery images={quote.images} />


        <FlightsSection flights={quote.flights} />
        <TransfersMealsSeatsSection quote={quote} />
        <AccommodationSection accommodations={quote.accommodations} />
        <CruiseSection cruises={quote.cruises} />
        <TransfersSection transfers={quote.transfers} />
        <ExtrasSection quote={quote} />
        <PricingSection quote={quote} />
        <AgentSection agent={quote.agent} />
        <ShareSection token={token} quote={quote} />
        {canTakeAction && <CustomerActionSection token={token} />}
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
