import crypto from "crypto";

/** No 0/O/1/l/I: a token can be read aloud or retyped without mistakes. */
export const QUOTE_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
export const QUOTE_TOKEN_LENGTH = 20;
/** quote_token was varchar(12) until the schema is pushed; the stored value is never longer than the column allows. */
export const LEGACY_QUOTE_TOKEN_LENGTH = 12;

type RandomBytes = (size: number) => Uint8Array;

/**
 * The one generator for quote and deal share tokens: crypto-secure, uniform over the alphabet (bytes that would
 * bias the choice are discarded), 20 characters by default.
 */
export function generateQuoteToken(length: number = QUOTE_TOKEN_LENGTH, randomBytes: RandomBytes = crypto.randomBytes): string {
  const size = QUOTE_TOKEN_ALPHABET.length;
  const limit = 256 - (256 % size);
  let token = "";
  while (token.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= limit) continue;
      token += QUOTE_TOKEN_ALPHABET[byte % size];
      if (token.length === length) break;
    }
  }
  return token;
}

/** Mints a token that `isTaken` says is unused; gives up after `attempts` collisions (practically never). */
export async function mintQuoteToken(
  isTaken: (token: string) => Promise<boolean>,
  length: number = QUOTE_TOKEN_LENGTH,
  attempts = 5,
): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const token = generateQuoteToken(length);
    if (!(await isTaken(token))) return token;
  }
  throw new Error("Could not mint an unused quote token");
}

/** Old and new tokens are letters and digits; anything else cannot be a token, so it is answered as unknown without a lookup. */
export function looksLikeQuoteToken(value: string): boolean {
  return /^[A-Za-z0-9]{4,64}$/.test(value);
}
