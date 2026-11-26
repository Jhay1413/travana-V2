/** The share links and wording for a quote: the existing public link, nothing new is created. */

/** The public page for a quote (the same `/view-quote/:token` the share section there has always used). */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/view-quote/${encodeURIComponent(token)}`;
}

/** The message that goes with the link. No customer name or price: the page itself shows what it shows. */
export function shareMessage(input: { title: string; dates: string; url: string; agencyName?: string | null }): string {
  const from = input.agencyName ? ` from ${input.agencyName}` : "";
  const dates = input.dates ? `, ${input.dates}` : "";
  return `Take a look at this holiday${from}: ${input.title}${dates}. ${input.url}`;
}

export const whatsAppHref = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text)}`;
export const smsHref = (text: string): string => `sms:?&body=${encodeURIComponent(text)}`;
export const mailtoHref = (subject: string, text: string): string => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

/** Names the share method sent to the server the way the public page does ("WhatsApp", "Email", "Copy Link"). */
export const SHARE_METHOD = {
  whatsapp: "WhatsApp",
  sms: "Text message",
  email: "Email",
  copy: "Copy Link",
  native: "Share",
} as const;

/** What the person who gets the link can and cannot do, in plain words. */
export function shareNotice(agent: string): string {
  return `Anyone with the link can see the photos, the itinerary and the price. Only you can tell ${agent} you're interested.`;
}
