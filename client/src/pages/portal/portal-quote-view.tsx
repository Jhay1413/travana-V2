import { useRoute, useLocation } from "wouter";
import { useEffect, useRef } from "react";
import { Home, ChevronRight, Loader2, X } from "lucide-react";
import PortalLayout from "./portal-layout";
import {
  usePublicQuote,
  useLogQuoteView,
  useSubmitQuoteAction,
  useShareQuote,
  type PublicQuoteData,
} from "@/hooks/queries/use-quote-public-queries";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";
import tinasLogo from "@assets/Tinas-Travel-Logo-Red-Orange-Final-2_1773285329238.png";
import {
  Plane, Hotel, Calendar, Users, MapPin, Clock, ChevronDown, ChevronUp,
  Star, Car, Ticket, Ship, Armchair, ParkingCircle, ArrowRight, Check,
  MessageSquare, Send, Globe, Sun, Utensils, Landmark, Heart, AlertCircle,
  PawPrint, Phone,
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr || "";
  }
}

function formatTime(dateTimeStr: string | null | undefined): string {
  if (!dateTimeStr) return "";
  const tIdx = dateTimeStr.indexOf("T");
  if (tIdx === -1) return "";
  return dateTimeStr.substring(tIdx + 1).substring(0, 5);
}

function formatCurrency(value: string | number | null | undefined): string {
  if (!value) return "£0.00";
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

export default function PortalQuoteViewPage() {
  const [, params] = useRoute("/portal/quote/:token");
  const token = params?.token || "";
  const [, setLocation] = useLocation();
  const { data: quote, isLoading, error } = usePublicQuote(token);
  const logView = useLogQuoteView();
  const viewLogged = useRef(false);

  useEffect(() => {
    if (token && !viewLogged.current) {
      viewLogged.current = true;
      logView.mutate(token);
    }
  }, [token]);

  return (
    <PortalLayout>
      <div className="max-w-lg mx-auto">
        <div className="px-4 pt-6">
          <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-quote-view">
            <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
              <Home className="w-3 h-3" /> Home
            </button>
            <ChevronRight className="w-3 h-3 text-white/20" />
            <button onClick={() => setLocation("/portal/deals")} className="text-white/40 hover:text-white/70 transition-colors">
              Deals
            </button>
            <ChevronRight className="w-3 h-3 text-white/20" />
            <span className="text-white/70 truncate max-w-[150px]">{quote?.title || "Quote"}</span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20" data-testid="loading-portal-quote">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-white/40 animate-spin mx-auto mb-4" />
              <p className="text-white/30 text-sm">Loading your quote...</p>
            </div>
          </div>
        ) : error || !quote ? (
          <div className="flex items-center justify-center py-20 px-4" data-testid="error-portal-quote">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <X className="w-8 h-8 text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Quote Not Found</h1>
              <p className="text-white/50">This quote link may have expired or is no longer available.</p>
            </div>
          </div>
        ) : (
          <PortalQuoteContent quote={quote} token={token} />
        )}
      </div>
    </PortalLayout>
  );
}

function PortalQuoteContent({ quote, token }: { quote: PublicQuoteData; token: string }) {
  const heroImage = quote.images?.[0]?.url || defaultHeroBg;

  return (
    <div data-testid="portal-quote-content">
      <div className="relative h-48 overflow-hidden">
        <img src={heroImage} alt={quote.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] via-black/40 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-xl font-bold text-white mb-1" data-testid="text-quote-title">{quote.title}</h1>
          <p className="text-white/60 text-sm flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {[quote.destinationName, quote.countryName].filter(Boolean).join(", ")}
          </p>
        </div>
      </div>

      <div className="px-4 py-5 space-y-4">
        <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Travel Date</p>
                <p className="text-white text-sm font-medium">{formatDate(quote.travelDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Duration</p>
                <p className="text-white text-sm font-medium">{quote.numNights} nights</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Users className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Travellers</p>
                <p className="text-white text-sm font-medium">
                  {quote.adults} adults{quote.children ? `, ${quote.children} children` : ""}{quote.infants ? `, ${quote.infants} infants` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Globe className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Type</p>
                <p className="text-white text-sm font-medium">{quote.holidayType || "Holiday"}</p>
              </div>
            </div>
          </div>
        </div>

        {quote.flights && quote.flights.length > 0 && (
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-4 h-4 text-purple-400" />
              <h2 className="text-white font-semibold text-sm">Flights</h2>
            </div>
            <div className="space-y-3">
              {quote.flights.map((flight: any, i: number) => (
                <div key={i} className="bg-white/[0.04] rounded-2xl p-3">
                  <p className="text-purple-400 text-[10px] uppercase tracking-wider font-semibold mb-1.5">{flight.flightType}</p>
                  <div className="flex items-center justify-between">
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">{formatTime(flight.departureDateTime)}</p>
                      <p className="text-white/40 text-[10px] mt-0.5">{flight.departingAirport}</p>
                    </div>
                    <div className="flex-1 mx-3 flex items-center">
                      <div className="h-px flex-1 bg-white/10" />
                      <Plane className="w-3.5 h-3.5 text-white/30 mx-1.5 rotate-90" />
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    <div className="text-center">
                      <p className="text-white font-semibold text-sm">{formatTime(flight.arrivalDateTime)}</p>
                      <p className="text-white/40 text-[10px] mt-0.5">{flight.arrivalAirport}</p>
                    </div>
                  </div>
                  <p className="text-white/30 text-[10px] mt-1.5 text-center">{formatDate(flight.departureDateTime)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {quote.accommodations && quote.accommodations.length > 0 && (
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Hotel className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold text-sm">Accommodation</h2>
            </div>
            <div className="space-y-3">
              {quote.accommodations.map((acc: any, i: number) => (
                <div key={i} className="bg-white/[0.04] rounded-2xl p-3">
                  <p className="text-white font-medium text-sm">{acc.name}</p>
                  {acc.starRating && (
                    <div className="flex items-center gap-0.5 mt-1">
                      {Array.from({ length: acc.starRating }).map((_, s) => (
                        <Star key={s} className="w-3 h-3 text-amber-400 fill-amber-400" />
                      ))}
                    </div>
                  )}
                  <div className="mt-2 space-y-1">
                    {acc.roomType && <p className="text-white/50 text-xs flex items-center gap-1.5"><Hotel className="w-3 h-3" /> {acc.roomType}</p>}
                    {acc.boardBasis && <p className="text-white/50 text-xs flex items-center gap-1.5"><Utensils className="w-3 h-3" /> {acc.boardBasis}</p>}
                    {acc.checkInDateTime && <p className="text-white/50 text-xs flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Check-in: {formatDate(acc.checkInDateTime)}</p>}
                    {acc.resortName && <p className="text-white/50 text-xs flex items-center gap-1.5"><MapPin className="w-3 h-3" /> {acc.resortName}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {quote.transfers && quote.transfers.length > 0 && (
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car className="w-4 h-4 text-green-400" />
              <h2 className="text-white font-semibold text-sm">Transfers</h2>
            </div>
            <div className="space-y-2">
              {quote.transfers.map((t: any, i: number) => (
                <div key={i} className="bg-white/[0.04] rounded-2xl p-3">
                  <p className="text-white text-sm">{t.type || "Transfer"}</p>
                  {t.details && <p className="text-white/40 text-xs mt-1">{t.details}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {quote.transferType && (
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <Car className="w-4 h-4 text-green-400" />
              <h2 className="text-white font-semibold text-sm">Transfers</h2>
            </div>
            <p className="text-white/50 text-xs ml-6">{quote.transferType}</p>
          </div>
        )}

        <div className="backdrop-blur-xl bg-gradient-to-br from-purple-600/20 via-blue-600/15 to-purple-600/20 border border-purple-500/20 rounded-3xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-white font-semibold text-sm">Your Price</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-white/60 text-sm">Total Price</span>
              <span className="text-white font-bold text-xl">{formatCurrency(quote.salesPrice)}</span>
            </div>
            {quote.pricePerPerson && (
              <div className="flex items-center justify-between">
                <span className="text-white/40 text-xs">Per Person</span>
                <span className="text-white/60 text-sm">{formatCurrency(quote.pricePerPerson)}</span>
              </div>
            )}
          </div>
        </div>

        {quote.agent && (
          <div className="backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl p-4">
            <div className="flex items-center gap-3">
              {quote.agent.avatar ? (
                <img src={quote.agent.avatar} alt={quote.agent.name} className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-purple-500/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-400" />
                </div>
              )}
              <div>
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Your Travel Advisor</p>
                <p className="text-white font-medium text-sm">{quote.agent.name}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
