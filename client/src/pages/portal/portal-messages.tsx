import { MessagesView } from "@/features/portal";
import PortalLayout from "./portal-layout";

/** Portal Messages tab (new look). The chat lives in features/portal (MessagesView). */
export default function PortalMessagesPage() {
  return (
    <PortalLayout tone="light">
      <MessagesView />
    </PortalLayout>
  );
}
