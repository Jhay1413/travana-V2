import { MapPin } from "lucide-react";
import type { EnquiryTable } from "@/features/quote/types";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

function names(items: ReadonlyArray<string | null | undefined> | undefined): string[] {
  return (items ?? []).filter((n): n is string => !!n);
}

/** Enquiry's side card: the places the client asked about (destinations and resorts, or cruise destinations). */
export function EnquiryTripCard({ enquiry }: { enquiry: EnquiryTable }) {
  const isCruise = enquiry.holiday_type_name?.toLowerCase().includes("cruise") ?? false;
  const groups = [
    {
      label: isCruise ? "Cruise destinations" : "Destinations",
      items: isCruise
        ? names(enquiry.cruiseDestinations?.map((c) => c.cruise_destination_name ?? c.name))
        : names(enquiry.destinations?.map((d) => d.destination_name ?? d.name)),
    },
    { label: "Resorts", items: isCruise ? [] : names(enquiry.resorts?.map((r) => r.resort_name ?? r.name)) },
  ].filter((g) => g.items.length > 0);

  return (
    <section className={HOLIDAY_CARD} aria-labelledby="holiday-enquiry-trip-h" data-testid="holiday-enquiry-trip-card">
      <h2 id="holiday-enquiry-trip-h" className="mb-3.5 text-base font-semibold leading-snug">
        Where they want to go
      </h2>
      {groups.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-qp-muted">No destinations added yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <div key={g.label}>
              <span className="text-xs font-semibold uppercase tracking-[.04em] text-qp-muted">{g.label}</span>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {g.items.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm font-semibold">
                    <span className="grid size-7 place-items-center rounded-[10px] bg-qp-trip-hotel-bg text-qp-trip-hotel-fg" aria-hidden>
                      <MapPin className="size-3.5" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
