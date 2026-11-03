// Client-side rules for the four-digit portal PIN (the server validates again).

export function sanitisePin(value: string): string {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isValidPin(value: string): boolean {
  return /^\d{4}$/.test(value);
}

const UINT32_RANGE = 2 ** 32;
const PIN_SPAN = 9000;
const UNBIASED_LIMIT = UINT32_RANGE - (UINT32_RANGE % PIN_SPAN);

function cryptoUint32(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Random four-digit PIN with no leading zero (crypto source, no modulo bias), for "Make one up". */
export function randomPin(randomUint32: () => number = cryptoUint32): string {
  let n = randomUint32();
  while (n >= UNBIASED_LIMIT) n = randomUint32();
  return String(1000 + (n % PIN_SPAN));
}
