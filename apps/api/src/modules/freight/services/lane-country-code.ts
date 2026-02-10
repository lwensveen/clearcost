import countries from 'i18n-iso-countries';
import en from 'i18n-iso-countries/langs/en.json' with { type: 'json' };

countries.registerLocale(en);

const ISO2_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  UK: 'GB',
});

type FreightLaneCode = {
  normalized: string;
  iso2: string | null;
  iso3: string | null;
};

function normalizeAlphaCode(input: string): string {
  return String(input ?? '')
    .trim()
    .toUpperCase();
}

function normalizeIso2(code: string): string | null {
  if (!/^[A-Z]{2}$/.test(code)) return null;
  const aliased = ISO2_ALIASES[code] ?? code;
  return countries.alpha2ToAlpha3(aliased) ? aliased : null;
}

function normalizeIso3(code: string): string | null {
  if (!/^[A-Z]{3}$/.test(code)) return null;
  return countries.alpha3ToAlpha2(code) ? code : null;
}

function decodeLaneCode(input: string): FreightLaneCode {
  const normalized = normalizeAlphaCode(input);
  const iso2Direct = normalizeIso2(normalized);
  const iso3Direct = normalizeIso3(normalized);

  if (iso2Direct) {
    return {
      normalized,
      iso2: iso2Direct,
      iso3: countries.alpha2ToAlpha3(iso2Direct) ?? null,
    };
  }
  if (iso3Direct) {
    return {
      normalized,
      iso2: countries.alpha3ToAlpha2(iso3Direct) ?? null,
      iso3: iso3Direct,
    };
  }
  return { normalized, iso2: null, iso3: null };
}

export function freightLaneLookupCandidates(input: string): string[] {
  const decoded = decodeLaneCode(input);
  const candidates = new Set<string>();
  if (decoded.iso3) candidates.add(decoded.iso3);
  if (decoded.iso2) candidates.add(decoded.iso2);
  if (candidates.size === 0 && decoded.normalized) {
    candidates.add(decoded.normalized);
  }
  return [...candidates];
}

export function toFreightIso3(input: string): string | null {
  return decodeLaneCode(input).iso3;
}

export function requireFreightIso3(input: string, field: 'origin' | 'dest'): string {
  const decoded = decodeLaneCode(input);
  if (decoded.iso3) return decoded.iso3;
  throw Object.assign(
    new Error(
      `Invalid freight lane ${field} country "${decoded.normalized || String(input)}"; expected ISO2/ISO3`
    ),
    {
      statusCode: 400,
      code: 'FREIGHT_LANE_INVALID_COUNTRY',
      field,
    }
  );
}
