export function parseDateMaybe(input: unknown): Date | undefined {
  if (typeof input !== 'string') return undefined;
  const s = input.length <= 10 ? `${input}T00:00:00Z` : input;
  const d = new Date(s);
  return Number.isNaN(+d) ? undefined : d;
}
