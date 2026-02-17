import type { Client as ApiClient } from "@/types/client";
import type { NeonClient } from "@/types/neon-client";
import type { Ticket as ApiTicket } from "@/types/ticket";
import type { Client, ClientTier, Stage, TicketItem, FileItem } from "./types";

export function transformClientData(apiData: ApiClient): Client {
  return {
    id: apiData.id,
    name: apiData.name,
    tier: apiData.tier as ClientTier,
    stage: apiData.stage as Stage,
    location: apiData.location || "",
    nextTrip: apiData.nextTrip || "",
    value: parseFloat(apiData.value || "0"),
    lastTouch: apiData.lastTouch || "",
    email: apiData.email ?? "",
    phone: apiData.phone ?? "",
    tags: apiData.tags,
  };
}

export function transformNeonClientData(apiData: NeonClient): Client {
  return {
    id: apiData.id,
    name: [apiData.firstName, apiData.surename].filter(Boolean).join(" ") || "Unknown",
    tier: "Standard" as ClientTier,
    stage: "Enquiry" as Stage,
    location: [apiData.city, apiData.country].filter(Boolean).join(", "),
    nextTrip: "",
    value: 0,
    lastTouch: "",
    email: apiData.email || "",
    phone: apiData.phoneNumber || "",
    tags: apiData.badge ? [apiData.badge] : [],
  };
}

export function transformTicket(ticket: ApiTicket): TicketItem {
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    userId: ticket.userId,
  };
}

export function filesFor(clientId: string): FileItem[] {
  return [];
}
