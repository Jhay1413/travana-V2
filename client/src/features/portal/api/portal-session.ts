import { clearPortalToken } from "@/hooks/use-portal-api";
import { clearMessageSheetStore } from "../lib/message-sheet-store";
import { clearToldThisSession } from "../lib/told-deals";
import { pushSupported, unsubscribePortalPush } from "./use-portal-push";

/** Signs the customer out of this device: stops push for them, then forgets the session. */
export async function signOutPortal(): Promise<void> {
  if (pushSupported()) {
    await unsubscribePortalPush();
  }
  clearPortalToken();
  clearToldThisSession();
  clearMessageSheetStore();
}
