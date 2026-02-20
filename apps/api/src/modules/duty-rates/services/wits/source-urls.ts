import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';
import { DEFAULT_WITS_SDMX_BASE } from './base.js';

export type ResolveWitsDutySourceUrlsOptions = {
  sdmxBaseUrl?: string;
};

export async function resolveWitsDutySourceUrls(
  opts: ResolveWitsDutySourceUrlsOptions = {}
): Promise<{ sdmxBaseUrl: string }> {
  if (opts.sdmxBaseUrl !== undefined) return { sdmxBaseUrl: opts.sdmxBaseUrl };

  try {
    const sdmxBaseUrl = await resolveSourceDownloadUrl({
      sourceKey: 'duties.wits.sdmx.base',
      fallbackUrl: process.env.WITS_SDMX_BASE ?? DEFAULT_WITS_SDMX_BASE,
    });
    return { sdmxBaseUrl };
  } catch {
    return { sdmxBaseUrl: process.env.WITS_SDMX_BASE ?? DEFAULT_WITS_SDMX_BASE };
  }
}
