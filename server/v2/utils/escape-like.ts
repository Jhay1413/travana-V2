/** ILIKE treats %, _ and \ as pattern syntax; escape them so a value is matched literally. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
