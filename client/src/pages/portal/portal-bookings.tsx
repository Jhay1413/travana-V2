import { motion } from "framer-motion";
import { Briefcase, Calendar, ExternalLink, MapPin, Hash, Inbox, ChevronRight, Home } from "lucide-react";
import { useLocation } from "wouter";
import PortalLayout from "./portal-layout";
import { usePortalBookings, type PortalBooking } from "@/hooks/use-portal-api";

function GlassCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`backdrop-blur-xl bg-white/[0.08] border border-white/[0.12] rounded-3xl ${className}`}>
      {children}
    </div>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/[0.08] rounded-2xl ${className}`} />;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const fallbackBookings: PortalBooking[] = [];

function BookingCardSkeleton() {
  return (
    <GlassCard className="overflow-hidden">
      <Skeleton className="h-36 rounded-none rounded-t-3xl" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <div className="flex gap-2">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </GlassCard>
  );
}

export default function PortalBookingsPage() {
  const { data: apiBookings, isLoading, isError } = usePortalBookings();
  const bookings = apiBookings ?? (isError ? fallbackBookings : []);
  const loading = isLoading;

  const [, setLocation] = useLocation();

  return (
    <PortalLayout>
      <div className="px-4 pt-6 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 mb-4 text-xs" data-testid="breadcrumb-bookings">
          <button onClick={() => setLocation("/portal")} className="text-white/40 hover:text-white/70 transition-colors flex items-center gap-1">
            <Home className="w-3 h-3" /> Home
          </button>
          <ChevronRight className="w-3 h-3 text-white/20" />
          <span className="text-white/70">My Bookings</span>
        </div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500/30 to-cyan-500/30 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="text-xl font-bold text-white" data-testid="text-bookings-title">My Bookings</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            <BookingCardSkeleton />
          </div>
        ) : bookings.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Inbox className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 font-medium mb-1" data-testid="text-empty-bookings">No bookings yet</p>
            <p className="text-white/40 text-sm">Your confirmed bookings will appear here</p>
          </GlassCard>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking, idx) => (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <GlassCard className="overflow-hidden" data-testid={`card-booking-${booking.id}`}>
                  <div className="relative h-36">
                    <img
                      src={booking.image_url}
                      alt={booking.destination}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      data-testid={`img-booking-${booking.id}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 left-4">
                      <p className="text-white font-semibold text-lg" data-testid={`text-booking-destination-${booking.id}`}>{booking.destination}</p>
                      <p className="text-white/60 text-xs flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {booking.hotel}
                      </p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <span className="flex items-center gap-1 text-white/50 text-xs">
                        <Calendar className="w-3 h-3" />
                        {formatDate(booking.travel_date)} — {formatDate(booking.return_date)}
                      </span>
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-medium" data-testid={`text-booking-ref-${booking.id}`}>
                        <Hash className="w-3 h-3" />
                        {booking.booking_reference}
                      </span>
                    </div>
                    <a
                      href={booking.documents_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 rounded-2xl bg-white/[0.06] border border-white/[0.1] text-white text-sm font-medium flex items-center justify-center gap-2 hover:bg-white/[0.1] transition-all"
                      data-testid={`button-view-docs-${booking.id}`}
                    >
                      <ExternalLink className="w-4 h-4" /> View Documents
                    </a>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
