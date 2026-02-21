export interface TourOperatorCommission {
  package_type_id: string | null;
  tour_operator_id: string | null;
  percentage_commission: string | null;
}

export interface TourOperator {
  id: string;
  name: string | null;
  commissions: TourOperatorCommission[];
}
