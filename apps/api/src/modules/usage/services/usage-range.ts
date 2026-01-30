import { UsageRangeQuerySchema, UsageResponseSchema } from '@clearcost/types';

export const QueryRange = UsageRangeQuerySchema;
export { UsageResponseSchema };

export const dayToUTC = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const todayISO = () => new Date().toISOString().slice(0, 10);

// Enforce a maximum window to avoid accidental full-table scans
export const MAX_WINDOW_DAYS = 180;

export function normalizeRange(from?: string, to?: string) {
  const toStr = to ?? todayISO();
  const fromStr = from ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  let fromDate = dayToUTC(fromStr);
  let toDate = dayToUTC(toStr);

  // Swap if inverted
  if (fromDate > toDate) [fromDate, toDate] = [toDate, fromDate];

  // Cap window size
  const maxSpan = MAX_WINDOW_DAYS * 86400000;
  if (toDate.getTime() - fromDate.getTime() > maxSpan) {
    fromDate = new Date(toDate.getTime() - maxSpan);
  }

  return { fromDate, toDate };
}
