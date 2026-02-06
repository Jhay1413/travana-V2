export interface Client {
  id: string;
  clientType: string;
  title: string | null;
  firstName: string | null;
  lastName: string | null;
  name: string;
  email: string | null;
  phone: string;
  tier: string;
  stage: string;
  location: string | null;
  houseNumber: string | null;
  street: string | null;
  city: string | null;
  country: string | null;
  postcode: string | null;
  nextTrip: string | null;
  value: string;
  lastTouch: string | null;
  tags: string[];
  userId: string | null;
  createdAt: string;
}

export interface CreateClientData {
  clientType: string;
  title?: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  houseNumber?: string;
  street?: string;
  city?: string;
  country?: string;
  postcode?: string;
}
