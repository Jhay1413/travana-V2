export interface ClientEditValues {
  title: string;
  firstName: string;
  surename: string;
  phoneNumber: string;
  email: string;
  DOB: string;
  houseNumber: string;
  street: string;
  city: string;
  country: string;
  post_code: string;
  badge: string;
}

export interface StoredClientValues {
  phoneNumber?: string | null;
  badge?: string | null;
}

/**
 * The PATCH body for the Edit Client form. Phone and badge are sent only when changed:
 * the server checks both against today's rules, so a client holding an older phone format
 * or a badge outside today's list can still have its other fields saved.
 */
export function buildClientUpdates(form: ClientEditValues, stored: StoredClientValues | null | undefined): Record<string, string | null> {
  const updates: Record<string, string | null> = {};
  if (form.title) updates.title = form.title;
  if (form.firstName) updates.firstName = form.firstName;
  if (form.surename) updates.surename = form.surename;
  if (form.phoneNumber.trim() !== (stored?.phoneNumber ?? "").trim()) updates.phoneNumber = form.phoneNumber.trim();
  updates.email = form.email || null;
  updates.DOB = form.DOB || null;
  updates.houseNumber = form.houseNumber || null;
  updates.street = form.street || null;
  updates.city = form.city || null;
  updates.country = form.country || null;
  updates.post_code = form.post_code || null;
  if ((form.badge || null) !== (stored?.badge || null)) updates.badge = form.badge || null;
  return updates;
}
