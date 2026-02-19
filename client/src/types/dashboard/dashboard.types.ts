export interface DashboardStats {
  totalClients: number;
  totalQuotes: number;
  totalRevenue: number;
  avgDealSize: number;
  totalTransactions: number;
  enquiryCount: number;
  quotedCount: number;
  bookedCount: number;
}

export interface ClientDashboardKPIs {
  totalActiveClients: number;
  newClientsThisMonth: number;
  repeatClientsPercent: number;
  avgBookingValue: number;
  avgLifetimeValue: number;
  avgLeadTimeDays: number;
  closeRatePercent: number;
}

export interface RebookingClient {
  clientId: string;
  clientName: string;
  lastBookingDate: string | null;
  lastTravelDate: string | null;
  totalBookings: number;
  lifetimeValue: number;
  avgBookingCycleDays: number | null;
  daysSinceLastBooking: number | null;
  segment: "hot" | "warm" | "cold";
}

export interface RebookingDashboard {
  hot: RebookingClient[];
  warm: RebookingClient[];
  cold: RebookingClient[];
}

export interface VIPClient {
  clientId: string;
  clientName: string;
  lifetimeValue: number;
  totalBookings: number;
  referralCount: number;
  avgBookingValue: number;
}

export interface VIPDashboard {
  byLifetimeValue: VIPClient[];
  byBookings: VIPClient[];
  byReferrals: VIPClient[];
}

export interface MonthCount {
  month: number;
  count: number;
}

export interface NameCount {
  name: string;
  count: number;
}

export interface BehaviourDashboard {
  bookingMonths: MonthCount[];
  departureMonths: MonthCount[];
  topDestinations: NameCount[];
  topAirports: NameCount[];
  avgLeadTimeTrend: { month: string; avgDays: number }[];
}

export interface ClientListItem {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  lifetimeValue: number;
  totalBookings: number;
  totalEnquiries: number;
  lastBookingDate: string | null;
  lastTravelDate: string | null;
  assignedAgent: string | null;
  leadSource: string | null;
  createdAt: string;
}

export interface ClientListResponse {
  clients: ClientListItem[];
  total: number;
  page: number;
  limit: number;
}
