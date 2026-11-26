/** The plain-text WhatsApp message for a customer's one-time sign-in link (sent when their 24h window is open). */
export function buildSignInText(opts: { firstName: string | null; orgName: string | null; link: string }): string {
  const greeting = opts.firstName?.trim() ? `Hi ${opts.firstName.trim()}, ` : "Hi, ";
  const where = opts.orgName?.trim() ? `your ${opts.orgName.trim()} portal` : "your portal";
  return `${greeting}tap this link to sign in to ${where} and choose a new PIN: ${opts.link} The link works once and expires in an hour.`;
}

/** The message for a sign-in link a staff member sent by text or WhatsApp: works once, valid for `hours` hours. */
export function buildStaffSignInText(opts: { firstName: string | null; orgName: string | null; link: string; hours: number }): string {
  const greeting = opts.firstName?.trim() ? `Hi ${opts.firstName.trim()}, ` : "Hi, ";
  const where = opts.orgName?.trim() ? `your ${opts.orgName.trim()} portal` : "your portal";
  return `${greeting}tap this link to sign in to ${where}: ${opts.link} The link works once and is valid for ${opts.hours} hours.`;
}
