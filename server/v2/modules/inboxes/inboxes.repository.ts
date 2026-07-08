import { sendSevenRequest, useSampleData } from "../../utils/sendseven";
import type { SsInboxList } from "./inboxes.types";

// Repository: proxies custom-inbox reads to SendSeven using the caller's org
// token (resolved by sendSevenContext). No sample inboxes in fixture mode — an
// unconfigured org simply has no custom inboxes yet.
export const inboxesRepository = {
  list(): Promise<SsInboxList> {
    if (useSampleData()) return Promise.resolve({ items: [] });
    return sendSevenRequest("GET", "/inboxes", {});
  },
};
