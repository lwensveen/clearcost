import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const NZ_MFN_OFFICIAL_SOURCE_KEY = 'duties.nz.official.mfn_excel';
export const NZ_FTA_OFFICIAL_SOURCE_KEY = 'duties.nz.official.fta_excel';

export type ResolveNzDutySourceUrlsOptions = {
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

export async function resolveNzDutySourceUrls(opts: ResolveNzDutySourceUrlsOptions = {}): Promise<{
  mfnUrl?: string;
  ftaUrl?: string;
}> {
  const mfnUrl = await resolveOptionalSourceUrl(
    opts.mfnUrl,
    NZ_MFN_OFFICIAL_SOURCE_KEY,
    process.env.NZ_MFN_OFFICIAL_EXCEL_URL
  );
  const ftaUrl = await resolveOptionalSourceUrl(
    opts.ftaUrl,
    NZ_FTA_OFFICIAL_SOURCE_KEY,
    process.env.NZ_FTA_OFFICIAL_EXCEL_URL
  );
  return { mfnUrl, ftaUrl };
}
