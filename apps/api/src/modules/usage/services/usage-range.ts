import { z } from 'zod/v4';

export const QueryRange = z.object({
  // YYYY-MM-DD in UTC
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const UsageRowSchema = z.object({
  day: z.any(), // date (returned as Date by drizzle)
  route: z.string(),
  method: z.string(),
  count: z.number(),
  sumDurationMs: z.number(),
  sumBytesIn: z.number(),
  sumBytesOut: z.number(),
});
export const UsageResponseSchema = z.array(UsageRowSchema);

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
