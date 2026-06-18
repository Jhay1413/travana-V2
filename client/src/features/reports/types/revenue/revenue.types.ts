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
  id: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  destination: string;
  travelDate: string;
  commission: number;
  agentId: string;
  agentName: string;
  isUpsell?: boolean;
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
