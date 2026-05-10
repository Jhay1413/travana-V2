import type { NeonClient as ClientRow, InsertClientTable } from "@shared/schema";

export type Client = ClientRow;
export type InsertClient = InsertClientTable;
export type UpdateClientDTO = Partial<InsertClientTable>;
