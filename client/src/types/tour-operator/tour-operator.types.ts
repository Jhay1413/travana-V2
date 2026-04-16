export interface TourOperatorCommission {
  package_type_id: string | null;
  tour_operator_id: string | null;
  percentage_commission: string | null;
}

export interface TourOperator {
  id: string;
  name: string | null;
  holidayType: string | null;
  commissionPercent: string | null;
  username: string | null;
  password: string | null;
  contact: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
  commissions?: TourOperatorCommission[];
}
