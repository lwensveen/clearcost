import { getCurrencyForCountry } from '@clearcost/types';

function normalizeCurrencyCode(code: string | null | undefined): string {
  return String(code ?? '')
    .trim()
    .toUpperCase();
}

export function resolveDutyRateCurrency(dest: string, currency?: string | null): string {
  const explicit = normalizeCurrencyCode(currency);
  if (explicit) {
    if (/^[A-Z]{3}$/.test(explicit)) return explicit;
    throw Object.assign(
      new Error(`Invalid duty currency code "${explicit}" for destination ${dest}`),
      {
        statusCode: 400,
        code: 'DUTY_CURRENCY_INVALID',
      }
    );
  }

  const destIso2 = normalizeCurrencyCode(dest);
  if (destIso2 === 'EU') return 'EUR';
  const mapped = getCurrencyForCountry(destIso2);
  if (mapped) return mapped;

  throw Object.assign(
    new Error(`No ISO-4217 currency mapping configured for duty destination ${destIso2}`),
    {
      statusCode: 400,
      code: 'DUTY_CURRENCY_UNMAPPED',
    }
  );
}
