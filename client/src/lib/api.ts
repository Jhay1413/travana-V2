// API client for backend routes

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: string;
  stage: string;
  location: string | null;
  nextTrip: string | null;
  value: string;
  lastTouch: string | null;
  tags: string[];
  userId: string | null;
  createdAt: string;
}

export interface Quote {
  id: string;
  clientId: string;
  userId: string;
  status: string;
  packageType: string;
  quoteTitle: string;
  destination: string;
  travelDate: string;
  returnDate: string;
  passengersAdults: number;
  passengersChildren: number;
  childAges: number[];
  createdAt: string;
}

export interface Accommodation {
  id: string;
  quoteId: string;
  property: string;
  board: string;
  roomType: string;
  notes: string | null;
}

export interface Flight {
  id: string;
  quoteId: string;
  direction: string;
  fromAirport: string;
  toAirport: string;
  carrier: string;
  flightNo: string;
  depart: string;
  arrive: string;
}

export interface Commission {
  id: string;
  quoteId: string;
  tourOperator: string;
  price: string;
  commissionPercent: string;
  commissionValue: string;
  agentSplitPercent: string;
  agentSplitValue: string;
  netToAgency: string;
}

export interface QuoteImage {
  id: string;
  quoteId: string;
  url: string;
  isPrimary: boolean;
}

export interface Note {
  id: string;
  quoteId: string;
  content: string;
  createdAt: string;
}

export interface QuoteFull extends Quote {
  accommodation?: Accommodation;
  flights: Flight[];
  commission?: Commission;
  images: QuoteImage[];
  notes: Note[];
  client?: Client;
  owner?: User;
}

export interface DashboardStats {
  totalClients: number;
  totalQuotes: number;
  totalRevenue: number;
  avgDealSize: number;
  inPlayCount: number;
  wonCount: number;
  lostCount: number;
}

// Clients
export async function fetchClients(): Promise<Client[]> {
  const res = await fetch("/api/clients");
  if (!res.ok) throw new Error("Failed to fetch clients");
  return res.json();
}

export async function fetchClient(id: string): Promise<Client> {
  const res = await fetch(`/api/clients/${id}`);
  if (!res.ok) throw new Error("Failed to fetch client");
  return res.json();
}

// Quotes
export async function fetchQuotes(filters?: { status?: string; clientId?: string }): Promise<Quote[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.clientId) params.append("clientId", filters.clientId);
  
  const url = `/api/quotes${params.toString() ? `?${params.toString()}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch quotes");
  return res.json();
}

export async function fetchQuote(id: string): Promise<Quote> {
  const res = await fetch(`/api/quotes/${id}`);
  if (!res.ok) throw new Error("Failed to fetch quote");
  return res.json();
}

export async function fetchQuoteFull(id: string): Promise<QuoteFull> {
  const res = await fetch(`/api/quotes/${id}/full`);
  if (!res.ok) throw new Error("Failed to fetch quote details");
  return res.json();
}

// Dashboard Stats
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await fetch("/api/dashboard/stats");
  if (!res.ok) throw new Error("Failed to fetch dashboard stats");
  return res.json();
}

// Users
export async function fetchUsers(): Promise<User[]> {
  const res = await fetch("/api/users");
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
}
