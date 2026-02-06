export type { User, InsertUser } from "@shared/schema";

export type UpdateUserDTO = Partial<import("@shared/schema").InsertUser>;
