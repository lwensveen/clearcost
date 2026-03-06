/**
 * Escape special characters in a string intended for use with SQL LIKE / ILIKE patterns.
 * Prevents user-supplied `%`, `_`, and `\` from being interpreted as wildcards.
 */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}
