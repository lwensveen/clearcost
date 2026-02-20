import { resolveSourceDownloadUrl } from '../../../../../lib/source-registry.js';

export type ResolveAhtnSourceUrlsOptions = {
  csvUrl?: string;
};

export async function resolveAhtnSourceUrls(
  opts: ResolveAhtnSourceUrlsOptions = {}
): Promise<{ csvUrl: string }> {
  if (opts.csvUrl !== undefined) return { csvUrl: opts.csvUrl };

  try {
    const csvUrl = await resolveSourceDownloadUrl({
      sourceKey: 'hs.asean.ahtn.csv',
      fallbackUrl: process.env.AHTN_CSV_URL ?? '',
    });
    return { csvUrl };
  } catch {
    return { csvUrl: process.env.AHTN_CSV_URL ?? '' };
  }
}
