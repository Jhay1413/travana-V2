export interface MonthForwards {
  month: string; // "April 2026"
  shortMonth: string; // "Apr"
  year: number;
  monthNumber: number; // 1-12
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
  bookingId: string;
  clientName: string;
  destination: string;
  travelDate: string;
  commission: number;
  agentId: string;
  agentName: string;
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
