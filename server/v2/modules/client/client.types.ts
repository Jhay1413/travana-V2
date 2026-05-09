export type { Client, InsertClient } from "@shared/schema";

export type UpdateClientDTO = Partial<import("@shared/schema").InsertClient>;
