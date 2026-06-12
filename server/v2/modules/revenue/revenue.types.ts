export interface MonthForwards {
  month: string;
  shortMonth: string;
  year: number;
  monthNumber: number;
  forwards: number;
  target: number;
  deals: number;
  avgDealValue: number;
}

export interface AgentPerformance {
  agentId: string;
  name: string;
  forwards: number;
  deals: number;
  avgProfit: number;
}

export interface BookingDetail {
  /** Unique per row — bookingId for bookings, upsellId for upsells (a booking and
   *  its upsell can both appear in the same month, so bookingId isn't unique). */
  id: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  destination: string;
  travelDate: string;
  commission: number;
  agentId: string;
  agentName: string;
  /** True when this row is an upsell (commission recognised by `added_at`). */
  isUpsell?: boolean;
  /** Human label for the upsell type, e.g. "Extra Nights" (upsell rows only). */
  upsellLabel?: string;
}

export interface RevenueDashboardData {
  nextMonthForwards: number;
  total12MonthForwards: number;
  avgDealProfit: number;
  nextMonthTarget: number;
  dealsNeeded: number;
  monthlyData: MonthForwards[];
  agentPerformance: AgentPerformance[];
}

export interface MonthBookingsData {
  month: string;
  bookings: BookingDetail[];
}
