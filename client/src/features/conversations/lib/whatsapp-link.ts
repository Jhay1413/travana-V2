/** Builds a wa.me link from a phone number; a leading UK 0 becomes 44. Null when under 7 digits. */
export function whatsAppLink(phone: string | null | undefined): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  if (digits.startsWith("0") && !digits.startsWith("00")) digits = `44${digits.slice(1)}`;
  else if (digits.startsWith("00")) digits = digits.slice(2);
  // "+44 (0)7700 900123" keeps the trunk 0 after the country code; WhatsApp needs it gone.
  if (digits.startsWith("440")) digits = `44${digits.slice(3)}`;
  return `https://wa.me/${digits}`;
}
