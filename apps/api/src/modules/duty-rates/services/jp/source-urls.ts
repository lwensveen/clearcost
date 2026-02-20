import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const DEFAULT_JP_TARIFF_INDEX = 'https://www.customs.go.jp/english/tariff/';

export type ResolveJpTariffDutySourceUrlsOptions = {
  tariffIndexUrl?: string;
};

export async function resolveJpTariffDutySourceUrls(
  opts: ResolveJpTariffDutySourceUrlsOptions = {}
): Promise<{ tariffIndexUrl: string }> {
  if (opts.tariffIndexUrl !== undefined) return { tariffIndexUrl: opts.tariffIndexUrl };

  try {
    const tariffIndexUrl = await resolveSourceDownloadUrl({
      sourceKey: 'duties.jp.customs.tariff_index',
      fallbackUrl: process.env.JP_TARIFF_INDEX ?? DEFAULT_JP_TARIFF_INDEX,
    });
    return { tariffIndexUrl };
  } catch {
    return { tariffIndexUrl: process.env.JP_TARIFF_INDEX ?? DEFAULT_JP_TARIFF_INDEX };
  }
}
