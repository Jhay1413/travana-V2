/** Dropdown option for an operator in the agency's list. `id` is the catalogue id used by every FK. */
export interface TourOperator {
  id: string;
  linkId: string;
  name: string | null;
  logo_url: string | null;
  code: string | null;
  commission_percentage: string | null;
  balance_due_weeks: number;
  is_active: boolean;
}
