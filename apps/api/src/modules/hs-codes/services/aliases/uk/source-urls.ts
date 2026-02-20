import { resolveSourceDownloadUrl } from '../../../../../lib/source-registry.js';

export type ResolveUkTariffHsSourceUrlsOptions = {
  apiBaseUrl?: string;
};

const DEFAULT_UK_TARIFF_API_BASE = 'https://data.api.trade.gov.uk';

export async function resolveUkTariffHsSourceUrls(
  opts: ResolveUkTariffHsSourceUrlsOptions = {}
): Promise<{ apiBaseUrl: string }> {
  if (opts.apiBaseUrl !== undefined) return { apiBaseUrl: opts.apiBaseUrl };

  try {
    const apiBaseUrl = await resolveSourceDownloadUrl({
      sourceKey: 'hs.uk.tariff.api_base',
      fallbackUrl: process.env.UK_10_DATA_API_BASE ?? DEFAULT_UK_TARIFF_API_BASE,
    });
    return { apiBaseUrl };
  } catch {
    return { apiBaseUrl: process.env.UK_10_DATA_API_BASE ?? DEFAULT_UK_TARIFF_API_BASE };
  }
}
