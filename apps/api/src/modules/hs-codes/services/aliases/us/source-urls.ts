import { resolveSourceDownloadUrl } from '../../../../../lib/source-registry.js';

export type ResolveUsitcHsSourceUrlsOptions = {
  baseUrl?: string;
  csvUrl?: string;
  jsonUrl?: string;
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

export async function resolveUsitcHsSourceUrls(
  opts: ResolveUsitcHsSourceUrlsOptions = {}
): Promise<{ baseUrl: string; csvUrl: string; jsonUrl: string }> {
  const baseUrl =
    opts.baseUrl ??
    (await resolveSourceDownloadUrl({
      sourceKey: 'hs.us.usitc.base',
      fallbackUrl: process.env.HTS_API_BASE ?? DEFAULT_USITC_BASE_URL,
    }));

  const [csvUrl, jsonUrl] = await Promise.all([
    resolveOptionalUrl(opts.csvUrl, 'hs.us.usitc.csv', process.env.HTS_CSV_URL),
    resolveOptionalUrl(opts.jsonUrl, 'hs.us.usitc.json', process.env.HTS_JSON_URL),
  ]);

  return { baseUrl, csvUrl, jsonUrl };
}
