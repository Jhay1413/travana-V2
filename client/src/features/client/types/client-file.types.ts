import type { ClientFile } from "@shared/schema";

/** A client file as the list endpoint returns it: the row plus the uploader's name (null for legacy rows). */
export type ClientFileItem = ClientFile & { uploadedByName?: string | null };
