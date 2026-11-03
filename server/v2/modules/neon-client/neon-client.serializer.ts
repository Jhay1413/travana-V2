import { clientTable, type NeonClient } from '@shared/schema';
import { getTableColumns } from 'drizzle-orm';

// Columns that must never leave the server in an API response. The only secret
// on the client row is the portal PIN hash; PIN state is exposed through
// GET /:id/portal-pin ({ hasPin, mustChangePin }) instead.
export type PublicNeonClient<T extends NeonClient = NeonClient> = Omit<T, 'portalPin'>;

export function toPublicClient<T extends NeonClient>(client: T): PublicNeonClient<T> {
  const { portalPin: _portalPin, ...rest } = client;
  return rest;
}

// Explicit column list for queries that return a client row straight to HTTP.
const { portalPin: _omitPortalPin, ...publicColumns } = getTableColumns(clientTable);
export const publicClientColumns = publicColumns;
