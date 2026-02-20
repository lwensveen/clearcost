import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export type ResolveUsitcDutySourceUrlsOptions = {
  baseUrl?: string;
  csvUrl?: string;
};

const DEFAULT_USITC_BASE_URL = 'https://hts.usitc.gov';

async function resolveOptionalUrl(
  override: string | undefined,
  sourceKey: string,
  fallbackEnv: string | undefined
): Promise<string> {
  if (override !== undefined) return override;
  try {
    return await resolveSourceDownloadUrl({
      sourceKey,
      fallbackUrl: fallbackEnv ?? '',
    });
  } catch {
    return fallbackEnv ?? '';
  }
}

export async function resolveUsitcDutySourceUrls(
  opts: ResolveUsitcDutySourceUrlsOptions = {}
): Promise<{ baseUrl: string; csvUrl: string }> {
  const baseUrl =
    opts.baseUrl ??
    (await resolveSourceDownloadUrl({
      sourceKey: 'duties.us.usitc.base',
      fallbackUrl: process.env.HTS_API_BASE ?? DEFAULT_USITC_BASE_URL,
    }));

  const csvUrl = await resolveOptionalUrl(
    opts.csvUrl,
    'duties.us.usitc.csv',
    process.env.HTS_CSV_URL
  );

  return { baseUrl, csvUrl };
}
