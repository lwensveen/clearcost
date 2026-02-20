import { resolveSourceDownloadUrl } from '../../../lib/source-registry.js';

export const DEFAULT_ZONOS_DE_MINIMIS_URL = 'https://zonos.com/docs/guides/de-minimis-values';
export const DEFAULT_TRADE_GOV_DE_MINIMIS_API_BASE = 'https://api.trade.gov/v1/de_minimis/search';

export const DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS = {
  usSection321: 'https://www.cbp.gov/trade/trade-enforcement/tftea/section-321-programs',
  euRegulation: 'https://eur-lex.europa.eu/eli/reg/2009/1186/oj',
  gbVatGuidance:
    'https://www.gov.uk/guidance/vat-and-overseas-goods-sold-directly-to-customers-in-the-uk',
  caLvsVat: 'https://www.cbsa-asfc.gc.ca/services/cusma-aceum/lvs-efv-eng.html',
  caLvsDuty: 'https://www.cbsa-asfc.gc.ca/publications/dm-md/d8/d8-2-16-eng.html',
} as const;

async function resolveWithFallback(sourceKey: string, fallbackUrl: string): Promise<string> {
  try {
    return await resolveSourceDownloadUrl({ sourceKey, fallbackUrl });
  } catch {
    return fallbackUrl;
  }
}

export async function resolveZonosDeMinimisUrl(overrideUrl?: string): Promise<string> {
  if (overrideUrl !== undefined) return overrideUrl;
  return resolveWithFallback('de-minimis.zonos.docs', DEFAULT_ZONOS_DE_MINIMIS_URL);
}

export async function resolveTradeGovDeMinimisApiBase(overrideUrl?: string): Promise<string> {
  if (overrideUrl !== undefined) return overrideUrl;
  return resolveWithFallback('de-minimis.trade_gov.api', DEFAULT_TRADE_GOV_DE_MINIMIS_API_BASE);
}

export async function resolveOfficialDeMinimisSourceUrls(): Promise<{
  usSection321: string;
  euRegulation: string;
  gbVatGuidance: string;
  caLvsVat: string;
  caLvsDuty: string;
}> {
  const [usSection321, euRegulation, gbVatGuidance, caLvsVat, caLvsDuty] = await Promise.all([
    resolveWithFallback(
      'de-minimis.official.us.section321',
      DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.usSection321
    ),
    resolveWithFallback(
      'de-minimis.official.eu.reg_1186_2009',
      DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.euRegulation
    ),
    resolveWithFallback(
      'de-minimis.official.gb.vat_overseas_goods',
      DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.gbVatGuidance
    ),
    resolveWithFallback(
      'de-minimis.official.ca.lvs_vat',
      DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.caLvsVat
    ),
    resolveWithFallback(
      'de-minimis.official.ca.lvs_duty',
      DEFAULT_OFFICIAL_DE_MINIMIS_SOURCE_URLS.caLvsDuty
    ),
  ]);

  return { usSection321, euRegulation, gbVatGuidance, caLvsVat, caLvsDuty };
}
