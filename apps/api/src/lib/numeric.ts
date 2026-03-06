/**
 * Safely convert a DB numeric (string) field to a finite number.
 * Returns `fallback` (default 0) if the value is null/undefined/NaN/Infinity.
 */
export function safeNumeric(value: string | number | null | undefined, fallback = 0): number {
  if (value == null) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
