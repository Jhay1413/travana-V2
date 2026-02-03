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
  const res = await fetch("/api/tour-operators");
  if (!res.ok) throw new Error("Failed to fetch tour operators");
  return res.json();
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
  const res = await fetch("/api/airports");
  if (!res.ok) throw new Error("Failed to fetch airports");
  return res.json();
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
  const res = await fetch("/api/tickets");
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

export async function fetchTicket(id: string): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ticket");
  return res.json();
}

export async function fetchTicketsByClient(clientId: string): Promise<Ticket[]> {
  const res = await fetch(`/api/clients/${clientId}/tickets`);
  if (!res.ok) throw new Error("Failed to fetch client tickets");
  return res.json();
}

export async function fetchTicketsByUser(userId: string): Promise<Ticket[]> {
  const res = await fetch(`/api/users/${userId}/tickets`);
  if (!res.ok) throw new Error("Failed to fetch user tickets");
  return res.json();
}

export async function createTicket(ticket: Omit<Ticket, "id" | "createdAt" | "updatedAt" | "resolvedAt">): Promise<Ticket> {
  const res = await fetch("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
  if (!res.ok) throw new Error("Failed to create ticket");
  return res.json();
}

export async function updateTicket(id: string, ticket: Partial<Ticket>): Promise<Ticket> {
  const res = await fetch(`/api/tickets/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ticket),
  });
  if (!res.ok) throw new Error("Failed to update ticket");
  return res.json();
}

export async function deleteTicket(id: string): Promise<void> {
  const res = await fetch(`/api/tickets/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete ticket");
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
  const res = await fetch(`/api/tickets/${ticketId}/attachments`);
  if (!res.ok) throw new Error("Failed to fetch attachments");
  return res.json();
}

export async function uploadAttachment(ticketId: string, file: File): Promise<TicketAttachment> {
  const formData = new FormData();
  formData.append("file", file);
  
  const res = await fetch(`/api/tickets/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error("Failed to upload file");
  return res.json();
}

export async function deleteAttachment(id: string): Promise<void> {
  const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete attachment");
}

export function getAttachmentUrl(id: string): string {
  return `/api/attachments/${id}/download`;
}

// Ticket Replies
export interface TicketReply {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  createdAt: string;
  updatedAt: string | null;
}

export async function fetchReplies(ticketId: string): Promise<TicketReply[]> {
  const res = await fetch(`/api/tickets/${ticketId}/replies`);
  if (!res.ok) throw new Error("Failed to fetch replies");
  return res.json();
}

export async function createReply(ticketId: string, userId: string, content: string): Promise<TicketReply> {
  const res = await fetch(`/api/tickets/${ticketId}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, content }),
  });
  if (!res.ok) throw new Error("Failed to create reply");
  return res.json();
}

export async function updateReply(id: string, content: string): Promise<TicketReply> {
  const res = await fetch(`/api/replies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error("Failed to update reply");
  return res.json();
}

export async function deleteReply(id: string): Promise<void> {
  const res = await fetch(`/api/replies/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete reply");
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
  const res = await fetch(`/api/notifications?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json();
}

export async function fetchUnreadNotifications(userId: string): Promise<Notification[]> {
  const res = await fetch(`/api/notifications/unread?userId=${userId}`);
  if (!res.ok) throw new Error("Failed to fetch unread notifications");
  return res.json();
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await fetch(`/api/notifications/${id}/read`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to mark notification as read");
  return res.json();
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const res = await fetch(`/api/notifications/read-all?userId=${userId}`, { method: "PUT" });
  if (!res.ok) throw new Error("Failed to mark all notifications as read");
}

export async function deleteNotification(id: string): Promise<void> {
  const res = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete notification");
}
