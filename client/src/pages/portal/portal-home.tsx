import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  FileText, Briefcase, Tag, MessageCircle, Plus,
  Plane, Calendar, Users, MapPin, X, Send, Loader2,
  Heart, ArrowRight, Sparkles, ChevronRight, ChevronLeft, Eye, Bell,
} from "lucide-react";
import PortalLayout from "./portal-layout";
import defaultHeroBg from "@assets/Maldives_1773092726855.png";
import {
  usePortalUser,
  usePortalQuotes,
  usePortalBookings,
  usePortalMessages,
  usePortalDeals,
  useSubmitQuoteRequest,
  getPortalToken,
  type PortalDeal,
  type PortalQuote,
} from "@/hooks/use-portal-api";

function GlassCard({ children, className = "", ...rest }: { children: React.ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`} {...rest}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

const fallbackDeals: PortalDeal[] = [];

const fallbackQuotes: PortalQuote[] = [];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function DealsCarousel({ deals }: { deals: PortalDeal[] }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const touchStartX = useRef(0);

  const count = deals.length;
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (current >= count) setCurrent(0);
  }, [count, current]);

  const navigate = useCallback((idx: number, dir: number) => {
    const next = ((idx % count) + count) % count;
    setDirection(dir);
    setCurrent(next);
  }, [count]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % count);
    }, 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count]);

  const resetAutoPlay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrent((c) => (c + 1) % count);
    }, 5000);
  }, [count]);

  const handlePrev = () => { navigate(current - 1, -1); resetAutoPlay(); };
  const handleNext = () => { navigate(current + 1, 1); resetAutoPlay(); };
  const handleDot = (i: number) => { navigate(i, i > current ? 1 : -1); resetAutoPlay(); };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
  };

  if (count === 0) return null;
  const deal = deals[current] ?? deals[0];

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0.3 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0.3 }),
  };

  return (
    <div className="relative" data-testid="deals-carousel">
      <div
        className="relative overflow-hidden rounded-3xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ minHeight: 290 }}
      >
        <AnimatePresence initial={false} custom={direction}>
          <motion.div
            key={deal.id}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className="absolute inset-0"
          >
            <GlassCard className="overflow-hidden h-full" data-testid={`home-deal-${deal.id}`}>
              <div className="relative h-44">
                <img
                  src={deal.image_url || defaultHeroBg}
                  alt={deal.destination}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                {deal.price > 0 && (
                  <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 text-white text-[10px] font-bold">
                    {formatCurrency(deal.price)}
                  </span>
                )}
                <div className="absolute bottom-2.5 left-3 right-3">
                  <p className="text-white font-semibold text-sm leading-snug">{deal.title}</p>
                  <p className="text-white/50 text-[11px] flex items-center gap-1 mt-0.5">
                    <MapPin className="w-2.5 h-2.5" /> {deal.destination}
                  </p>
                </div>
              </div>
              <div className="p-3">
                <div className="flex items-center justify-between mb-2.5 text-white/50 text-[11px]">
                  {deal.hotel && (
                    <span className="flex items-center gap-1 truncate">
                      <MapPin className="w-2.5 h-2.5 shrink-0" /> {deal.hotel}
                    </span>
                  )}
                  <span className="flex items-center gap-1 shrink-0">
                    {deal.travel_date && <><Calendar className="w-2.5 h-2.5" /> {formatDate(deal.travel_date)}</>}
                    {deal.num_nights ? ` · ${deal.num_nights} nights` : ""}
                  </span>
                </div>
                {deal.quote_url ? (
                  <a
                    href={deal.quote_url}
                    className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-500/80 to-blue-500/80 text-white hover:from-purple-500 hover:to-blue-500 transition-all"
                    data-testid={`home-view-quote-${deal.id}`}
                  >
                    <Eye className="w-3 h-3" /> View Quote
                  </a>
                ) : (
                  <span className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 bg-white/[0.06] text-white/40">
                    Quote Unavailable
                  </span>
                )}
              </div>
            </GlassCard>
          </motion.div>
        </AnimatePresence>

        {count > 1 && (
          <>
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full backdrop-blur-md bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all z-10"
              data-testid="carousel-prev"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full backdrop-blur-md bg-black/40 border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all z-10"
              data-testid="carousel-next"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {deals.map((_, i) => (
            <button
              key={i}
              onClick={() => handleDot(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 h-1.5 bg-gradient-to-r from-purple-500 to-blue-500"
                  : "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
              }`}
              data-testid={`carousel-dot-${i}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PushNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = getPortalToken();
    if (!token) return;

    const missing: string[] = [];
    if (!("serviceWorker" in navigator)) missing.push("ServiceWorker");
    if (!("PushManager" in window)) missing.push("PushManager");
    if (!("Notification" in window)) missing.push("Notification");

    if (missing.length > 0) {
      const inIframe = window.self !== window.top;
      const ua = navigator.userAgent || "";
      const isIOS = /iPhone|iPad|iPod/.test(ua);
      const isSafari = /Safari/.test(ua) && !/CriOS|Chrome/.test(ua);
      if (inIframe) {
        setErrorMsg("Open this site directly in your browser to enable notifications.");
      } else if (isIOS) {
        setErrorMsg("On iPhone, add this site to your Home Screen first (tap Share → Add to Home Screen), then open it from there to enable notifications.");
      } else {
        setErrorMsg(`Push not supported. Browser: ${ua.slice(0, 80)}`);
      }
      setShow(true);
      return;
    }

    if (Notification.permission === "denied") {
      setErrorMsg("Notifications blocked. Please enable them in your browser settings.");
      setShow(true);
      return;
    }

    if (Notification.permission === "granted") {
      navigator.serviceWorker.getRegistration("/portal-sw.js").then(reg => {
        if (reg) {
          reg.pushManager.getSubscription().then(sub => {
            if (!sub) setShow(true);
          });
        } else {
          setShow(true);
        }
      });
    } else {
      setShow(true);
    }
  }, []);

  const handleEnable = async () => {
    setStatus("loading");
    try {
      const reg = await navigator.serviceWorker.register("/portal-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setErrorMsg("Permission was not granted.");
        setStatus("error");
        return;
      }

      const vapidRes = await fetch("/api/portal/push/vapid-key");
      const { key } = await vapidRes.json();

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });

      const token = getPortalToken();
      const saveRes = await fetch("/api/portal/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(sub.toJSON()),
      });

      if (!saveRes.ok) throw new Error(`Save failed: ${saveRes.status}`);

      setStatus("done");
      setTimeout(() => setShow(false), 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Unknown error");
      setStatus("error");
    }
  };

  if (!show) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/30 p-4"
      data-testid="push-notification-prompt"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-500/30 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-purple-300" />
        </div>
        <div className="flex-1 min-w-0">
          {status === "done" ? (
            <p className="text-green-400 text-sm font-medium">Notifications enabled!</p>
          ) : errorMsg ? (
            <>
              <p className="text-white text-sm font-semibold">Notifications</p>
              <p className="text-red-300 text-xs mt-1">{errorMsg}</p>
            </>
          ) : (
            <>
              <p className="text-white text-sm font-semibold">Stay Updated</p>
              <p className="text-white/60 text-xs mt-0.5">Get notified when your agent replies</p>
              <button
                onClick={handleEnable}
                disabled={status === "loading"}
                className="mt-2 px-4 py-1.5 rounded-lg bg-purple-500 text-white text-xs font-semibold hover:bg-purple-400 transition-colors disabled:opacity-50"
                data-testid="button-enable-push"
              >
                {status === "loading" ? "Enabling..." : "Turn on Notifications"}
              </button>
            </>
          )}
        </div>
        <button onClick={() => setShow(false)} className="text-white/40 hover:text-white/70">
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
}

export default function PortalHomePage() {
  const [, setLocation] = useLocation();
  const [showQuoteForm, setShowQuoteForm] = useState(false);
  const [quoteForm, setQuoteForm] = useState({ destination: "", dates: "", travellers: "2", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const { data: user, isLoading: userLoading } = usePortalUser();
  const { data: quotes, isLoading: quotesLoading, isError: quotesError } = usePortalQuotes();
  const { data: bookings, isLoading: bookingsLoading } = usePortalBookings();
  const { data: messages, isLoading: messagesLoading } = usePortalMessages();
  const { data: apiDeals, isLoading: dealsLoading, isError: dealsError } = usePortalDeals();
  const quoteRequestMutation = useSubmitQuoteRequest();

  const statsLoading = userLoading || quotesLoading || bookingsLoading || messagesLoading;
  const activeQuotes = quotes?.length ?? 0;
  const upcomingBookings = bookings?.length ?? 0;
  const unreadMessages = messages?.length ?? 0;
  const greeting = user?.firstName ? `Hello, ${user.firstName}` : "Hello, Traveller";

  const deals = apiDeals ?? (dealsError ? fallbackDeals : []);
  const resolvedQuotes = quotes && quotes.length > 0 ? quotes : fallbackQuotes;
  const latestQuotes = resolvedQuotes.slice(0, 2);

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await quoteRequestMutation.mutateAsync(quoteForm);
    } catch {}
    setSubmitted(true);
    setTimeout(() => {
      setShowQuoteForm(false);
      setSubmitted(false);
      setQuoteForm({ destination: "", dates: "", travellers: "2", notes: "" });
    }, 2000);
  };

  return (
    <PortalLayout>
      <div className="max-w-lg mx-auto">
        <div className="relative overflow-hidden rounded-b-[2rem]">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 border-b border-white/[0.12] backdrop-blur-xl" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[120%] h-48 bg-gradient-to-b from-purple-500/40 via-fuchsia-500/25 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-48 h-48 bg-blue-600/15 rounded-full blur-3xl translate-y-1/3 translate-x-1/4" />

          <div className="relative z-10 px-5 pt-10 pb-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <p className="text-white/50 text-sm">Welcome back</p>
              </div>
              <h1 className="text-2xl font-bold text-white mb-5" data-testid="text-greeting">{greeting}</h1>

              <div className="flex gap-2.5">
                {statsLoading ? (
                  <>
                    <Skeleton className="h-[72px] flex-1" />
                    <Skeleton className="h-[72px] flex-1" />
                    <Skeleton className="h-[72px] flex-1" />
                  </>
                ) : (
                  <>
                    <button onClick={() => setLocation("/portal/quotes")} className="flex-1 min-w-0 backdrop-blur-md bg-white/[0.1] border border-white/[0.15] rounded-2xl p-3 text-center hover:bg-white/[0.15] transition-colors" data-testid="stat-active-quotes">
                      <p className="text-xl font-bold text-purple-400">{activeQuotes}</p>
                      <p className="text-[10px] text-white/50 mt-0.5">Quotes</p>
                    </button>
                    <button onClick={() => setLocation("/portal/bookings")} className="flex-1 min-w-0 backdrop-blur-md bg-white/[0.1] border border-white/[0.15] rounded-2xl p-3 text-center hover:bg-white/[0.15] transition-colors" data-testid="stat-upcoming-trips">
                      <p className="text-xl font-bold text-blue-400">{upcomingBookings}</p>
                      <p className="text-[10px] text-white/50 mt-0.5">Trips</p>
                    </button>
                    <button onClick={() => setLocation("/portal/messages")} className="flex-1 min-w-0 backdrop-blur-md bg-white/[0.1] border border-white/[0.15] rounded-2xl p-3 text-center hover:bg-white/[0.15] transition-colors" data-testid="stat-messages">
                      <p className="text-xl font-bold text-green-400">{unreadMessages}</p>
                      <p className="text-[10px] text-white/50 mt-0.5">Messages</p>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="px-4 pt-5 space-y-6">
          <PushNotificationPrompt />
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowQuoteForm(true)}
            className="w-full"
            data-testid="button-request-quote"
          >
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 p-4 flex items-center gap-4">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
              <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5 text-white" />
              </div>
              <div className="text-left relative z-10">
                <p className="text-white font-semibold text-sm">Request a Quote</p>
                <p className="text-white/60 text-xs">Tell us your dream destination</p>
              </div>
              <ChevronRight className="w-5 h-5 text-white/40 ml-auto" />
            </div>
          </motion.button>

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-400" />
                <h2 className="text-base font-bold text-white">Latest Deals</h2>
              </div>
              <button onClick={() => setLocation("/portal/deals")} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors" data-testid="link-view-all-deals">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {dealsLoading ? (
              <div className="relative overflow-hidden rounded-3xl">
                <Skeleton className="h-[290px] w-full" />
              </div>
            ) : deals.length === 0 ? (
              <GlassCard className="p-6 text-center">
                <Tag className="w-8 h-8 text-white/15 mx-auto mb-2" />
                <p className="text-white/50 text-sm">No deals right now — check back soon!</p>
              </GlassCard>
            ) : (
              <DealsCarousel deals={deals} />
            )}
          </motion.div>

          {latestQuotes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <h2 className="text-base font-bold text-white">Your Quotes</h2>
                </div>
                <button onClick={() => setLocation("/portal/quotes")} className="text-xs text-purple-400 flex items-center gap-1 hover:text-purple-300 transition-colors" data-testid="link-view-all-quotes">
                  View all <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="space-y-3">
                {latestQuotes.map((quote, idx) => (
                  <motion.div
                    key={quote.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + idx * 0.08 }}
                  >
                    <GlassCard className="p-3 flex items-center gap-3" data-testid={`home-quote-${quote.id}`}>
                      <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0">
                        {quote.image_url ? (
                          <img src={quote.image_url} alt={quote.destination} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-purple-900/60 via-blue-900/40 to-[#0a0a0f] flex items-center justify-center">
                            <Plane className="w-6 h-6 text-white/20" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm truncate">{quote.title}</p>
                        <p className="text-white/40 text-xs flex items-center gap-1 mt-0.5">
                          <MapPin className="w-2.5 h-2.5" /> {quote.destination}
                        </p>
                        <p className="text-white font-semibold text-sm mt-1">{formatCurrency(quote.price)}</p>
                      </div>
                      <a
                        href={quote.quote_url}
                        className="w-9 h-9 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0 hover:bg-purple-500/30 transition-colors"
                        data-testid={`home-view-quote-${quote.id}`}
                      >
                        <Eye className="w-4 h-4 text-purple-400" />
                      </a>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="pb-4"
          >
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3">Quick Access</h2>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "Quotes", icon: FileText, path: "/portal/quotes", color: "text-purple-400", bg: "from-purple-500/20 to-indigo-500/20" },
                { label: "Bookings", icon: Briefcase, path: "/portal/bookings", color: "text-blue-400", bg: "from-blue-500/20 to-cyan-500/20" },
                { label: "Deals", icon: Tag, path: "/portal/deals", color: "text-amber-400", bg: "from-amber-500/20 to-orange-500/20" },
                { label: "Messages", icon: MessageCircle, path: "/portal/messages", color: "text-green-400", bg: "from-green-500/20 to-emerald-500/20" },
              ].map(sc => (
                <motion.button
                  key={sc.path}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setLocation(sc.path)}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-colors"
                  data-testid={`shortcut-${sc.label.toLowerCase()}`}
                >
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${sc.bg} flex items-center justify-center`}>
                    <sc.icon className={`w-4 h-4 ${sc.color}`} />
                  </div>
                  <span className="text-[10px] text-white/60 font-medium">{sc.label}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {showQuoteForm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-end justify-center"
          onClick={() => setShowQuoteForm(false)}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", bounce: 0.1, duration: 0.4 }}
            className="w-full max-w-lg"
            onClick={e => e.stopPropagation()}
          >
            <GlassCard className="p-6 rounded-b-none border-b-0">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white" data-testid="text-quote-form-title">Request a Quote</h2>
                <button onClick={() => setShowQuoteForm(false)} className="text-white/40 hover:text-white transition-colors" data-testid="button-close-quote-form">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {submitted ? (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-8">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <Plane className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-white font-semibold mb-1" data-testid="text-quote-request-success">Quote Request Sent!</p>
                  <p className="text-white/50 text-sm">Your agent will be in touch soon</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmitQuote} className="space-y-4">
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Destination</label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={quoteForm.destination}
                        onChange={e => setQuoteForm(p => ({ ...p, destination: e.target.value }))}
                        placeholder="Where do you want to go?"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-purple-500/50"
                        required
                        data-testid="input-destination"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Travel Dates</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        value={quoteForm.dates}
                        onChange={e => setQuoteForm(p => ({ ...p, dates: e.target.value }))}
                        placeholder="e.g. July 2025, 7 nights"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-purple-500/50"
                        data-testid="input-dates"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Number of Travellers</label>
                    <div className="relative">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                      <input
                        type="number"
                        min="1"
                        value={quoteForm.travellers}
                        onChange={e => setQuoteForm(p => ({ ...p, travellers: e.target.value }))}
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white text-sm focus:outline-none focus:border-purple-500/50"
                        data-testid="input-travellers"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-white/60 mb-1.5">Notes</label>
                    <textarea
                      value={quoteForm.notes}
                      onChange={e => setQuoteForm(p => ({ ...p, notes: e.target.value }))}
                      placeholder="Anything else you'd like us to know?"
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white placeholder:text-white/30 text-sm focus:outline-none focus:border-purple-500/50 resize-none"
                      data-testid="input-notes"
                    />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={quoteRequestMutation.isPending}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    data-testid="button-submit-quote-request"
                  >
                    {quoteRequestMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Send className="w-4 h-4" /> Send Request</>}
                  </motion.button>
                </form>
              )}
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </PortalLayout>
  );
}
