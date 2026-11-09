// Public surface of the enquiry feature.
// Consumers should import from `@/features/enquiry` rather than reaching into
// subpaths. Populated as part of the feature-based structure migration
// (see docs/client-structure-migration-plan.md).
export * from "./types";
export { enquiryApi } from "./api/enquiry.api";
export * from "./api/use-enquiry-queries";
export * from "./api/use-enquiry-mutations";
export { EnquiryFormDialog, EnquiryFormContent } from "./components/enquiry-form-dialog";
export type {
  EnquiryFormContentProps,
  EnquiryFormDialogProps,
  EnquirySubmitOptions,
  InboxFormOptions,
} from "./components/enquiry-form-dialog";
export { buildEnquiryTransaction } from "./lib/build-enquiry-transaction";
export * from "./lib/enquiry-form";
export { toSaveResult } from "./lib/enquiry-save-result";
export type { EnquirySaveResult } from "./lib/enquiry-save-result";
export { buildEnquirySubmitData } from "./lib/enquiry-submit-data";
export type { EnquirySubmitData } from "./lib/enquiry-submit-data";
export { enquiryToForm } from "./lib/enquiry-from-record";
export { summariseEnquiry } from "./lib/enquiry-summary";
export { accommodationsPatch, chipForField, countriesPatch, destinationLabel, destinationsPatch, holidayTypePatch, resortsPatch } from "./lib/enquiry-form-reducers";
export { useEnquiryFormState } from "./components/use-enquiry-form-state";
export type { EnquiryFormApi } from "./components/use-enquiry-form-state";
