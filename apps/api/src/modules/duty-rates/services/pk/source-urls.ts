import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const PK_MFN_OFFICIAL_SOURCE_KEY = 'duties.pk.official.mfn_excel';
export const PK_FTA_OFFICIAL_SOURCE_KEY = 'duties.pk.official.fta_excel';

export type ResolvePkDutySourceUrlsOptions = {
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

export async function resolvePkDutySourceUrls(opts: ResolvePkDutySourceUrlsOptions = {}): Promise<{
  mfnUrl?: string;
  ftaUrl?: string;
}> {
  const mfnUrl = await resolveOptionalSourceUrl(
    opts.mfnUrl,
    PK_MFN_OFFICIAL_SOURCE_KEY,
    process.env.PK_MFN_OFFICIAL_EXCEL_URL
  );
  const ftaUrl = await resolveOptionalSourceUrl(
    opts.ftaUrl,
    PK_FTA_OFFICIAL_SOURCE_KEY,
    process.env.PK_FTA_OFFICIAL_EXCEL_URL
  );
  return { mfnUrl, ftaUrl };
}
