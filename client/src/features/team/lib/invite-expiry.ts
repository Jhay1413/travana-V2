/** "expires in 3 days" / "expires today" / "expired" for a pending invite. */
export function inviteExpiryText(expiry: string | null, now: number = Date.now()): string {
  if (!expiry) return "no expiry";
  const t = new Date(expiry).getTime();
  if (Number.isNaN(t)) return "no expiry";
  const days = Math.round((t - now) / 86_400_000);
  if (t < now) return "expired";
  if (days > 1) return `expires in ${days} days`;
  if (days === 1) return "expires in 1 day";
  return "expires today";
}

export function isInviteExpired(expiry: string | null, now: number = Date.now()): boolean {
  if (!expiry) return false;
  const t = new Date(expiry).getTime();
  return !Number.isNaN(t) && t < now;
}
