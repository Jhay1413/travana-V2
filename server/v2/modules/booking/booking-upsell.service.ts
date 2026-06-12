import { bookingUpsellRepository } from "./booking-upsell.repository";
import { bookingRepository } from "./booking.repository";
import { UPSELL_TYPES, type UpsellBody } from "./booking-upsell.validator";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type { InsertBookingUpsell } from "@shared/schema";

/** Coerce a money-like value (string | number | null) to the string a Drizzle `numeric` column wants. */
function toNumericString(v: unknown): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

function assertValidType(type: string) {
  if (!(UPSELL_TYPES as readonly string[]).includes(type)) {
    throw new AppError(`Invalid upsell type: ${type}`, 400);
  }
}

/** Resolve the parent booking, ensuring it exists, is active, and is in the caller's scope. */
async function assertBookingWritable(bookingId: string, scope: Scope) {
  const inScope = await bookingRepository.bookingInScope(bookingId, scope);
  if (!inScope) throw new AppError("Booking not found", 404);

  const b = await bookingRepository.findById(bookingId);
  if (!b) throw new AppError("Booking not found", 404);
  if (b.is_active === false) throw new AppError("Cannot add upsells to an inactive booking", 400);
}

export const bookingUpsellService = {
  async listByBooking(bookingId: string, scope: Scope) {
    const inScope = await bookingRepository.bookingInScope(bookingId, scope);
    if (!inScope) throw new AppError("Booking not found", 404);
    return bookingUpsellRepository.findByBooking(bookingId);
  },

  async create(bookingId: string, body: UpsellBody, scope: Scope) {
    await assertBookingWritable(bookingId, scope);
    assertValidType(body.upsell_type);

    const data: InsertBookingUpsell = {
      booking_id: bookingId,
      upsell_type: body.upsell_type,
      description: body.description ?? null,
      quantity: body.quantity ?? 1,
      cost: toNumericString(body.cost) ?? null,
      commission: toNumericString(body.commission) ?? null,
      sales_price: toNumericString(body.sales_price) ?? null,
      // `added_at` drives the recognition month; default to now when omitted.
      added_at: body.added_at ? new Date(body.added_at) : undefined,
      added_by: scope.userId ?? null,
    };

    return bookingUpsellRepository.create(data);
  },

  async update(id: string, body: Partial<UpsellBody>, scope: Scope) {
    const existing = await bookingUpsellRepository.findById(id);
    if (!existing || existing.is_active === false) throw new AppError("Upsell not found", 404);
    await assertBookingWritable(existing.booking_id, scope);

    if (body.upsell_type !== undefined) assertValidType(body.upsell_type);

    // Only patch the fields actually provided (keeps `added_at` immutable unless
    // explicitly corrected, so the recognition month doesn't drift on edits).
    const data: Partial<InsertBookingUpsell> = {};
    if (body.upsell_type !== undefined) data.upsell_type = body.upsell_type;
    if (body.description !== undefined) data.description = body.description;
    if (body.quantity !== undefined) data.quantity = body.quantity;
    if (body.cost !== undefined) data.cost = toNumericString(body.cost) ?? null;
    if (body.commission !== undefined) data.commission = toNumericString(body.commission) ?? null;
    if (body.sales_price !== undefined) data.sales_price = toNumericString(body.sales_price) ?? null;
    if (body.added_at !== undefined) data.added_at = body.added_at ? new Date(body.added_at) : undefined;

    const updated = await bookingUpsellRepository.update(id, data);
    if (!updated) throw new AppError("Upsell not found", 404);
    return updated;
  },

  async remove(id: string, scope: Scope) {
    const existing = await bookingUpsellRepository.findById(id);
    if (!existing || existing.is_active === false) throw new AppError("Upsell not found", 404);
    await assertBookingWritable(existing.booking_id, scope);

    await bookingUpsellRepository.softDelete(id);
  },
};
