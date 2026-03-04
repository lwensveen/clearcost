import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const CZ_MFN_OFFICIAL_SOURCE_KEY = 'duties.cz.official.mfn_excel';
export const CZ_FTA_OFFICIAL_SOURCE_KEY = 'duties.cz.official.fta_excel';

export type ResolveCzDutySourceUrlsOptions = {
  mfnUrl?: string;
  ftaUrl?: string;
};

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

async function resolveOptionalSourceUrl(
  override: string | undefined,
  sourceKey: string,
  envFallback: string | undefined
): Promise<string | undefined> {
  const explicit = normalizeOptionalUrl(override);
  if (explicit !== undefined) return explicit;

  try {
    return normalizeOptionalUrl(
      await resolveSourceDownloadUrl({
        sourceKey,
        fallbackUrl: envFallback,
      })
    );
  } catch {
    return normalizeOptionalUrl(envFallback);
  }
}

export async function resolveCzDutySourceUrls(opts: ResolveCzDutySourceUrlsOptions = {}): Promise<{
  mfnUrl?: string;
  ftaUrl?: string;
}> {
  const mfnUrl = await resolveOptionalSourceUrl(
    opts.mfnUrl,
    CZ_MFN_OFFICIAL_SOURCE_KEY,
    process.env.CZ_MFN_OFFICIAL_EXCEL_URL
  );
  const ftaUrl = await resolveOptionalSourceUrl(
    opts.ftaUrl,
    CZ_FTA_OFFICIAL_SOURCE_KEY,
    process.env.CZ_FTA_OFFICIAL_EXCEL_URL
  );
  return { mfnUrl, ftaUrl };
}
