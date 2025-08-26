import { XMLParser } from 'fast-xml-parser';
import { db, fxRatesTable } from '@clearcost/db';
import { z } from 'zod/v4';
import { FxProviderSchema, FxRateInsert } from '@clearcost/types';
import {
  calculateDaysBetween,
  formatISODate,
  ISO_4217_REGEX,
  toMidnightUTC,
  toNumeric8String,
} from './utils.js';

type ProviderId = z.infer<typeof FxProviderSchema>;

/**
 * A EUR-based rate map with per-currency provenance and per-currency source refs.
 * - `eurMap`: EUR→Currency rate for each currency (includes EUR: 1).
 * - `providerByCurrency`: which provider supplied the EUR→Currency rate.
 * - `sourceRefByCurrency`: provider-specific reference (e.g. 'ecb:2025-08-22').
 * - `asOf`: canonical day (from ECB), used for all rows we insert.
 * - `primarySourceRef`: the primary feed’s reference (for auditing).
 */
type EurMapWithProvenance = {
  asOf: Date;
  eurMap: Record<string, number>;
  providerByCurrency: Record<string, ProviderId>;
  sourceRefByCurrency: Record<string, string>;
  primarySourceRef: string;
};

// ------------------------------------------------------------
// Primary provider: ECB (EUR base, canonical "asOf")
// ------------------------------------------------------------
type EcbDoc = {
  'gesmes:Envelope': {
    Cube: { Cube: { '@_time': string; Cube: Array<{ '@_currency': string; '@_rate': string }> } };
  };
};

async function fetchFromEcb(): Promise<EurMapWithProvenance> {
  const url = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
  const response = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);

  const xmlText = await response.text();
  const xmlParser = new XMLParser({ ignoreAttributes: false });
  const parsedDoc = xmlParser.parse(xmlText) as EcbDoc;

  const dailyNode = parsedDoc['gesmes:Envelope']?.Cube?.Cube;
  if (!dailyNode?.['@_time'] || !Array.isArray(dailyNode?.Cube)) {
    throw new Error('ECB feed: unexpected structure');
  }

  const ecbDateStr = dailyNode['@_time']; // e.g. "2025-08-22"
  const canonicalAsOf = toMidnightUTC(ecbDateStr);

  const eurMap: Record<string, number> = { EUR: 1 };
  const providerByCurrency: Record<string, ProviderId> = { EUR: 'ecb' };
  const sourceRefByCurrency: Record<string, string> = { EUR: `ecb:${ecbDateStr}` };

  for (const node of dailyNode.Cube) {
    const currencyCode = String(node['@_currency'] ?? '').toUpperCase();
    const rateValue = Number(node['@_rate']);
    if (ISO_4217_REGEX.test(currencyCode) && Number.isFinite(rateValue) && rateValue > 0) {
      eurMap[currencyCode] = rateValue;
      providerByCurrency[currencyCode] = 'ecb';
      sourceRefByCurrency[currencyCode] = `ecb:${ecbDateStr}`;
    }
  }

  if (!Number.isFinite(eurMap['USD'])) {
    throw new Error('ECB feed missing USD (required for cross rates)');
  }

  return {
    asOf: canonicalAsOf,
    eurMap,
    providerByCurrency,
    sourceRefByCurrency,
    primarySourceRef: `ecb:${ecbDateStr}`,
  };
}

// ------------------------------------------------------------
// Secondary provider: exchangerate.host (EUR base)
// ------------------------------------------------------------
async function fetchFromExchangerateHost(targetDate: Date): Promise<EurMapWithProvenance | null> {
  const dateStr = formatISODate(targetDate);
  const url = `https://api.exchangerate.host/${dateStr}?base=EUR`;
  const response = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!response.ok) return null;

  const json = await response.json();
  const reportedDateStr: string = json?.date ?? dateStr;
  const asOf = toMidnightUTC(reportedDateStr);
  const rates: Record<string, number> | undefined = json?.rates;
  if (!rates) return null;

  const eurMap: Record<string, number> = { EUR: 1 };
  const providerByCurrency: Record<string, ProviderId> = { EUR: 'exchangerate_host' };
  const sourceRefByCurrency: Record<string, string> = {
    EUR: `exchangerate_host:${reportedDateStr}`,
  };

  for (const [currencyCodeRaw, rateRaw] of Object.entries(rates)) {
    const currencyCode = currencyCodeRaw.toUpperCase();
    const rateValue = Number(rateRaw);
    if (ISO_4217_REGEX.test(currencyCode) && Number.isFinite(rateValue) && rateValue > 0) {
      eurMap[currencyCode] = rateValue;
      providerByCurrency[currencyCode] = 'exchangerate_host';
      sourceRefByCurrency[currencyCode] = `exchangerate_host:${reportedDateStr}`;
    }
  }

  if (!Number.isFinite(eurMap['USD'])) return null; // we need USD for cross rates

  return {
    asOf,
    eurMap,
    providerByCurrency,
    sourceRefByCurrency,
    primarySourceRef: `exchangerate_host:${reportedDateStr}`,
  };
}

// ------------------------------------------------------------
// Secondary provider: Open Exchange Rates (USD base)
// ------------------------------------------------------------
async function fetchFromOpenExchangeRates(targetDate: Date): Promise<EurMapWithProvenance | null> {
  const appId = process.env.OXR_APP_ID;
  if (!appId) return null;

  const dateStr = formatISODate(targetDate);
  const url = `https://openexchangerates.org/api/historical/${dateStr}.json?app_id=${encodeURIComponent(appId)}`;
  const response = await fetch(url, { headers: { 'user-agent': 'clearcost-importer' } });
  if (!response.ok) return null;

  const json = await response.json();
  // Typical shape: { base: "USD", rates: {...}, timestamp, ... }
  if (!json?.rates || json.base !== 'USD') return null;

  const usdRates: Record<string, number> = json.rates;
  const usdToEur = usdRates['EUR']!;
  if (!Number.isFinite(usdToEur) || usdToEur <= 0) return null;

  const asOf = toMidnightUTC(dateStr);

  // Convert USD->X to EUR->X by dividing by USD->EUR.
  const eurMap: Record<string, number> = { EUR: 1 };
  const providerByCurrency: Record<string, ProviderId> = { EUR: 'openexchangerates' };
  const sourceRefByCurrency: Record<string, string> = { EUR: `openexchangerates:${dateStr}` };

  for (const [currencyCodeRaw, usdToXRaw] of Object.entries(usdRates)) {
    const currencyCode = currencyCodeRaw.toUpperCase();
    const usdToX = Number(usdToXRaw);
    if (!ISO_4217_REGEX.test(currencyCode) || !Number.isFinite(usdToX) || usdToX <= 0) continue;
    eurMap[currencyCode] = usdToX / usdToEur;
    providerByCurrency[currencyCode] = 'openexchangerates';
    sourceRefByCurrency[currencyCode] = `openexchangerates:${dateStr}`;
  }

  // Ensure EUR→USD is present in the EUR map (it should be 1 / USD→EUR).
  if (!Number.isFinite(eurMap['USD'])) {
    eurMap['USD'] = 1 / usdToEur;
    providerByCurrency['USD'] = 'openexchangerates';
    sourceRefByCurrency['USD'] = `openexchangerates:${dateStr}`;
  }

  return {
    asOf,
    eurMap,
    providerByCurrency,
    sourceRefByCurrency,
    primarySourceRef: `openexchangerates:${dateStr}`,
  };
}

// ------------------------------------------------------------
// Merge secondary into primary (fill only; never override primary)
// - Keep ECB's `asOf` as the canonical day.
// - Only add currencies not in the primary map.
// - Preserve per-currency provider and sourceRef from secondary.
// ------------------------------------------------------------
function mergeFillOnly(
  primary: EurMapWithProvenance,
  secondary: EurMapWithProvenance
): EurMapWithProvenance {
  const mergedEurMap = { ...primary.eurMap };
  const mergedProviderByCurrency = { ...primary.providerByCurrency };
  const mergedSourceRefByCurrency = { ...primary.sourceRefByCurrency };

  const secondaryFeedProvider = secondary.providerByCurrency['EUR'];

  for (const [currencyCode, rateValue] of Object.entries(secondary.eurMap)) {
    if (mergedEurMap[currencyCode] == null && Number.isFinite(rateValue) && rateValue > 0) {
      mergedEurMap[currencyCode] = rateValue;

      mergedProviderByCurrency[currencyCode] = (secondary.providerByCurrency[currencyCode] ??
        secondaryFeedProvider) as ProviderId;

      mergedSourceRefByCurrency[currencyCode] =
        secondary.sourceRefByCurrency[currencyCode] ?? secondary.primarySourceRef;
    }
  }

  return {
    asOf: primary.asOf,
    eurMap: mergedEurMap,
    providerByCurrency: mergedProviderByCurrency,
    sourceRefByCurrency: mergedSourceRefByCurrency,
    primarySourceRef: primary.primarySourceRef,
  };
}

// ------------------------------------------------------------
// Build all pairs from the EUR map, outputting FxRateInsert rows:
// - EUR↔X (provider/sourceRef of X)
// - USD↔X (derived via EUR; inherits provider/sourceRef of X)
// - EUR↔USD (force ECB as the provider to anchor USD)
// Inserts are provider-scoped unique on (provider, base, quote, asOf).
// ------------------------------------------------------------
function buildProviderScopedRows(
  canonicalAsOf: Date,
  eurMap: Record<string, number>,
  providerByCurrency: Record<string, ProviderId>,
  sourceRefByCurrency: Record<string, string>
): FxRateInsert[] {
  const rows: FxRateInsert[] = [];
  const seen = new Set<string>();

  const appendRow = (
    base: string,
    quote: string,
    rateNumber: number,
    provider: ProviderId,
    sourceRef: string
  ) => {
    if (base === quote) return;
    if (!ISO_4217_REGEX.test(base) || !ISO_4217_REGEX.test(quote)) return;
    if (!Number.isFinite(rateNumber) || rateNumber <= 0) return;

    const dedupeKey = `${provider}:${base}-${quote}-${formatISODate(canonicalAsOf)}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);

    rows.push({
      base,
      quote,
      rate: toNumeric8String(rateNumber),
      asOf: canonicalAsOf,
      provider,
      sourceRef,
      ingestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const eurToUsd = eurMap['USD']!;
  if (!Number.isFinite(eurToUsd)) throw new Error('Missing EUR→USD');

  // Use the feed's provider (EUR entry) as a fallback for any currency missing a provider
  const feedProvider = (providerByCurrency['EUR'] ?? 'ecb') as ProviderId;

  // 1) EUR↔X using the currency's provider, falling back to the feed provider
  for (const [currencyCode, eurToX] of Object.entries(eurMap)) {
    if (currencyCode === 'EUR') continue;
    const provider = (providerByCurrency[currencyCode] ?? feedProvider) as ProviderId;
    const sourceRef =
      sourceRefByCurrency[currencyCode] ?? `${provider}:${formatISODate(canonicalAsOf)}`;

    appendRow('EUR', currencyCode, eurToX, provider, sourceRef);
    appendRow(currencyCode, 'EUR', 1 / eurToX, provider, sourceRef);
  }

  // 2) EUR↔USD anchored to ECB
  appendRow('EUR', 'USD', eurToUsd, 'ecb', `ecb:${formatISODate(canonicalAsOf)}`);
  appendRow('USD', 'EUR', 1 / eurToUsd, 'ecb', `ecb:${formatISODate(canonicalAsOf)}`);

  // 3) USD↔X via EUR; inherit provider/sourceRef from the X leg (fallback to feed provider)
  for (const [currencyCode, eurToX] of Object.entries(eurMap)) {
    if (currencyCode === 'USD') continue;
    const provider = (providerByCurrency[currencyCode] ?? feedProvider) as ProviderId;
    const sourceRef =
      sourceRefByCurrency[currencyCode] ?? `${provider}:${formatISODate(canonicalAsOf)}`;

    const usdToX = eurToX / eurToUsd;
    appendRow('USD', currencyCode, usdToX, provider, sourceRef);
    appendRow(currencyCode, 'USD', 1 / usdToX, provider, sourceRef);
  }

  return rows;
}

// ------------------------------------------------------------
// Public entry:
// - Fetch ECB (primary) → get canonical "asOf" and EUR map.
// - Optionally fetch secondary (env-controlled). If within lag tolerance,
//   fill missing currencies (do not override primary).
// - Build all pairs and insert with provider-scoped uniqueness.
// ------------------------------------------------------------
export async function refreshFx(): Promise<number> {
  const primary = await fetchFromEcb();

  const secondaryKind = (process.env.FX_SECONDARY || '').toLowerCase();
  const maxLagDays = Number(process.env.FX_SECONDARY_MAX_LAG_DAYS || '2');

  let merged: EurMapWithProvenance = primary;

  if (secondaryKind) {
    let secondary: EurMapWithProvenance | null = null;

    if (secondaryKind === 'exchangerate.host') {
      secondary = await fetchFromExchangerateHost(primary.asOf);
    } else if (secondaryKind === 'openexchangerates') {
      secondary = await fetchFromOpenExchangeRates(primary.asOf);
    }

    if (secondary && calculateDaysBetween(secondary.asOf, primary.asOf) <= maxLagDays) {
      merged = mergeFillOnly(primary, secondary);
    }
    // If secondary is absent or outside lag tolerance, we silently skip it.
  }

  const insertRows = buildProviderScopedRows(
    merged.asOf,
    merged.eurMap,
    merged.providerByCurrency,
    merged.sourceRefByCurrency
  );

  if (insertRows.length === 0) return 0;

  // Provider-scoped idempotency: (provider, base, quote, asOf)
  return await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(fxRatesTable)
      .values(insertRows)
      .onConflictDoNothing({
        target: [fxRatesTable.provider, fxRatesTable.base, fxRatesTable.quote, fxRatesTable.asOf],
      })
      .returning({ id: fxRatesTable.id });

    return inserted.length;
  });
}
