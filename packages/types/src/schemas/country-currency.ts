const EURO_CURRENCY_ISO2 = [
  'AD',
  'AT',
  'BE',
  'CY',
  'DE',
  'EE',
  'ES',
  'FI',
  'FR',
  'GR',
  'HR',
  'IE',
  'IT',
  'LT',
  'LU',
  'LV',
  'MC',
  'MT',
  'NL',
  'PT',
  'SI',
  'SK',
  'SM',
  'VA',
] as const;

const euroCurrencyMap = Object.fromEntries(
  EURO_CURRENCY_ISO2.map((countryIso2) => [countryIso2, 'EUR'])
);

const COUNTRY_ISO2_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  UK: 'GB',
});

/**
 * Canonical ISO-3166 alpha-2 -> ISO-4217 mapping used by quote/de-minimis paths.
 * Keep this mapping explicit and easy to extend when new destination coverage is added.
 */
export const COUNTRY_CURRENCY_BY_ISO2: Readonly<Record<string, string>> = Object.freeze({
  ...euroCurrencyMap,
  // EU destinations with local currency
  BG: 'BGN',
  CZ: 'CZK',
  DK: 'DKK',
  HU: 'HUF',
  PL: 'PLN',
  RO: 'RON',
  SE: 'SEK',
  // Core quote/import destinations
  US: 'USD',
  GB: 'GBP',
  CN: 'CNY',
  JP: 'JPY',
  // ASEAN
  BN: 'BND',
  ID: 'IDR',
  KH: 'KHR',
  LA: 'LAK',
  MM: 'MMK',
  MY: 'MYR',
  PH: 'PHP',
  SG: 'SGD',
  TH: 'THB',
  VN: 'VND',
  // Common non-EU trade destinations
  AE: 'AED',
  AU: 'AUD',
  BR: 'BRL',
  CA: 'CAD',
  CH: 'CHF',
  HK: 'HKD',
  IN: 'INR',
  KR: 'KRW',
  MX: 'MXN',
  NO: 'NOK',
  NZ: 'NZD',
  SA: 'SAR',
  TR: 'TRY',
  ZA: 'ZAR',
});

export function normalizeCountryIso2(countryIso2: string): string | null {
  const iso2 = String(countryIso2 ?? '')
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso2)) return null;
  return COUNTRY_ISO2_ALIASES[iso2] ?? iso2;
}

export function getCurrencyForCountry(countryIso2: string): string | null {
  const iso2 = normalizeCountryIso2(countryIso2);
  if (!iso2) return null;
  return COUNTRY_CURRENCY_BY_ISO2[iso2] ?? null;
}
