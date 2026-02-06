// API client for backend routes

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
}

async function apiRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json();
  return json.data !== undefined ? json.data : json;
}

export async function fetchCurrentUser(): Promise<User | null> {
  const res = await fetch("/api/auth/user");
  if (!res.ok) return null;
  return res.json();
}

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

export async function createClient(data: CreateClientData): Promise<Client> {
  return apiRequest<Client>("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...data,
      name: `${data.firstName} ${data.lastName}`.trim(),
    }),
  });
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
  return apiRequest<Client[]>("/api/clients");
}

export async function fetchClient(id: string): Promise<Client> {
  return apiRequest<Client>(`/api/clients/${id}`);
}

export async function updateClient(id: string, data: Partial<Client>): Promise<Client> {
  return apiRequest<Client>(`/api/clients/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// Quotes
export async function fetchQuotes(filters?: { status?: string; clientId?: string }): Promise<Quote[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.append("status", filters.status);
  if (filters?.clientId) params.append("clientId", filters.clientId);
  
  const url = `/api/quotes${params.toString() ? `?${params.toString()}` : ""}`;
  return apiRequest<Quote[]>(url);
}

export async function fetchQuote(id: string): Promise<Quote> {
  return apiRequest<Quote>(`/api/quotes/${id}`);
}

export async function fetchQuoteFull(id: string): Promise<QuoteFull> {
  return apiRequest<QuoteFull>(`/api/quotes/${id}/full`);
}

export interface CreateQuoteData {
  clientId: string;
  userId?: string;
  status?: string;
  packageType?: string;
  quoteTitle?: string;
  quoteLink?: string;
  travelDate?: string;
  returnDate?: string;
  passengersAdults?: number;
  passengersChildren?: number;
  passengersInfants?: number;
  childAges?: number[];
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  checkInDate?: string;
  checkInTime?: string;
  nights?: number;
  boardBasis?: string;
  roomType?: string;
  transferType?: string;
  preBookedSeats?: string;
  flightMeals?: string;
  outboundDepartAirport?: string;
  outboundDepartDate?: string;
  outboundDepartTime?: string;
  outboundArriveAirport?: string;
  outboundArriveDate?: string;
  outboundArriveTime?: string;
  inboundDepartAirport?: string;
  inboundDepartDate?: string;
  inboundDepartTime?: string;
  inboundArriveAirport?: string;
  inboundArriveDate?: string;
  inboundArriveTime?: string;
  tourOperator?: string;
  sales?: number;
  price?: number;
  commission?: number;
  discount?: number;
  serviceCharge?: number;
  pricePerPerson?: number;
}

export async function createQuote(data: CreateQuoteData): Promise<Quote> {
  return apiRequest<Quote>("/api/quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

// Dashboard Stats
export async function fetchDashboardStats(): Promise<DashboardStats> {
  return apiRequest<DashboardStats>("/api/dashboard/stats");
}

// Users
export async function fetchUsers(): Promise<User[]> {
  return apiRequest<User[]>("/api/users");
}

// Tour Operators
export interface TourOperator {
  id: string;
  name: string;
  holidayType: string;
  commissionPercent: string;
  username: string | null;
  password: string | null;
  contact: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export async function fetchTourOperators(): Promise<TourOperator[]> {
  return apiRequest<TourOperator[]>("/api/tour-operators");
}

// Airports
export interface Airport {
  id: string;
  name: string;
  code: string;
  country: string;
  createdAt: string;
}

export async function fetchAirports(): Promise<Airport[]> {
  return apiRequest<Airport[]>("/api/airports");
}

// Tickets
export interface Ticket {
  id: string;
  clientId: string;
  userId: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
}

export async function fetchTickets(): Promise<Ticket[]> {
  return apiRequest<Ticket[]>("/api/tickets");
}

export async function fetchTicket(id: string): Promise<Ticket> {
  return apiRequest<Ticket>(`/api/tickets/${id}`);
}

export async function fetchTicketsByClient(clientId: string): Promise<Ticket[]> {
  return apiRequest<Ticket[]>(`/api/tickets/client/${clientId}`);
}

export async function fetchTicketsByUser(userId: string): Promise<Ticket[]> {
  return apiRequest<Ticket[]>(`/api/tickets/user/${userId}`);
}

export async function createTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "resolvedAt">): Promise<Ticket> {
  return apiRequest<Ticket>("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
}

export async function updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket> {
  return apiRequest<Ticket>(`/api/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
}

export async function deleteTicket(id: string): Promise<void> {
  return apiRequest<void>(`/api/tickets/${id}`, { method: "DELETE" });
}

// Ticket Attachments
export interface TicketAttachment {
  id: string;
  ticketId: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export async function fetchAttachments(ticketId: string): Promise<TicketAttachment[]> {
  return apiRequest<TicketAttachment[]>(`/api/attachments/ticket/${ticketId}`);
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  
  return apiRequest<TicketAttachment>(`/api/attachments/ticket/${ticketId}`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteAttachment(id: string): Promise<void> {
  return apiRequest<void>(`/api/attachments/${id}`, { method: "DELETE" });
}

export function getAttachmentUrl(id: string): string {
  return `/api/attachments/${id}/download`;
}

// Ticket Replies
export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  parentReplyId: string | null;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

export async function fetchReplies(ticketId: string): Promise<TicketReply[]> {
  return apiRequest<TicketReply[]>(`/api/replies/ticket/${ticketId}`);
}

export async function createReply(ticketId: string, userId: string, content: string, parentReplyId?: string): Promise<TicketReply> {
  return apiRequest<TicketReply>(`/api/replies/ticket/${ticketId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content, parentReplyId: parentReplyId || null }),
  });
}

export async function updateReply(id: string, content: string): Promise<TicketReply> {
  return apiRequest<TicketReply>(`/api/replies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function deleteReply(id: string): Promise<void> {
  return apiRequest<void>(`/api/replies/${id}`, { method: "DELETE" });
}

// Notifications
export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export async function fetchNotifications(userId: string): Promise<Notification[]> {
  return apiRequest<Notification[]>(`/api/notifications?userId=${userId}`);
}

export async function fetchUnreadNotifications(userId: string): Promise<Notification[]> {
  return apiRequest<Notification[]>(`/api/notifications/unread?userId=${userId}`);
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/api/notifications/${id}/read`, { method: "PUT" });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  return apiRequest<void>(`/api/notifications/read-all?userId=${userId}`, { method: "PUT" });
}

export async function deleteNotification(id: string): Promise<void> {
  return apiRequest<void>(`/api/notifications/${id}`, { method: "DELETE" });
}
