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
  passportWarning: boolean;
}

export interface ClientPassengersResponse {
  passengers: ClientPassenger[];
  nextDeparture: string | null;
}

/** Normalised writable fields of a non-lead passenger. */
export interface PassengerFields {
  title: string | null;
  firstName: string;
  surname: string;
  dateOfBirth: string | null;
  passportNumber: string | null;
  passportExpiry: string | null;
}

export interface LeadPassportFields {
  passportNumber: string | null;
  passportExpiry: string | null;
}

export interface CreatePassengerInput {
  title?: string | null;
  firstName: string;
  surname: string;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
}

export type UpdatePassengerInput = Partial<CreatePassengerInput>;
