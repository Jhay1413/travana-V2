export interface LunaBannerInput {
  conversationType: string | null | undefined;
  clientLinked: boolean;
  enquiryCreated: boolean;
  dismissed: boolean;
}

/** The Luna "holiday request" banner shows on linked sales chats with no enquiry yet. */
export function shouldShowLunaBanner(i: LunaBannerInput): boolean {
  return i.conversationType === "sales" && i.clientLinked && !i.enquiryCreated && !i.dismissed;
}
