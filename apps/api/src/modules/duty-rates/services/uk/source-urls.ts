import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';
import { DEFAULT_UK_10_DATA_API_BASE } from './base.js';

export type ResolveUkTariffDutySourceUrlsOptions = {
  apiBaseUrl?: string;
};

export async function resolveUkTariffDutySourceUrls(
  opts: ResolveUkTariffDutySourceUrlsOptions = {}
): Promise<{ apiBaseUrl: string }> {
  if (opts.apiBaseUrl !== undefined) return { apiBaseUrl: opts.apiBaseUrl };

  try {
    const apiBaseUrl = await resolveSourceDownloadUrl({
      sourceKey: 'duties.uk.tariff.api_base',
      fallbackUrl: process.env.UK_10_DATA_API_BASE ?? DEFAULT_UK_10_DATA_API_BASE,
    });
    return { apiBaseUrl };
  } catch {
    return { apiBaseUrl: process.env.UK_10_DATA_API_BASE ?? DEFAULT_UK_10_DATA_API_BASE };
  }
}
