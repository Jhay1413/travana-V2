import { AddAccommodationModal } from "@/features/lookups/components/lookups/add-accommodation-modal";
import { AddCountryModal } from "@/features/lookups/components/lookups/add-country-modal";
import { AddDestinationModal } from "@/features/lookups/components/lookups/add-destination-modal";
import { AddResortModal } from "@/features/lookups/components/lookups/add-resort-modal";
import type { EnquiryFormApi } from "./use-enquiry-form-state";

/** The "Add new" lookup modals behind the package pickers; each adds what was created to the form. */
export function EnquiryAddModals({ api }: { api: EnquiryFormApi }) {
  const { form, lookups, modals } = api;
  const primaryCountry = form.countries[0] ?? "";
  const primaryDestination = form.destinations[0] ?? "";
  const primaryResort = form.resorts[0] ?? "";
  const closeWith = (kind: NonNullable<typeof modals.current>) => (open: boolean) => {
    if (!open && modals.current === kind) modals.close();
  };

  return (
    <>
      <AddCountryModal
        open={modals.current === "country"}
        onOpenChange={closeWith("country")}
        initialName={lookups.search.country}
        onSuccess={(c) => {
          api.pickCountries(form.countries.includes(c.id) ? form.countries : [...form.countries, c.id]);
          lookups.setCountrySearch("");
        }}
      />
      <AddDestinationModal
        open={modals.current === "destination"}
        onOpenChange={closeWith("destination")}
        initialName={lookups.search.destination}
        initialCountryId={primaryCountry}
        onSuccess={(dest) => {
          api.pickDestinations([...form.destinations, dest.id], [dest]);
          lookups.setDestSearch("");
        }}
      />
      <AddResortModal
        open={modals.current === "resort"}
        onOpenChange={closeWith("resort")}
        initialName={lookups.search.resort}
        initialCountryId={primaryCountry}
        initialDestinationId={primaryDestination}
        initialDestinationName={lookups.labelOf[primaryDestination] ?? ""}
        onSuccess={(res) => {
          api.pickResorts([...form.resorts, res.id], [res]);
          lookups.setResortSearch("");
        }}
      />
      <AddAccommodationModal
        open={modals.current === "accommodation"}
        onOpenChange={closeWith("accommodation")}
        initialName={lookups.search.accommodation}
        initialCountryId={primaryCountry}
        initialDestinationId={primaryDestination}
        initialDestinationName={lookups.labelOf[primaryDestination] ?? ""}
        initialResortId={primaryResort}
        initialResortName={lookups.labelOf[primaryResort] ?? ""}
        onSuccess={(acc) => {
          api.pickAccommodations([...form.accommodations, acc.id], [acc]);
          lookups.setAccomSearch("");
        }}
      />
    </>
  );
}
