import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const PT_MFN_OFFICIAL_SOURCE_KEY = 'duties.pt.official.mfn_excel';
export const PT_FTA_OFFICIAL_SOURCE_KEY = 'duties.pt.official.fta_excel';

export type ResolvePtDutySourceUrlsOptions = {
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

export async function resolvePtDutySourceUrls(opts: ResolvePtDutySourceUrlsOptions = {}): Promise<{
  mfnUrl?: string;
  ftaUrl?: string;
}> {
  const mfnUrl = await resolveOptionalSourceUrl(
    opts.mfnUrl,
    PT_MFN_OFFICIAL_SOURCE_KEY,
    process.env.PT_MFN_OFFICIAL_EXCEL_URL
  );
  const ftaUrl = await resolveOptionalSourceUrl(
    opts.ftaUrl,
    PT_FTA_OFFICIAL_SOURCE_KEY,
    process.env.PT_FTA_OFFICIAL_EXCEL_URL
  );
  return { mfnUrl, ftaUrl };
}
