/** A passenger as returned by the API. Dates are YYYY-MM-DD. */
export interface ClientPassenger {
  /** null only for the lead when no lead row has been saved yet. */
  id: string | null;
  isLead: boolean;
  title: string | null;
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportNonUk: boolean;
  passportWarning: boolean;
  /** Read from the passport (customer portal); null when not recorded. */
  nationality: string | null;
  /** 'M' | 'F' | 'X', or null. */
  sex: string | null;
  passportIssueDate: string | null;
  /**
   * Present on the answer to an edit: gaps in the saved record (no title, passport close to expiry, ...). They never
   * refuse a save; the UI shows them next to the passport warning.
   */
  warnings?: string[];
}

export interface ClientPassengersResponse {
  passengers: ClientPassenger[];
  nextDeparture: string | null;
}

/** The passport details the customer portal reads from a passport; all optional on every staff write. */
export interface PassportExtraFields {
  nationality?: string | null;
  sex?: string | null;
  passportIssueDate?: string | null;
}

/** Normalised writable fields of a non-lead passenger. */
export interface PassengerFields extends PassportExtraFields {
  title: string | null;
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
  passportNonUk: boolean;
}

export interface LeadPassportFields extends PassportExtraFields {
  passportNumber: string | null;
  passportExpiry: string | null;
  passportNonUk: boolean;
}

export interface CreatePassengerInput extends PassportExtraFields {
  title?: string | null;
  firstName: string;
  surname: string;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportNonUk?: boolean;
}

export type UpdatePassengerInput = Partial<CreatePassengerInput>;
