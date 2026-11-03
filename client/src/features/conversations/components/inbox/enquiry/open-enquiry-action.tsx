import { ToastAction } from "@/components/ui/toast";

/** The "Open enquiry" button shown in the success toast. */
export function openEnquiryAction(onOpen: () => void) {
  return (
    <ToastAction altText="Open enquiry" onClick={onOpen}>
      Open enquiry
    </ToastAction>
  );
}
