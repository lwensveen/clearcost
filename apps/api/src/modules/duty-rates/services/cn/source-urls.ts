import { resolveSourceDownloadUrl } from '../../../../lib/source-registry.js';

export const CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY = 'duties.cn.official.fta_excel';

export type ResolveCnPreferentialDutySourceUrlsOptions = {
  ftaExcelUrl?: string;
};

function normalizeOptionalUrl(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

export async function resolveCnPreferentialDutySourceUrls(
  opts: ResolveCnPreferentialDutySourceUrlsOptions = {}
): Promise<{ ftaExcelUrl?: string }> {
  if (opts.ftaExcelUrl !== undefined)
    return { ftaExcelUrl: normalizeOptionalUrl(opts.ftaExcelUrl) };

  const envFallback = normalizeOptionalUrl(process.env.CN_FTA_OFFICIAL_EXCEL_URL);

  try {
    const ftaExcelUrl = await resolveSourceDownloadUrl({
      sourceKey: CN_FTA_OFFICIAL_EXCEL_SOURCE_KEY,
      fallbackUrl: envFallback,
    });
    return { ftaExcelUrl: normalizeOptionalUrl(ftaExcelUrl) };
  } catch {
    return { ftaExcelUrl: envFallback };
  }
}
