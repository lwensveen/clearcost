export const EU_ISO2 = new Set([
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE',
]);

export function volumetricKg({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 5000;
}

export function volumeM3({ l, w, h }: { l: number; w: number; h: number }) {
  return (l * w * h) / 1_000_000;
}
